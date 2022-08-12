import os

from azure.identity import ClientSecretCredential
from azure.core.exceptions import HttpResponseError
from azure.mgmt.managementgroups import ManagementGroupsAPI

from azure.identity import AzureAuthorityHosts

AZURE_ENV_MAP = {
    'AZURE_PUBLIC': {
      'AZURE_ARM': 'management.azure.com',
      'AUTH_HOST': AzureAuthorityHosts.AZURE_PUBLIC_CLOUD
    },
    'AZURE_US_GOV': {
      'AZURE_ARM': 'management.usgovcloudapi.net',
      'AUTH_HOST': AzureAuthorityHosts.AZURE_GOVERNMENT
    },
    'AZURE_GERMANY': {
      'AZURE_ARM': 'management.microsoftazure.de',
      'AUTH_HOST': AzureAuthorityHosts.AZURE_GERMANY
    },
    'AZURE_CHINA': {
      'AZURE_ARM': 'management.chinacloudapi.cn',
      'AUTH_HOST': AzureAuthorityHosts.AZURE_CHINA
    }
}

class Globals:
    def __init__(self):
        client_creds = ClientSecretCredential(self.TENANT_ID, self.CLIENT_ID, self.CLIENT_SECRET, authority=self.AUTHORITY_HOST)
        mgmt_group_api = ManagementGroupsAPI(client_creds)
        target_group = mgmt_group_api.management_groups.get(os.environ.get('TENANT_ID'))

        self.root_mgmt_group = target_group.name

    @property
    def CLIENT_ID(self):
        return os.environ.get('CLIENT_ID')

    @property
    def CLIENT_SECRET(self):
        return os.environ.get('CLIENT_SECRET')

    @property
    def TENANT_ID(self):
        return os.environ.get('TENANT_ID')

    @property
    def COSMOS_URL(self):
        return os.environ.get('COSMOS_URL')

    @property
    def COSMOS_KEY(self):
        return os.environ.get('COSMOS_KEY')

    @property
    def KEYVAULT_URL(self):
        return os.environ.get('KEYVAULT_URL')

    @property
    def ROOT_MGMT_GROUP(self):
        return self.root_mgmt_group

    @property
    def AZURE_ARM_URL(self):
        azure_env = os.environ.get('AZURE_ENV')

        azure_arm_url = AZURE_ENV_MAP[azure_env]['AZURE_ARM'] if azure_env in AZURE_ENV_MAP else AZURE_ENV_MAP['AZURE_PUBLIC']['AZURE_ARM']

        return 'https://{}/user_impersonation'.format(azure_arm_url)

    @property
    def AUTHORITY_HOST(self):
        azure_env = os.environ.get('AZURE_ENV')

        azure_auth_host = AZURE_ENV_MAP[azure_env]['AUTH_HOST'] if azure_env in AZURE_ENV_MAP else AZURE_ENV_MAP['AZURE_PUBLIC']['AUTH_HOST']

        return azure_auth_host

    @property
    def DATABASE_NAME(self):
        db_name = os.environ.get('DATABASE_NAME')

        return db_name if db_name else 'ipam-db'

    @property
    def CONTAINER_NAME(self):
        ctr_name =  os.environ.get('CONTAINER_NAME')

        return ctr_name if ctr_name else 'ipam-ctr'

globals = Globals()
