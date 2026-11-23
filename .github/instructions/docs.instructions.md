---
applyTo: "docs/**"
description: "Writing style, tone and formatting rules for the Azure IPAM documentation"
---

# Azure IPAM Documentation Style Guide

Follow these rules whenever you write or edit anything under `docs/`. The docs are published with Docsify at <https://azure.github.io/ipam/> and are also read directly on GitHub, so everything must render correctly in both.

When something isn't covered here, follow the [Microsoft Writing Style Guide](https://learn.microsoft.com/style-guide/welcome/).

## Voice and Tone

- Write to the reader as "you", in the present tense. Use the imperative for steps: "Select **Save**", not "You will want to select **Save**".
- Use "we" only when speaking for the Azure IPAM project team ("We publish the container images to a public registry"). Don't use the tutorial "we" ("We'll be performing a POST").
- Use common contractions (you'll, don't, isn't, it's). Avoid unusual ones (it'd, should've, there'll).
- Lead with what the reader needs to do or know. Put background after it, not before it.
- When a step or rule isn't obvious, explain why in one short sentence. Don't explain things that are obvious.
- Keep sentences short. If a sentence has more than one comma-separated clause plus a dash, split it.
- Be plain and direct. Avoid marketing language ("seamlessly", "powerful", "simply"), filler ("First things first", "It's worth noting that") and dramatic phrasing ("quietly lied", "the hard way").
- Don't use "please" in instructions. Use it only when asking the reader for something that's genuinely an imposition, such as including logs in a bug report.
- Don't end a section with a sentence that only restates what the section already said.
- Describe what the reader can do and why, not the current layout of the UI. Don't list menus, tabs or pages to describe what a role can access, since they change as the UI does.
- Describe the design and what goes wrong when it isn't followed. Don't recount past bugs.
- Use US English spelling: fulfill, canceled, labeled, honor. When quoting a UI label, an error message or an API value, copy it exactly as the product shows it.
- Don't put a comma before the final "and" or "or" in a list: "letters, numbers, hyphens and periods". The same applies to UI text and API error messages.

## Terminology

Use the term in the left column. Match labels shown in the UI exactly, even when they differ from the preferred prose term.

| Use | Not | Notes |
|-----|-----|-------|
| Azure IPAM | IPAM (on its own) | |
| Azure IPAM administrator | IPAM admin, IPAM Administrator, admin | "administrator" is lowercase in prose |
| Microsoft Entra ID | Azure AD, Azure Active Directory, AAD | "Entra ID" is fine after the first mention in a section |
| virtual network | vNET, VNet, Virtual Network | Use **vNets** only when referring to the UI tab |
| virtual hub | vHUB, vHub | Use **vHubs** only when referring to the UI tab |
| Root Management Group | Tenant Root Management Group | Use *Tenant Root Group* only in Azure portal steps, where that's the label |
| Azure portal | Azure Portal | |
| App Service, Function App | App Services, Azure Function (for the deployed app) | |
| Key Vault, Cosmos DB | KeyVault, CosmosDB | |
| Engine, UI | engine app, ui app | Capitalize when referring to the two app registrations |
| Space, Block, External Network, Reservation | space, block | Capitalize Azure IPAM resource types |
| fulfill, fulfilled | fulfil, fulfils | |
| canceled, canceling | cancelled, cancelling | |
| select | click, click on | For any UI element |
| sign in | log in, login (verb) | "Signed-in user", not "logged in user" |
| for example | e.g., eg | |
| that is | i.e. | |
| parameter | flag | For PowerShell script and cmdlet parameters |
| cmdlet | commandlet | |

## Headings

- Use Title Case for all headings.
- Use one `#` heading per page. Don't skip heading levels.
- Don't start a heading with a number ("### 1. Discovery"), and don't use `&` in a heading (write "and"). Docsify and GitHub build different anchors for these headings, so a link to one works on one site and breaks on the other. Use a numbered list in the body instead of numbered headings.
- Use plain text in headings, with no HTML (`<u>`, `<small>`).
- Don't prefix headings with labels such as "Issue:" or "Q:".
- Keep the same heading text for the same content across pages (see [Repeated Sections](#repeated-sections)).
- Before renaming a heading or moving a page, search `engine/app` for `azure.github.io`. The engine links directly to several pages and headings (for example `/how-to/README?id=managing-administrators` and `/maintenance/README?id=rotate-the-secret`), so those links must be updated in the same change.

## Notes and Callouts

Use a blockquote with a bold, all-caps label, with the colon inside the bold:

```markdown
> **NOTE:** Text of the note.
```

Allowed labels:

- **NOTE:** Useful information the reader might otherwise miss
- **TIP:** An optional shortcut or better way to do something
- **IMPORTANT:** Something the reader must do or know for the task to succeed
- **WARNING:** Something that can cause data loss, downtime or a security problem

Don't use other labels (Shortcut, Caution), mixed-case labels (`**Note:**`, `**Note**:`), or Docsify (`?>`, `!>`) and GitHub (`> [!NOTE]`) alert syntax.

For footnotes on a parameter table, mark the cell with `**<sup>1</sup>**` and add numbered notes directly below the table:

```markdown
> **NOTE 1:** Text of the first footnote.
```

## UI Elements

- Put UI labels in bold, spelled and capitalized exactly as they appear: **Save**, **Force Delete**, **Configure**.
- Write navigation paths with `→` between bold items: **Configure** → **Basics**.
- Refer to an icon button by its name in bold, such as the **Actions** menu, using its tooltip or, if it has none, its accessible name. Don't use symbols or describe the icon's shape. If the button has no visible label, say where it is the first time it comes up.
- Use "select" for every UI interaction.
- Put error messages and notification text in italics, quoted exactly as the product or Azure shows them.

## Code and Commands

- Tag every code block with a language: `powershell`, `bash` (for Azure CLI and shell commands), `json`, `jsonc`, `hcl`, `python`, or `text` (for output). Don't use `shell`.
- Don't include prompts (`PS C:\>`, `$`) in commands the reader might copy. To show where the reader is, use a comment above the command (`# Change to the Deploy Folder`). If you need to show output, put it in a separate `text` block.
- Write one PowerShell example that works on both Windows and Linux, using `/` in paths (`./deploy.ps1`, `cd ./ipam/deploy`), rather than separate examples for each.
- Label the parts of a longer example with a comment above each command, in Title Case: `# Sign in Interactively`.
- Comments that explain something, rather than label a step, are full sentences in sentence case: `# Key Vault only accepts whole seconds, so drop any fraction of a second`. Put each sentence on its own comment line.
- Don't end a code comment with a period.
- Don't use fake values that look real but are invalid, such as a GUID containing `k` or `g`.
- PowerShell examples must run on PowerShell 7.2 or later with the Azure PowerShell version listed in the deployment prerequisites. If an example needs something newer, say so above it.
- For Azure CLI tokens, use `--scope "<scope>/.default"`, not `--resource`.
- Show both Azure PowerShell and Azure CLI where both are practical, PowerShell first, under `####` headings named **Azure PowerShell** and **Azure CLI** (and **Azure Portal** when a portal method is shown, listed first).
- Prefer cmdlets and `az` commands over calling a REST API, since they follow whichever cloud the reader signed in to. For Azure Resource Manager, use `Invoke-AzRestMethod -Path` and pass a resource ID to `az rest --url`, which both resolve against the signed-in cloud. For any other REST API, such as Microsoft Graph, take the host from the signed-in cloud with `(Get-AzContext).Environment` or `az cloud show` rather than hard-coding a public cloud address like `graph.microsoft.com`, which fails in sovereign clouds.
- Use inline code for parameters (`-ResourceGroupName`), API paths (`/api/spaces`), app settings (`ENGINE_APP_ID`), file paths and values.
- Write API paths in full the first time they appear on a page (`/api/spaces/{space}/blocks/{block}/networks`).
- Check every example against the current code before publishing.

## Placeholders and Sample Values

- Put any value the reader must replace in angle brackets, in lowercase kebab case, inside double quotes: `-ResourceGroupName "<your-ipam-rg>"`. Without the quotes, PowerShell rejects the `<` and bash reads `<` and `>` as redirection. Quoting also means values containing spaces still work once filled in.
- Start a placeholder with `your-ipam-` when it means a resource that's part of the reader's Azure IPAM deployment. Use a plain descriptive name for anything else, such as the resource group of a virtual network: `<vnet-rg>`.
- Don't write placeholders as bare values such as `"your-ipam-app"`. They look real and are easy to run without replacing.
- Use these names for common values:

  | Placeholder | Meaning |
  |-------------|---------|
  | `<your-ipam-rg>` | Resource group containing Azure IPAM |
  | `<your-ipam-app>` | Azure IPAM App Service or Function App |
  | `<your-ipam-kv>` | Azure IPAM Key Vault |
  | `<your-ipam-cosmos>` | Azure IPAM Cosmos DB account |
  | `<your-ipam-acr>` | Azure IPAM private container registry |
  | `<your-ipam-host>` | Host name of the Azure IPAM site, such as `ipam.contoso.com` |
  | `<subscription-id>` | Subscription ID |
  | `<subscription-name-or-id>` | Subscription name or ID, where either is accepted |
  | `<tenant-id>` | Microsoft Entra tenant ID |
  | `<engine-app-id>`, `<ui-app-id>` | Application (client) IDs of the Engine and UI app registrations |

  For anything else, follow the same pattern: `<vnet-name>`, `<subnet-name>`, `<reservation-id>`.
- Lines labeled "Example with…" show realistic values, such as `"Contoso IPAM Subscription"` or a correctly formatted GUID, so the reader can see what a real value looks like.
- Sample output and API responses show realistic values, except IDs that are unique to the reader's environment or to a single request (app IDs, trace IDs, correlation IDs), which use the placeholder names above.
- API path templates use the curly-brace form shown in the API documentation: `/spaces/{space}/blocks/{block}`.

## Links

- Link to Microsoft documentation at `https://learn.microsoft.com/...`, without a locale (`/en-us/`).
- Link to other Azure IPAM pages with an absolute path including `.md`: `/deployment/README.md#prerequisites`. Don't use `?id=`, omit `.md`, or link to the published site URL.
- Use the destination's title or a description as the link text. Don't use "here", "this link" or "documentation" on its own.
- Check that anchors exist on the target page.

## Lists and Tables

- Use a numbered list for steps that must happen in order, and bullets otherwise.
- End list items with a period only when they're complete sentences. Don't mix both styles in one list.
- For a term followed by its description, write `**Term:** Description`.
- Parameter tables use the columns **Parameter**, **Type**, **Required** and **Description**.
- Use em dashes sparingly, no more than one per paragraph, and type the `—` character (not `&mdash;` or `--`).

## Page Structure

- Open each page with one or two sentences saying what it covers and who it's for.
- Troubleshooting entries use a `##` heading naming the error or symptom, followed by `###` **Symptoms**, **Verify**, **Resolve** and **Notes** sections, in that order.
- Don't leave TODO comments or placeholder text in published pages.

## Repeated Sections

The deployment, update and migration guides each contain the same three setup sections. Keep them identical in all three guides; only the folder name and script name change. When you edit one, make the same change to the other two.

- **Authenticate to Azure PowerShell**
- **Authenticate to Azure CLI**
- **Clone the GitHub Repo**

## Checking Your Changes

- Run markdownlint with the repo's `.markdownlint.json` and fix everything it reports: `npx markdownlint-cli2 "docs/**/*.md"`.
- Don't add `markdownlint-disable` comments. If a rule needs to change, change it in `.markdownlint.json`.
- Check that every link and anchor you added or changed resolves.
