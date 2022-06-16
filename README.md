<!--
---
page_type: sample
languages:
- python
products:
- azure
- azure-cosmosdb
- azure-bicep
- azure-app-service-plans
- azure-app-insights
description: "IPAM - Azure IP Address Management made easy!"
---
-->

# IPAM

<!-- 
Guidelines on README format: https://review.docs.microsoft.com/help/onboard/admin/samples/concepts/readme-template?branch=master

Guidance on onboarding samples to docs.microsoft.com/samples: https://review.docs.microsoft.com/help/onboard/admin/samples/process/onboarding?branch=master

Taxonomies for products and languages: https://review.docs.microsoft.com/new-hope/information-architecture/metadata/taxonomies?branch=master
-->

IPAM is a lightweight solution developed on top of the Azure platform designed to help Azure customers manage their IP Address space easily and effectively. 

## Repo Contents

| File/folder          | Description                                                   |
|----------------------|---------------------------------------------------------------|
| `.devcontainer/`     | Dev container configuration                                   |
| `.github/`           | Bug report & issue templates                                  |
| `.vscode/`           | VSCode configuration                                          |
| `deploy/`            | Infrastructure Bicep files & PowerShell deployment scripts    |
| `docs/`              | Docsify Repo                                                  |
| `engine/`            | Engine application code                                       |
| `ui/`                | UI application code                                           |
| `.dockerignore`      | Docker related files to ignore                                |
| `.gitignore`         | Untracked Files to Ignore                                     |
| `CODE_OF_CONDUCT.md` | Microsoft Code of Conduct                                     |
| `default.conf`       | ?????????????????????????                                     |
| `default.dev.conf`   | ?????????????????????????                                     |
| `docker-compose.prod.yml` | Production Docker Compose file                           |
| `docker-compose.yml` | Development Docker Compose file                               |
| `Dockerfile`         | Development Docker Compose file                               |
| `init.sh`            | ???????????????????????????????                               |
| `LICENSE`            | MIT License                                                   |
| `README.md`          | This README File                                              |
| `SECURITY.md`        | Microsoft Open Source Security Information & Details          |
| `sshd_config`        | ???????????????????????????????                               |
| `SUPPORT.md`         | Support contact information                                   |


## Documentation
IPAM uses both [Docsify](https://docsify.js.org/) and [GitHub Pages](https://docs.github.com/en/github/working-with-github-pages) to present the project documentation, which can be found [here](https://azure.github.io/ipam/)

## Questions or Comments for the team?
The IPAM team welcomes questions and contributions from the community. We have set up a GitHub Discussions page [here](https://NEED_ACTUAL_LINK) to make it easy to engage with the IPAM team without opening an issue.

## FAQ
**Why should I use IPAM?**
You realize that you do not have a clear picture as to what is deployed into your Azure environment and connected to your private IP address space. Or, you would like a way to easily manage, assign, and track your private IP addess space usage!

**What does the roadmap for IPAM look like?**
- We are assessing leveraging Azure Container Apps for hosting the two containers that make up the IPAM application
- We are ssessing support for multiple Tenants, as today the tool is designed with a single Tenant in mind
- We are working on capturing IP address infromation for resources that support hybrid connectivity (ie Gateways)

**Who are the awesome people that built this solution??**
Matt, Harvey, Chris and Tyler are all Architects at Microsoft! We are always on the look out for interesting ways to help our customers overcome their challenges!


## Contributing
This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
