# Welcome to IPAM!

<!-- 
Guidelines on README format: https://review.docs.microsoft.com/help/onboard/admin/samples/concepts/readme-template?branch=master

Guidance on onboarding samples to docs.microsoft.com/samples: https://review.docs.microsoft.com/help/onboard/admin/samples/process/onboarding?branch=master

Taxonomies for products and languages: https://review.docs.microsoft.com/new-hope/information-architecture/metadata/taxonomies?branch=master
-->

## IPAM Overview and Architecture
IPAM was developed to give customers a simple, straightforward way to manage their private IP address space. IPAM is completely serverless in design leveraging App Service Plans and CosmosDB to provide this capability. The IPAM application/service runs on a scheduled loop (customer can customize the timing) and will query for all network objects deployed at a given scope. This information is then stored in CosmosDB as a JSON document and can then be retrieved and queried against.

MORE DETAIL. NEED ACTUAL ARCHITECTURE.

![IPAM Architecture](./images/ipam_new.png)


## Prerequisites
To successfully deploy this project, it requires the Azure user have the following:

- Azure Subscription
- Azure RBAC Role at the Subscription scope of:
    - Owner
    - Contributor + User Access Aministrator
    - _necessary to assign role to IPAM_


## Deploying IPAM
### Steps to deploy IPAM infrastructure:
1. Deploy directly to Azure using the button below.

[![Deploy To Azure](https://aka.ms/deploytoazurebutton)](https://NEED_REAL_LINK)


2. Provide the required values in the deployment template, then click 'Next' to proceed to the Advanced settings, or click 'Review + Create' to accept the default IPAM values.


## Running IPAM
IPAM is currently configured to run in the context of...


## IPAM Infrastructure Overview
### What gets deployed with IPAM?

When initially deploying IPAM, you can expect the following resources to be included:
- **Resource Group** 
    - You _can_ bring an existing resource group
    - Deployment will create a new resource group if one does not already exist
- **System Assigned Managed Identity**
    - Managed Identity for the App Service Plan will have the following permissions
- **App Service Plan**
    - Linux App Service Plan to host:
        - Python API
- **Application Insights**
    - Application Insights for the above App Service Plan
- **App Configuration**
    - App configuration store for IPAM runtime variables
        - Allows for configuration adjustments to IPAM without the need to redeploy
            - Cosmos connection string values
            - Storage account settings
            - Debug flag for troubleshooting

#### Optional Alerting
During the deployment process, you also have the option to deploy additional alerting infrastructure that will be used to send notifications in the event of any IPAM errors. The user will need to check the box to enable email alerting, and then enter the names and email addresses of the users that will need to receive the notifications:

![Optional Alerting](./images/alert_detail.png)

**_Please see the [Monitoring & Alerting](/monitoring/README.md) section in the documentation for more details_**


### Security considerations
For the purpose of this project, we have not integrated a complete set of security features into IPAM. This solution is currently in an alpha phase and is not hardened from a security aspect. To use this service in a production deployment it is recommended to review the following documentation from Azure. They walk though best practices on securing the various parts of the required Azure infrastructure:
- [Securing App Service Plans](https://docs.microsoft.com/en-us/azure/app-service/security-recommendations)
- [Securing Cosmos DB](https://docs.microsoft.com/en-us/azure/cosmos-db/database-security?tabs=sql-api)

**_IT IS RECOMMENDED TO USE THE AVAILABLE SECURITY CONTROLS FOR ANY PRODUCTION DEPLOYMENTS_**


## Questions or Comments
The IPAM team welcomes engagement and contributions from the community. We have set up a GitHub Discussions page [here](https://github.com/Azure/ipam/discussions) to make it easy to engage with the IPAM team without opening an issue.


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
