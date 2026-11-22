# Questions or Comments

The Azure IPAM team welcomes engagement and contributions from the community. Whether you have a question, an idea for a new feature, or have found a bug, there are several ways to get in touch.

## Discussions

Use [GitHub Discussions](https://github.com/Azure/ipam/discussions) to talk with the Azure IPAM team without opening an issue. It's the best place for:

- General questions about Azure IPAM usage or configuration
- Sharing tips or patterns with other community members

## Issues

If you find a bug or want to request a feature, open a [GitHub issue](https://github.com/Azure/ipam/issues), and someone from the team will respond as soon as possible. For bug reports, please include:

- A description of the problem and any error messages observed
- The steps taken leading up to the issue, and whether it can be reproduced
- Your deployment type (App Service or Function App) and container image variant (Debian or RHEL)
- How it was deployed, including anything that differs from a standard `deploy.ps1` deployment, such as app registrations created manually, images you built yourself, or a reverse proxy in front of Azure IPAM
- Whether you were using the UI or the API, and whether you're an Azure IPAM administrator

In Azure IPAM, open **About** from the avatar menu in the upper-right corner and select **Report an issue** to open a bug report with your environment details already filled in. Or select **Copy diagnostics** to copy the details and paste them somewhere else.

To suggest an improvement, use the [Feature Request](https://github.com/Azure/ipam/issues/new?template=feature_request.yml) form. Describe the problem you're trying to solve, who it's for (administrators, other users, or automation), and whether it applies to the UI, the API, or both. If someone has already requested it, add a 👍 reaction or a comment describing your use case instead of opening a new issue.

## Contributing

Interested in contributing code, documentation, or other improvements? See the [Contributing](/contributing/README.md) guide for the process, and [Development](/development/README.md) for setting up a development environment and building container images.
