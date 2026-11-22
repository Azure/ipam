# Conventions & Guardrails

## Overview

Azure IPAM has a handful of places where the obvious approach is the wrong one. This page records them, so you don't have to rediscover each one the hard way. It opens with how Azure IPAM decides what a caller can see, which applies to almost every endpoint.

These are not style preferences. Every entry exists because doing the natural thing produced a bug, a security gap, or documentation that quietly lied. If you are about to remove something described here because it looks redundant, read the relevant entry first.

Each entry covers three things:

- **The rule** — What to do, and what never to do
- **The reason** — Why the obvious alternative fails
- **The failure mode** — What you will see when it goes wrong

For setting up an environment to work in, see the [Development](/development/README.md) documentation. For the process of getting a change accepted, see the [Contributing](/contributing/README.md) documentation.

> **NOTE:** Adding a new pattern to this page? Keep the same shape — the rule, the reason and the failure mode. A convention nobody understands is a convention that gets reverted.

## Deciding What a Caller Can See

Azure IPAM often needs a broader view than the person asking to answer a question correctly. Use that broader view to work out the answer, and let the caller's own permissions decide what the response contains.

For example, when a user checks whether a range overlaps anything, Azure IPAM considers every network within its scope, including networks that user can't see in Azure. Otherwise it might report a range as free when it isn't. The user learns that the range is in use, without learning anything about the network using it.

To support this, Azure IPAM reads Azure in one of two ways. It can use its own read-only access, which covers everything within its scope. Or it can act on the caller's behalf through the [on-behalf-of](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-on-behalf-of-flow) flow, which sees only what the caller can see. Which one a request uses depends on what the answer requires, not simply on whether the caller is an administrator.

When you write or change an endpoint:

- **Query with the scope the answer needs.** Every Azure query states its scope with `AzureScope`. Allocation and overlap checks are Azure IPAM's own work, so they use `AzureScope.SYSTEM` and consider every applicable network, including ones the caller can't see. Anything shown to a caller uses the caller's scope from `get_azure_scope`, which is `TENANT` for administrators and `CALLER` otherwise. If a non-admin response would include details of virtual networks that aren't associated with a Block, or of the subnets and endpoints of associated networks, either query with the caller's scope or remove those details.
- **Withhold details without changing the shape.** Set withheld fields to `null`, and keep every item in a response the same shape. Don't return a different model, or a placeholder such as `"unknown"` that automation would treat as a real value.
- **Don't use on-behalf-of for service principals.** The flow only works for users. Treat a service principal that isn't an administrator as having no Azure visibility of its own.
- **Treat Reservation IDs as sensitive.** A Reservation ID is what links a virtual network to its Reservation, so only return it to the user who created the Reservation and to administrators.
- **Check every endpoint that returns the object.** The Spaces endpoints return Blocks together with their networks, External Networks and Reservations. A restriction on a dedicated endpoint only holds if every other endpoint returning the same data applies it too.
- **Show the address plan as it's stored.** When the UI displays part of the address plan, such as the networks associated with a Block, take it from an endpoint that returns the plan, not one scoped to the caller's view of Azure. A network the caller can't see in Azure is still part of the plan, and a view built from their Azure resources would show it as missing. For the same reason, `GET /spaces/{space}/blocks/{block}/available` resolves the Block's associated networks with `AzureScope.TENANT`, even when the rest of its list uses the caller's scope.
- **Keep the tool endpoints stable.** The `/tools` endpoints are designed for automation as much as for people, so keep their responses consistent from release to release.

Together, these keep allocation and overlap answers accurate for everyone, while the details each user sees match their Azure permissions and stay consistent across every endpoint.

For the principles behind these rules, see the [Roles & Permissions](/roles-permissions/README.md#guiding-principles) documentation.

## Declaring Permissions

Never check whether the caller is an administrator, and never hand-write an "admin only" note or a `403` response. Declare the permission a route or decision needs, and let both enforcement and the documentation come from that declaration.

Permissions live in `app/permissions.py`. Each `Permission` is a `resource/action` pair, such as `externals/update`, where the action matches the HTTP method: `read`, `create`, `update` or `delete`. The qualifier `/all` means "not just your own", as in `reservations/read/all`. Each `Role` defines a stable `id`, the `name` and `description` shown to people, and the permissions the role holds. `ROLES` lists every role by `id`, and `GET /roles` publishes the same definitions, so the API and the UI describe roles from one place.

A permission exists for each decision the code makes about access, even when every current role holds it. `associations/read` and `externals/read` are held by both roles today, so no one is refused, but they let a future role be denied access without changing any routes. Don't add a permission for something the code doesn't decide, such as reading Spaces or creating your own Reservations.

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

You can see the result in the [API](/api/README.md) documentation, where admin-restricted operations are labeled in the endpoint list.

Decisions made with `grants.can(...)` inside an open route aren't annotated, because the route itself isn't restricted. Describe what each caller receives in the route's docstring instead, as `cidrCheck` does.

Enforcement and documentation come from a single declaration, so they cannot disagree. The alternative, annotating `responses={403: ...}` by hand on every restricted endpoint, was tried and rejected. That approach leaves roughly 46 pieces of metadata sitting next to, but not derived from, the actual check. The first time someone adds a guard and forgets the annotation, the published API contract is wrong and nothing catches it.

To add a permission, add it to `Permission` with a one-line description in `DESCRIPTIONS`, and to the `permissions` of each role that holds it. To add a parameter gate, create it with `requires_param`. The generator reads the markers these gates carry as it walks the dependency tree, so there is no registry for you to keep in sync.

A role's `id` is part of the API: users report the roles they hold by `id`, and automation can rely on it. Change a role's `name` or `description` freely, but never its `id`.

Marking is best effort and never fatal. If route introspection breaks, most likely after a FastAPI upgrade because it relies on `fastapi.routing.iter_route_contexts`, the engine still serves a valid schema and simply loses the annotations. Watch for this line the first time the API schema is requested, by opening `/api/docs` or `/api/openapi.json` after the engine starts:

```text
OpenAPI generated successfully (35 admin-marked operations)
```

A count of `0`, or a `WARNING` that the markings could not be applied, means the generator needs attention. Enforcement is unaffected either way, because the gates are ordinary dependencies.

> **NOTE:** Ownership decisions, such as refusing to cancel another user's Reservation, are made with `grants.can(...)` inside routes that everyone may call. They aren't marked as admin restrictions in the API documentation, because the route itself isn't restricted.

## Authenticating API Endpoints

Never declare `authorization` as a `Header(...)` parameter. Use `Depends(get_token_auth_header)` when a route needs the caller's token.

The OpenAPI specification requires that a header parameter named `Authorization` be ignored. Swagger UI honors that literally, rendering the input box and then silently dropping whatever you type into it when the request is built. The interactive documentation was unusable for this reason, and every **Try it out** call returned a `401` even with a valid token pasted in.

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

## Querying Cosmos DB

Pass every value a query compares against as a parameter, and never build it into the query text. `cosmos_query()` takes the Cosmos DB SDK's own parameter list:

```python
await cosmos_query(
    "SELECT * FROM c WHERE c.type = 'space' AND LOWER(c.name) = LOWER(@space)",
    tenant_id,
    [{"name": "@space", "value": space}]
)
```

A parameter reaches Cosmos DB separately from the query and is only ever compared as a value, whatever characters it contains. It also lets Cosmos DB reuse one query plan for every value, rather than compiling a new query each time the text changes. Microsoft's guidance for Cosmos DB recommends parameters for both reasons.

Ruff enforces this with `S608` in `engine/pyproject.toml`, which rejects query text built with `.format()`, an f-string or `+`, so you will catch it at lint time.

## Notification Detectors

Raise an exception when a notification detector can't complete its check. Never catch the error and return an empty list.

The notification framework keeps each detector's last successful result and reuses it until the detector's maximum age passes. When a detector raises, the framework logs the error, keeps that last result, and tries again once the detector's minimum interval has passed. An empty list means something else entirely: the check ran and found nothing to report. A detector that returns one when it fails is telling the framework that every notification it raised has gone away.

That is exactly what used to happen. The registry and update detectors both caught their own errors, so a brief Azure Resource Manager or GitHub failure hid their notifications until the next successful check, including the critical one for deployments still pulling from the legacy registry.

When an upstream service asks you to wait, as GitHub does after a rate limit, raise `RetryAfter` from `app/notifications/errors.py` with the number of seconds it asked for. The detector won't run again until that time has passed, even when someone selects **Refresh**.

Register each detector in `app/notifications/detectors/__init__.py` with a maximum age and a minimum interval that suit what it calls. A detector that only reads local state can use `0` for both and run on every request. One that calls an external service should keep well clear of that service's limits, remembering that every engine instance runs its detectors independently.

When a change made through Azure IPAM itself alters what a detector reports, call `recheck` from `app/notifications` with the detector's name once the change is saved, as the admin endpoints do for the `setup` detector. The notification then reflects the change on the next request rather than after the detector's maximum age, which only has to bound how long another engine instance can lag behind.

Write every notification `message` as a triple-quoted string, however short, wrapped wherever reads best (an f-string if it includes values). Write every `title` as an ordinary single-line string, and keep shared sentences that are inserted into messages, such as `REASON`, as ordinary strings too. Don't split text into adjacent string literals. That style makes every author decide where to break the text, and a missing space at the end of one piece silently runs two words together. The `Notification` model normalizes the text for you: the title is collapsed onto one line, and each paragraph of the message is joined into one, so line breaks and indentation in the source never reach the reader. Separate paragraphs with a blank line. The interface displays them as separate paragraphs.

## Engine Credentials

Create every Azure credential for the Engine app registration with `get_client_credentials()` or `get_obo_credentials()` in `app/routers/common/helper.py`. Never construct a `ClientSecretCredential` or `OnBehalfOfCredential` yourself.

Those two functions return credentials that classify each sign-in and record its outcome in `app/engine_access.py`. That record is how Azure IPAM tells everyone its client secret has expired, or that Conditional Access is blocking it, without making a single call of its own to find out. It's also how an error response knows whose fault a failure is. A sign-in that bypasses them is invisible to both, and a request made on a user's behalf goes back to telling them *your credentials may be expired or invalid* when the problem is Azure IPAM's own secret, sending them off to fix something that isn't broken.

Resource Graph queries follow the same rule. Run them through `arg_query()` or `arg_query_helper()`, and pass `app_only=True` whenever the query runs as Azure IPAM itself. A successful query as the engine is what proves its Reader role is intact, and a denied one is what reports it missing. Without `app_only`, a missing role is mistaken for a user who simply can't see the resource.

Ruff enforces the first half of this through `banned-api` in `engine/pyproject.toml`, which rejects importing either credential class anywhere except `app/engine_access.py`. Managed identity credentials, used for Cosmos DB and the App Service configuration, belong to a separate identity and aren't affected.

## Container Base Images

Pin each base image to a Python version and an operating system release, and nothing finer. `python:3.12-slim-trixie` is the pattern to follow: Python 3.12 on Debian 13, with whatever patch release and security fixes are current when the image is built.

Each of the alternatives fails in its own way. A tag such as `python:3.11-slim` follows whichever Debian release is current, so when Debian 13 came out, Azure IPAM's App Service images quietly moved onto it at their next build without anything in this repository changing. Pin a patch release or an image digest instead, and security fixes stop arriving at all until someone remembers the pin is there. Pinning to the Python version and operating system release sits between the two: routine updates arrive on their own, and the big changes only happen when someone decides they should.

The Function App image is the one exception. Microsoft doesn't publish an operating system variant of `azure-functions/python:4-python3.12-appservice`, so it runs on whichever release Microsoft chooses, Debian 12 at the moment. It's worth checking which one whenever you revisit the images.

Each tag lives in more than one place, and they all need to change together:

- `Dockerfile.deb`, `Dockerfile.rhel` and `Dockerfile.func`, both at the repository root and under `engine/`
- The `containerMap` in `deploy/deploy.ps1`, `update/update.ps1` and `migrate/migrate.ps1`
- `engine/Dockerfile.dev` and the engine dev container

The scripts are the easy ones to miss. When they build into a private registry they pass their own image as a build argument, which overrides the default in the Dockerfile, so a script that gets left behind keeps building on the old image. Nothing fails. The only sign is a private deployment running a different Python version or operating system from the published images.

The tags also carry the Python version, so they need to move whenever the `python` value in `engine/app/version.json` does. That file sets the Python version for the rest of Azure IPAM, but an image tag has no way to read it.

There's no need to check the images on a schedule. Revisit them when the Python version is about a year from the end of its App Service support (`az webapp list-runtimes --os-type linux` lists the dates), when the Debian or RHEL release is nearing the end of its own support, or when Microsoft moves the Function App image to a new release.

Before you change a tag, confirm the new one exists for every image, because they don't all follow the same naming. Microsoft publishes the Python 3.11 Function App image with a `-bookworm` suffix, for example, but there's no such tag for 3.12. `docker buildx imagetools inspect <image>` checks a tag without pulling it.
