# Conventions & Guardrails

## Overview

Azure IPAM has a handful of places where the obvious approach is the wrong one. This page records them, so you don't have to rediscover each one the hard way.

These are not style preferences. Every entry exists because doing the natural thing produced a bug, a security gap, or documentation that quietly lied. If you are about to remove something described here because it looks redundant, read the relevant entry first.

Each entry covers three things:

- **The rule** — What to do, and what never to do
- **The reason** — Why the obvious alternative fails
- **The failure mode** — What you will see when it goes wrong

For setting up an environment to work in, see the [Development](/development/README.md) documentation. For the process of getting a change accepted, see the [Contributing](/contributing/README.md) documentation.

> **Note:** Adding a new pattern to this page? Keep the same shape — the rule, the reason, and the failure mode. A convention nobody understands is a convention that gets reverted.

## Documenting Admin Restrictions

Never hand-write an "admin only" note, and never hand-write a `403` response. Declare an admin gate instead, and let the documentation be generated from it.

Azure IPAM restricts many endpoints to administrators, and a few restrict only certain parameters. You declare both using dependencies from `app/dependencies.py`.

When an endpoint requires admin outright, declare the gate on the route:

```python
@router.post(
    "",
    summary = "Create New Space",
    response_model = Space,
    status_code = 201,
    dependencies = [Depends(require_admin)]
)
async def create_space(...):
    ...
```

When only a parameter is restricted, use the parameter-level gate. It declares the query parameter itself, so your route simply depends on it:

```python
async def get_spaces(
    expand: bool = Depends(admin_expand),
    ...
):
```

The OpenAPI generator in `app/openapi.py` walks each route's dependency tree and annotates what it finds:

- **`require_admin`** — Appends `(Admin Only)` to the operation summary and attaches a documented `403`
- **A parameter-level gate** — Marks only the parameter it guards, because the endpoint itself is not restricted

You can see the result in the [API](/api/README.md) documentation, where admin restricted operations are labelled in the endpoint list.

Enforcement and documentation come from a single declaration, so they cannot disagree. The alternative, annotating `responses={403: ...}` by hand on every restricted endpoint, was tried and rejected. That approach leaves roughly 46 pieces of metadata sitting next to, but not derived from, the actual check. The first time someone adds a guard and forgets the annotation, the published API contract is wrong and nothing catches it.

To add a new parameter-level gate, write the gate function and mark it with `@admin_flag_gate("<parameter>")`. The generator reads that marker as it walks the dependency tree, so there is no registry for you to keep in sync.

Marking is best effort and never fatal. If route introspection breaks, most likely after a FastAPI upgrade because it relies on `fastapi.routing.iter_route_contexts`, the engine still serves a valid schema and simply loses the annotations. Watch for this line at startup:

```text
OpenAPI generated successfully (42 admin-marked operations)
```

A count of `0`, or a `WARNING` that the markings could not be applied, means the generator needs attention. Enforcement is unaffected either way, because the gates are ordinary dependencies.

> **Note:** A handful of `403` responses are ownership checks rather than admin checks, such as refusing to delete another user's reservation. Those stay inline, as they are not admin restrictions and marking them as such would be misleading.

## Authenticating API Endpoints

Never declare `authorization` as a `Header(...)` parameter. Use `Depends(get_authorization)` when a route body needs the raw header value.

The OpenAPI specification requires that a header parameter named `Authorization` be ignored. Swagger UI honours that literally, rendering the input box and then silently dropping whatever you type into it when the request is built. The interactive documentation was unusable for this reason, and every **Try it out** call returned a `401` even with a valid token pasted in.

The token is advertised as an `HTTPBearer` security scheme instead, which is what makes the **Authorize** button work. That scheme is declared as a sub-dependency of `validate_token` rather than as a separate router dependency:

```python
async def validate_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(ipam_security)
):
```

Chaining them this way means an endpoint cannot advertise authentication without also enforcing it. Were the scheme a separate router dependency, a router could declare the padlock and omit the check, producing an endpoint that looks protected in the documentation while accepting every request.

The `credentials` parameter is deliberately unused, as the header is parsed by `get_token_auth_header`. It exists so the security requirement propagates into the generated schema.

For guidance on obtaining a token and calling the API, see the [API](/api/README.md) documentation.

## HTTP Clients and Sovereign Clouds

Use `aiohttp` for outbound HTTP requests. Both `requests` and `httpx` are banned, and ruff enforces the ban.

Synchronous clients validate TLS against the bundled `certifi` roots and cannot see the sovereign cloud roots injected through `WEBSITES_INCLUDE_CLOUD_CERTS`. Code that uses them passes every commercial cloud test and then fails in secret clouds, where the failure is expensive to diagnose.

The ban lives in `engine/pyproject.toml` under `flake8-tidy-imports.banned-api`, so you will catch it at lint time rather than at deployment time.
