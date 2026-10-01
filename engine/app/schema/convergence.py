"""
Schema compatibility gate and production-slot convergence.

Two entry points, both called from the engine's startup ``lifespan``:

* ``check_compatibility()`` runs on EVERY boot, in any slot. It compares this
  build's schema version (``globals.SCHEMA_VERSION``) against the database's
  compatibility floor and decides whether this code may serve at all. This is
  what makes an accidentally-old build fail gracefully instead of misreading a
  newer database.

* ``run_convergence()`` runs ONLY on the production slot, after a swap. It walks
  the data forward to this build's schema version and updates the schema control
  document. Staging never converges, so the shared database is never mutated
  while the previous version is still live in production.
"""

from dataclasses import dataclass

from app.globals import globals
from app.logs.logs import ipam_logger as logger
from app.schema.control import read_schema_doc, write_schema_doc
from app.schema.steps import STEPS


@dataclass(frozen=True)
class CompatibilityResult:
    compatible: bool
    code_schema: int
    db_current: int
    db_min_readable: int
    detail: str


async def check_compatibility():
    """
    Compare this build's schema version to the database's compatibility floor.

    * code_schema >= db_current            -> up to date (or DB behind; will converge)
    * db_min_readable <= code < db_current -> DB is newer but only ADDITIVELY; safe
                                              (this preserves swap-back / rollback)
    * code_schema < db_min_readable        -> a breaking change happened that this
                                              build cannot read -> NOT compatible
    """

    doc = await read_schema_doc()
    current = doc["current"] if doc else 0
    min_readable = doc["minReadable"] if doc else 0
    code = globals.SCHEMA_VERSION

    compatible = code >= min_readable

    if compatible:
        detail = f"Code schema v{code} is compatible with database (current v{current}, minReadable v{min_readable})."
    else:
        detail = (
            f"Code schema v{code} is older than the database's minimum readable schema v{min_readable}. "
            "This build cannot safely read the current data. Deploy a newer build."
        )
        logger.error(detail)

    return CompatibilityResult(
        compatible=compatible,
        code_schema=code,
        db_current=current,
        db_min_readable=min_readable,
        detail=detail,
    )


async def run_convergence():
    """
    Bring the data up to this build's schema version. MUST only be called on the
    production slot. Idempotent: applies only steps newer than the recorded
    ``current`` and is a no-op when already up to date.
    """

    doc = await read_schema_doc()
    current = doc["current"] if doc else 0
    min_readable = doc["minReadable"] if doc else 0
    target = globals.SCHEMA_VERSION

    if target <= current:
        logger.info("Database schema already at v{}; no convergence needed.", current)
        return

    for step in STEPS:
        if step.version <= current:
            continue

        if step.version > target:
            break

        logger.warning(
            "Converging schema to v{} ({}, {})...",
            step.version,
            step.name,
            "breaking" if step.breaking else "additive",
        )

        await step.apply()

        current = step.version

        if step.breaking:
            min_readable = step.version

        await write_schema_doc(current, min_readable)

        logger.warning("Converged to schema v{}.", step.version)
