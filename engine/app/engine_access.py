"""
How well the engine's own identity can reach Azure.

Every Azure credential for the Engine app registration is created by
``get_client_credentials()`` or ``get_obo_credentials()`` in
``app.routers.common.helper``, which return the wrapped credentials below. Each
sign-in through them, and each Resource Graph query made as the engine, is
classified and recorded here, so a failure can be explained to the caller and
reported as a notification without making any extra calls to Azure. The
reservation job alone makes such calls every minute.

Failures are told apart by whose fault they are. A problem with the engine's
own secret, app registration or Reader role is the engine's, so it is recorded
and returned as a server error. A problem with a user's own token or access
belongs to that user and is neither recorded nor reported as the engine's.
"""

import json
import re
import time
from dataclasses import dataclass

from azure.core.exceptions import (
    ClientAuthenticationError,
    ServiceRequestError,
    ServiceResponseError,
)
from azure.identity.aio import ClientSecretCredential, OnBehalfOfCredential

from app.globals import globals
from app.logs.logs import ipam_logger as logger

# A network failure is only reported once nothing has succeeded for this long,
# with at least this many failures, so a brief blip never raises an alarm.
NETWORK_DELAY = 180
NETWORK_MIN_FAILURES = 2

KEY_VAULT_REFERENCE_PREFIX = "@Microsoft.KeyVault("

# Entra error codes that always mean the engine's own app or secret is at fault,
# whichever flow it is signing in with.
_ENGINE_CODES = {
    7000222: "secret_expired",
    7000215: "secret_invalid",
    700016: "app_not_found",
    7000112: "app_disabled",
}

# Conditional Access only blocks the engine when it signs in as itself. On a
# user's behalf it is the user's own policy that applies.
_ENGINE_ONLY_CODES = {
    53003: "blocked_conditional_access",
}

_MESSAGES = {
    "secret_expired": "Azure IPAM's client secret has expired ({code}). An administrator needs to rotate it.",
    "secret_invalid": "Azure IPAM's client secret isn't valid ({code}). An administrator needs to check the secret it's using.",
    "secret_unresolved": "Azure IPAM's client secret isn't configured. Its Key Vault reference couldn't be resolved.",
    "secret_missing": "Azure IPAM's client secret isn't configured.",
    "app_not_found": "Azure IPAM's app registration wasn't found ({code}).",
    "app_disabled": "Azure IPAM's service principal is disabled ({code}).",
    "blocked_conditional_access": "Conditional Access blocked Azure IPAM from signing in to Azure ({code}).",
    "sign_in_failed": "Azure IPAM couldn't sign in to Azure ({code}).",
    "no_azure_access": "Azure IPAM doesn't have permission to read Azure resources. An administrator needs to restore its Reader role.",
    "entra_unreachable": "Azure IPAM couldn't reach Microsoft Entra ID.",
    "arm_unreachable": "Azure IPAM couldn't reach Azure Resource Manager.",
    "user": "Azure authentication failed, your credentials may be expired or invalid.",
}


@dataclass(frozen=True)
class AccessProblem:
    """A classified failure of an Azure sign-in or Resource Graph query."""

    cause: str
    message: str
    status: int
    code: str | None = None
    engine: bool = True
    network: bool = False


class EngineAccessError(Exception):
    """Raised in place of a call that can't be made because of an engine access problem."""

    def __init__(self, problem):
        super().__init__(problem.message)

        self.problem = problem


def _problem(cause, code=None, *, engine=True, network=False):
    template = _MESSAGES[cause]
    message = template.format(code=code) if code else template.replace(" ({code})", "")

    return AccessProblem(
        cause=cause,
        message=message,
        status=500 if engine else 401,
        code=code,
        engine=engine,
        network=network,
    )


def _secret_problem():
    """The problem to report when the secret can't have worked, or None if it looks usable."""

    secret = globals.CLIENT_SECRET

    if not secret:
        return _problem("secret_missing")

    if secret.startswith(KEY_VAULT_REFERENCE_PREFIX):
        return _problem("secret_unresolved")

    return None


def _error_codes(exc):
    """Entra's numeric error codes for a failed sign-in, from the response body or, failing that, the message."""

    response = getattr(exc, "response", None)

    if response is not None:
        try:
            codes = json.loads(response.text()).get("error_codes")

            if codes:
                return [int(code) for code in codes]
        except Exception:
            pass

    return [int(code) for code in re.findall(r"AADSTS(\d+)", str(exc))]


def classify_sign_in_error(exc, *, engine_identity):
    """Classify a failed sign-in. ``engine_identity`` is True when the engine signed in as itself."""

    if isinstance(exc, (ServiceRequestError, ServiceResponseError)):
        return _problem("entra_unreachable", network=True)

    codes = _error_codes(exc)
    code = f"AADSTS{codes[0]}" if codes else None

    for number in codes:
        if number in _ENGINE_CODES:
            return _secret_problem() or _problem(_ENGINE_CODES[number], f"AADSTS{number}")

    if engine_identity:
        for number in codes:
            if number in _ENGINE_ONLY_CODES:
                return _problem(_ENGINE_ONLY_CODES[number], f"AADSTS{number}")

        return _secret_problem() or _problem("sign_in_failed", code)

    return _problem("user", code, engine=False)


def no_azure_access():
    return _problem("no_azure_access")


def arm_unreachable():
    return _problem("arm_unreachable", network=True)


def problem_of(exc):
    """The classification attached to an exception by the wrapped credentials, if any."""

    return getattr(exc, "ipam_access_problem", None)


# --- The record of what has been observed ------------------------------------


@dataclass
class _Facet:
    """What has been observed about one part of the engine's access: signing in, or reading Azure."""

    problem: AccessProblem | None = None
    network: AccessProblem | None = None
    network_since: float | None = None
    network_failures: int = 0
    observed_on: float | None = None

    def effective(self, now):
        if self.problem:
            return self.problem

        if (
            self.network
            and self.network_failures >= NETWORK_MIN_FAILURES
            and now - self.network_since >= NETWORK_DELAY
        ):
            return self.network

        return None


_sign_in = _Facet()
_access = _Facet()
_reported = None


def _report_change():
    """Log when the engine's overall access problem appears, changes or clears, but not on every call."""

    global _reported

    problem = current_problem()
    cause = problem.cause if problem else None

    if cause == _reported:
        return

    if problem:
        logger.error(f"Azure IPAM can't reach Azure as itself: {problem.message}")
    elif _reported:
        logger.info("Azure IPAM can reach Azure as itself again.")

    _reported = cause


def _record_success(facet):
    facet.problem = None
    facet.network = None
    facet.network_since = None
    facet.network_failures = 0
    facet.observed_on = time.time()

    _report_change()


def _record_problem(facet, problem):
    if problem.network:
        if facet.network_since is None:
            facet.network_since = time.monotonic()

        facet.network = problem
        facet.network_failures += 1
    else:
        facet.problem = problem

    facet.observed_on = time.time()

    _report_change()


def record_access_success(*, engine_identity):
    """
    Record a successful Resource Graph query. One made as the engine proves its
    Reader role; one made on a user's behalf only proves Azure is reachable.
    """

    if engine_identity:
        _record_success(_access)
    else:
        _access.network = None
        _access.network_since = None
        _access.network_failures = 0

        _report_change()


def record_access_problem(problem):
    _record_problem(_access, problem)


def current_problem():
    """The engine's current access problem, or None. Signing in is checked before reading Azure."""

    now = time.monotonic()

    return _sign_in.effective(now) or _access.effective(now)


def observed_on():
    """When the oldest part of the record was last observed (Unix time), or None if nothing has been yet."""

    times = [facet.observed_on for facet in (_sign_in, _access) if facet.observed_on is not None]

    return min(times) if times else None


def current_problem_logged():
    """``current_problem()``, also logging a network problem that has just passed its reporting delay."""

    _report_change()

    return current_problem()


# --- Wrapped credentials -----------------------------------------------------


async def _observe(sign_in, *, engine_identity):
    """Run a sign-in, recording and classifying its outcome without changing it."""

    try:
        token = await sign_in
    except (ClientAuthenticationError, ServiceRequestError, ServiceResponseError) as e:
        problem = classify_sign_in_error(e, engine_identity=engine_identity)
        e.ipam_access_problem = problem

        if problem.engine:
            _record_problem(_sign_in, problem)

        raise

    _record_success(_sign_in)

    return token


class EngineClientSecretCredential(ClientSecretCredential):
    """The engine signing in as itself."""

    async def get_token(self, *scopes, **kwargs):
        return await _observe(super().get_token(*scopes, **kwargs), engine_identity=True)

    async def get_token_info(self, *scopes, **kwargs):
        return await _observe(super().get_token_info(*scopes, **kwargs), engine_identity=True)


class EngineOnBehalfOfCredential(OnBehalfOfCredential):
    """The engine signing in on a user's behalf, which also depends on the engine's own secret."""

    async def get_token(self, *scopes, **kwargs):
        return await _observe(super().get_token(*scopes, **kwargs), engine_identity=False)

    async def get_token_info(self, *scopes, **kwargs):
        return await _observe(super().get_token_info(*scopes, **kwargs), engine_identity=False)


def check_secret():
    """Raise ``EngineAccessError`` when the secret is missing, as the credential can't even be created."""

    if not globals.CLIENT_SECRET:
        problem = _problem("secret_missing")
        _record_problem(_sign_in, problem)

        raise EngineAccessError(problem)
