"""
Low-level plumbing for the schema model: access to the Cosmos container and the
single ``schema`` control document that records where the data currently sits.

The schema document is a compatibility *floor*, not just a version stamp:

    { "current": <int>, "minReadable": <int> }

* ``current``     — the schema version the data has been converged to.
* ``minReadable`` — the oldest code schema version that can still safely read the
                    data. Additive convergence leaves this untouched (so older
                    code, e.g. after a swap-back, keeps working); only a breaking
                    convergence raises it.

The document lives in the same container as everything else, partitioned by
``tenant_id``, with a dedicated ``type`` ("schema") so type-filtered queries
never pick it up.
"""

from datetime import datetime, timezone

from azure.cosmos.exceptions import CosmosResourceNotFoundError

from app.globals import globals
from app.routers.common.helper import get_cosmos_client

SCHEMA_DOC_ID = "schema"


def _now():
    return datetime.now(timezone.utc)


def _iso(value):
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def _container():
    client = get_cosmos_client()
    database = client.get_database_client(globals.DATABASE_NAME)

    return database.get_container_client(globals.CONTAINER_NAME)


async def read_schema_doc():
    """
    Return ``{"current": int, "minReadable": int}`` or ``None`` when the database
    is unversioned (pre-v4, no schema document yet).
    """

    try:
        doc = await _container().read_item(SCHEMA_DOC_ID, partition_key=globals.TENANT_ID)

        return {
            "current": int(doc.get("current", 0)),
            "minReadable": int(doc.get("minReadable", 0)),
        }
    except CosmosResourceNotFoundError:
        return None


async def write_schema_doc(current, min_readable):
    """Upsert the schema control document."""

    doc = {
        "id": SCHEMA_DOC_ID,
        "type": "schema",
        "tenant_id": globals.TENANT_ID,
        "current": int(current),
        "minReadable": int(min_readable),
        "appVersion": globals.IPAM_VERSION,
        "updatedOn": _iso(_now()),
    }

    await _container().upsert_item(doc)
