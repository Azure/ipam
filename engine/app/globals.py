import os

AZURE_ENV_MAP = {
    "AZURE_PUBLIC": "management.azure.com",
    "AZURE_US_GOV": "management.usgovcloudapi.net",
    "AZURE_GERMANY": "management.microsoftazure.de",
    "AZURE_CHINA": "management.chinacloudapi.cn"
}

class Globals:
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
    def AZURE_ARM_URL(self):
        azure_env = os.environ.get('AZURE_ENV')

        azure_arm_url = AZURE_ENV_MAP[azure_env] if azure_env in AZURE_ENV_MAP else AZURE_ENV_MAP['AZURE_PUBLIC']

        return "https://{}/user_impersonation".format(azure_arm_url)

    @property
    def DATABASE_NAME(self):
        db_name = os.environ.get('DATABASE_NAME')

        return db_name if db_name else 'ipam-db'

    @property
    def CONTAINER_NAME(self):
        ctr_name =  os.environ.get('CONTAINER_NAME')

        return ctr_name if ctr_name else 'ipam-ctr'

globals = Globals()
