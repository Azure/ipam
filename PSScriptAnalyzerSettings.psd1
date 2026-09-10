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

    Rules = @{
        # Enforce consistent casing across the scripts. This keeps cmdlet and parameter
        # names aligned with their canonical metadata casing (e.g. Get-AzContext,
        # -ResourceGroupName) and language keywords lowercase (function, param, if,
        # foreach), matching the Microsoft-recommended style already applied to
        # deploy.ps1, update.ps1, and migrate.ps1. This rule is Information severity,
        # so it surfaces suggestions without affecting the Warning/Error count.
        PSUseCorrectCasing = @{
            Enable        = $true
            CheckCommands = $true
            CheckKeyword  = $true
            CheckOperator = $true
        }

        # Enforce the one-true-brace style already used throughout these scripts
        # (opening brace on the same line, followed by a newline). Purely a guard
        # against future regressions; the current code fully conforms.
        PSPlaceOpenBrace = @{
            Enable             = $true
            OnSameLine         = $true
            NewLineAfter       = $true
            IgnoreOneLineBlock = $true
        }

        # The scripts declare #Requires -Version 7.2 and use PowerShell 7 syntax
        # (ternary, null-coalescing). This guards against accidentally introducing
        # syntax that would not run on the declared minimum version.
        PSUseCompatibleSyntax = @{
            Enable         = $true
            TargetVersions = @('7.2')
        }

        # Disallow a trailing semicolon used as a line terminator (e.g. "$x = 1;"),
        # which is redundant in PowerShell and hurts readability.
        PSAvoidSemicolonsAsLineTerminators = @{
            Enable = $true
        }
    }
}
