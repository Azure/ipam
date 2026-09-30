# Conventions & Guardrails

## Overview

Azure IPAM has a handful of places where the obvious approach is the wrong one. This page records them, so you don't have to rediscover each one the hard way. It opens with how Azure IPAM decides what a caller can see, which applies to almost every endpoint.

These are not style preferences. Every entry exists because doing the natural thing produced a bug, a security gap, or documentation that quietly lied. If you are about to remove something described here because it looks redundant, read the relevant entry first.

Each entry covers three things:

- **The rule** — What to do, and what never to do
- **The reason** — Why the obvious alternative fails
- **The failure mode** — What you will see when it goes wrong

For setting up an environment to work in, see the [Development](/development/README.md) documentation. For the process of getting a change accepted, see the [Contributing](/contributing/README.md) documentation.

> **Note:** Adding a new pattern to this page? Keep the same shape — the rule, the reason, and the failure mode. A convention nobody understands is a convention that gets reverted.

## Deciding What a Caller Can See

Azure IPAM often needs a broader view than the person asking to answer a question correctly. Use that broader view to work out the answer, and let the caller's own permissions decide what the response contains.

For example, when a user checks whether a range overlaps anything, Azure IPAM considers every network within its scope, including networks that user can't see in Azure. Otherwise it might report a range as free when it isn't. The user learns that the range is in use, without learning anything about the network using it.

To support this, Azure IPAM reads Azure in one of two ways. It can use its own read-only access, which covers everything within its scope. Or it can act on the caller's behalf through the [on-behalf-of](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-on-behalf-of-flow) flow, which sees only what the caller can see. Which one a request uses depends on what the answer requires, not simply on whether the caller is an administrator.

When you write or change an endpoint:

- **Query with the scope the answer needs.** Every Azure query states its scope with `AzureScope`. Allocation and overlap checks are Azure IPAM's own work, so they use `AzureScope.SYSTEM` and consider every network. Anything shown to a caller uses the caller's scope from `get_azure_scope`, which is `TENANT` for administrators and `CALLER` otherwise. If a non-admin response would include details of virtual networks that aren't associated with a Block, either query with the caller's scope or remove those details.
- **Withhold details without changing the shape.** Set withheld fields to `null`, and keep every item in a response the same shape. Don't return a different model, or a placeholder such as `"unknown"` that automation would treat as a real value.
- **Don't use on-behalf-of for service principals.** The flow only works for users. Treat a service principal that isn't an administrator as having no Azure visibility of its own.
- **Treat Reservation IDs as sensitive.** A Reservation ID is what links a virtual network to its Reservation, so only return it to the user who created the Reservation and to administrators.
- **Check every endpoint that returns the object.** The Spaces endpoints return Blocks together with their networks, External Networks and Reservations. A restriction on a dedicated endpoint only holds if every other endpoint returning the same data applies it too.
- **Keep the tool endpoints stable.** The `/tools` endpoints are designed for automation as much as for people, so keep their responses consistent from release to release.

Together, these keep allocation and overlap answers accurate for everyone, while the details each user sees match their Azure permissions and stay consistent across every endpoint.

For the principles behind these rules, see the [Roles & Permissions](/roles-permissions/README.md#guiding-principles) documentation.

## Declaring Permissions

Never check whether the caller is an administrator, and never hand-write an "admin only" note or a `403` response. Declare the permission a route or decision needs, and let both enforcement and the documentation come from that declaration.

Permissions live in `app/permissions.py`. Each `Permission` is a `resource/action` pair, such as `externals/update`, where the action matches the HTTP method: `read`, `create`, `update` or `delete`. The qualifier `/all` means "not just your own", as in `reservations/read/all`. `ROLES` states which role holds which permission.

A permission exists only where the code makes a decision about it. Anything every signed-in user may do, such as reading Spaces or creating their own Reservations, needs no permission, so don't add one in anticipation of a future need.

When a route requires a permission, declare it on the route:

```python
@router.post(
    "",
    summary = "Create New Space",
    response_model = Space,
    status_code = 201,
    dependencies = [Depends(requires(Permission.SPACES_CREATE))]
)
async def create_space(...):
    ...
```

When only a parameter is restricted, depend on a parameter gate made with `requires_param`. The gate declares the query parameter itself, so your route simply depends on it:

```python
async def get_spaces(
    expand: bool = Depends(expand_gate),
    ...
):
```

When a route is open to everyone but what it returns depends on the caller, ask the caller's grants:

```python
async def get_block_reservations(..., grants: Grants = Depends(get_grants)):
    if not grants.can(Permission.RESERVATIONS_READ_ALL):
        ...
```

The OpenAPI generator in `app/openapi.py` walks each route's dependency tree and annotates what it finds:

- **A route gate** for a permission the User role doesn't hold appends `(Admin Only)` to the operation summary and attaches a documented `403`.
- **A parameter gate** marks only the parameter it guards, because the endpoint itself is not restricted.

You can see the result in the [API](/api/README.md) documentation, where admin restricted operations are labelled in the endpoint list.

Decisions made with `grants.can(...)` inside an open route aren't annotated, because the route itself isn't restricted. Describe what each caller receives in the route's docstring instead, as `cidrCheck` does.

Enforcement and documentation come from a single declaration, so they cannot disagree. The alternative, annotating `responses={403: ...}` by hand on every restricted endpoint, was tried and rejected. That approach leaves roughly 46 pieces of metadata sitting next to, but not derived from, the actual check. The first time someone adds a guard and forgets the annotation, the published API contract is wrong and nothing catches it.

To add a permission, add it to `Permission` with a one-line description in `DESCRIPTIONS`, and to each role that holds it in `ROLES`. To add a parameter gate, create it with `requires_param`. The generator reads the markers these gates carry as it walks the dependency tree, so there is no registry for you to keep in sync.

Marking is best effort and never fatal. If route introspection breaks, most likely after a FastAPI upgrade because it relies on `fastapi.routing.iter_route_contexts`, the engine still serves a valid schema and simply loses the annotations. Watch for this line at startup:

```text
OpenAPI generated successfully (35 admin-marked operations)
```

A count of `0`, or a `WARNING` that the markings could not be applied, means the generator needs attention. Enforcement is unaffected either way, because the gates are ordinary dependencies.

> **Note:** Ownership decisions, such as refusing to cancel another user's Reservation, are made with `grants.can(...)` inside routes that everyone may call. They aren't marked as admin restrictions in the API documentation, because the route itself isn't restricted.

## Authenticating API Endpoints

Never declare `authorization` as a `Header(...)` parameter. Use `Depends(get_token_auth_header)` when a route needs the caller's token.

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
