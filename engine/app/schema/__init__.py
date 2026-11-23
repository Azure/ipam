"""Schema compatibility gate + production-slot convergence for the Azure IPAM engine."""

from app.schema.convergence import (
    CompatibilityResult,
    check_compatibility,
    run_convergence,
)

__all__ = ["CompatibilityResult", "check_compatibility", "run_convergence"]
