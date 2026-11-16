# Questions or Comments

The Azure IPAM team welcomes engagement and contributions from the community. Whether you have a question, an idea for a new feature, or have found a bug, there are several ways to get in touch.

## Discussions

We have set up a [GitHub Discussions](https://github.com/Azure/ipam/discussions) page to make it easy to engage with the Azure IPAM team without opening an issue. This is the best place for:

- General questions about Azure IPAM usage or configuration
- Sharing tips or patterns with other community members

## Issues

If you encounter a bug or have a feature request, please open a [GitHub Issue](https://github.com/Azure/ipam/issues) and someone from the team will respond as soon as possible. For bug reports, please include:

- A description of the problem and any error messages observed
- The steps taken leading up to the issue, and whether it can be reproduced
- Your deployment type (App Service or Function App) and container image variant (Debian or RHEL)
- How it was deployed, including anything that differs from a standard `deploy.ps1` deployment, such as App Registrations created manually, images you built yourself, or a reverse proxy in front of Azure IPAM
- Whether you were using the UI or the API, and whether you're an Azure IPAM administrator

From Azure IPAM, open **About** from the avatar menu in the upper right and select **Report an issue** to open a bug report with your environment details already filled in, or select the copy icon next to the details to paste them somewhere else.

To suggest an improvement, use the [Feature Request](https://github.com/Azure/ipam/issues/new?template=feature_request.yml) form. Describe the problem you're trying to solve, who it's for (administrators, other users, or automation), and whether it applies to the UI, the API, or both. If someone has already requested it, add a 👍 reaction or a comment describing your use case instead of opening a new issue.

## Contributing

Interested in contributing code, documentation, or other improvements? See the [Contributing](/contributing/README) guide for the process, and [Development](/development/README) for setting up a development environment and building container images.
