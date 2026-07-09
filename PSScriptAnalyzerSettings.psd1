@{
    # Repo-wide PSScriptAnalyzer configuration for the Azure IPAM PowerShell scripts
    # (deploy.ps1, update.ps1, migrate.ps1, and tooling).
    #
    # The rules excluded below are deliberate, documented design choices for these
    # interactive, admin-run CLI scripts — not defects. Genuine issues (e.g. unused
    # pipeline bindings) are fixed in code, and narrowly-scoped exceptions (e.g. a
    # specific function that uses an accepted collective noun) are handled with an
    # inline [Diagnostics.CodeAnalysis.SuppressMessageAttribute()] on that function
    # rather than a repo-wide exclusion, so the rule still catches new violations.

    ExcludeRules = @(
        # These scripts are interactive CLIs whose colored status output IS the intended
        # user experience. Since PowerShell 5.0, Write-Host writes to the Information
        # stream and is captured by Start-Transcript, so it is the correct tool here.
        'PSAvoidUsingWriteHost'

        # The state-changing helper functions (e.g. Restart-IpamApp, Set-HealthCheck,
        # Update-IpamInfrastructure) are internal to these scripts — not exported cmdlets.
        # Consent is obtained via explicit Get-UserConfirmation prompts plus a -Force
        # switch, rather than ShouldProcess / -WhatIf / -Confirm.
        'PSUseShouldProcessForStateChangingFunctions'

        # The scripts require PowerShell 7.2+ (#Requires -Version 7.2), where UTF-8
        # without a BOM is read correctly and is the modern, git-friendly default.
        # A byte-order mark is intentionally not used.
        'PSUseBOMForUnicodeEncodedFile'
    )
}
