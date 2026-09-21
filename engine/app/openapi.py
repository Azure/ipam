"""
OpenAPI document generation for Azure IPAM.

Builds the schema and then annotates it from the admin gates declared in
``app.dependencies``. The gates are the single source of truth: an operation is
marked because it actually enforces the restriction, so the published contract
cannot drift away from the runtime behaviour.

This module reads FastAPI's route structures, including
``fastapi.routing.iter_route_contexts``, which is not part of the documented
public API. A FastAPI upgrade could change it. Marking is therefore best effort
and never fatal, see :func:`build_openapi`.
"""

from fastapi import routing as fastapi_routing
from fastapi.openapi.utils import get_openapi

from app.dependencies import ADMIN_FORBIDDEN, require_admin
from app.logs.logs import ipam_logger as logger

ADMIN_MARKER = "(Admin Only)"

def _dependency_tree_contains(dependant, target):
    """Recursively test whether `target` appears anywhere in a route's dependency tree."""

    for dependency in dependant.dependencies:
        if dependency.call is target or _dependency_tree_contains(dependency, target):
            return True

    return False

def _collect_admin_flag_parameters(dependant):
    """Collect the parameter names guarded by parameter-level admin gates."""

    parameters = []

    for dependency in dependant.dependencies:
        parameter = getattr(dependency.call, "admin_flag_parameter", None)

        if parameter:
            parameters.append(parameter)

        parameters.extend(_collect_admin_flag_parameters(dependency))

    return parameters

def _apply_admin_markings(app, schema):
    """
    Annotate operations whose dependency tree contains an admin gate.

    An endpoint-level gate marks the whole operation, while a parameter-level gate
    marks only the parameter it guards, because the endpoint itself is not
    restricted. Returns the number of operations marked.
    """

    marked = 0

    for context in fastapi_routing.iter_route_contexts(app.routes):
        if not isinstance(context.original_route, fastapi_routing.APIRoute):
            continue

        endpoint_admin = _dependency_tree_contains(context.dependant, require_admin)
        flagged_params = _collect_admin_flag_parameters(context.dependant)

        if not (endpoint_admin or flagged_params):
            continue

        for method in context.methods:
            operation = schema["paths"].get(context.path_format, {}).get(method.lower())

            if operation is None:
                continue

            operation.setdefault("responses", {})["403"] = ADMIN_FORBIDDEN
            marked += 1

            if endpoint_admin:
                operation["summary"] = "{} {}".format(operation.get("summary", ""), ADMIN_MARKER).strip()
                operation["description"] = (
                    "**Requires Azure IPAM administrator privileges.**\n\n"
                    + (operation.get("description") or "")
                ).strip()
            else:
                operation["description"] = (
                    "**Some parameters on this endpoint require administrator privileges.**\n\n"
                    + (operation.get("description") or "")
                ).strip()

                for parameter in operation.get("parameters", []):
                    if parameter["name"] in flagged_params:
                        parameter["description"] = "{} {}".format(
                            parameter.get("description", ""), ADMIN_MARKER
                        ).strip()

    return marked

def build_openapi(app):
    """
    Build the OpenAPI document, then annotate the admin restrictions.

    Marking is best effort and deliberately never fatal. If route introspection
    breaks (for example after a FastAPI upgrade), the API still serves a valid
    schema, it simply loses the "(Admin Only)" annotations. The log line below is
    the signal to investigate: a count of zero, or the warning, means this module
    needs attention. Enforcement is unaffected either way, because the gates are
    ordinary dependencies.
    """

    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title = app.title,
        version = app.version,
        description = app.description,
        contact = app.contact,
        routes = app.routes
    )

    try:
        marked = _apply_admin_markings(app, schema)
        logger.info("OpenAPI generated successfully ({} admin-marked operations)".format(marked))
    except Exception as e:
        logger.warning("OpenAPI generated, but admin markings could not be applied: {}".format(e))

    app.openapi_schema = schema

    return schema
