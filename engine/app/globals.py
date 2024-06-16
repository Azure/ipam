import os
import json
import aiohttp

from azure.core.pipeline.transport import AioHttpTransport

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

AZURE_ENV_MAP = {
    'AZURE_PUBLIC': {
        'AZURE_ARM': 'management.azure.com',
        'AZURE_MGMT': 'management.core.windows.net',
        'AUTH_HOST': 'login.microsoftonline.com'
    },
    'AZURE_US_GOV': {
        'AZURE_ARM': 'management.usgovcloudapi.net',
        'AZURE_MGMT': 'management.core.usgovcloudapi.net',
        'AUTH_HOST': 'login.microsoftonline.us'
    },
    'AZURE_US_GOV_SECRET': {
        'AZURE_ARM': 'management.azure.microsoft.scloud',
        'AZURE_MGMT': 'management.azure.microsoft.scloud',
        'AUTH_HOST': 'login.microsoftonline.microsoft.scloud'
    },
    'AZURE_GERMANY': {
        'AZURE_ARM': 'management.microsoftazure.de',
        'AZURE_MGMT': 'management.core.cloudapi.de',
        'AUTH_HOST': 'login.microsoftonline.de'
    },
    'AZURE_CHINA': {
        'AZURE_ARM': 'management.chinacloudapi.cn',
        'AZURE_MGMT': 'management.core.chinacloudapi.cn',
        'AUTH_HOST': 'login.chinacloudapi.cn'
    }
}

class Globals:
    def __init__(self):
        conn = aiohttp.TCPConnector(limit=100)
        session = aiohttp.ClientSession(connector=conn)
        self.shared_transport = AioHttpTransport(session=session, session_owner=False)

    @property
    def IPAM_VERSION(self):
        return json.load(open(os.path.join(ROOT_DIR, "version.json")))['app']

    @property
    def MANAGED_IDENTITY_ID(self):
        return os.environ.get('MANAGED_IDENTITY_ID')

    @property
    def CLIENT_ID(self):
        return os.environ.get('CLIENT_ID') or os.environ.get('ENGINE_APP_ID')

    @property
    def CLIENT_SECRET(self):
        return os.environ.get('CLIENT_SECRET') or os.environ.get('ENGINE_APP_SECRET')

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

    # @property
    # def ROOT_MGMT_GROUP(self):
    #     return self.root_mgmt_group

    @property
    def AZURE_ARM_URL(self):
        azure_env = os.environ.get('AZURE_ENV')

        azure_arm_url = AZURE_ENV_MAP[azure_env]['AZURE_ARM'] if azure_env in AZURE_ENV_MAP else AZURE_ENV_MAP['AZURE_PUBLIC']['AZURE_ARM']

        # return 'https://{}/user_impersonation'.format(azure_arm_url)
        return azure_arm_url

    @property
    def AZURE_ENV(self):
        azure_env = os.environ.get('AZURE_ENV')

        return azure_env if azure_env else 'AZURE_PUBLIC'

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
    
    @property
    def SHARED_TRANSPORT(self):
        return self.shared_transport
    
    @property
    def DEPLOYMENT_STACK(self):
        ipam_stack = ""

        if os.environ.get('WEBSITE_SITE_NAME'):
            if os.environ.get('FUNCTIONS_WORKER_RUNTIME'):
                ipam_stack = "Function"
            else:
                ipam_stack = "App"

            if os.environ.get('WEBSITE_STACK'):
                if os.environ.get('WEBSITE_STACK') == 'DOCKER':
                    ipam_stack += "Container"
                else:
                    ipam_stack += "Native"
            else:
                ipam_stack = "LegacyCompose"
        elif os.environ.get('CONTAINER_APP_HOSTNAME'):
            ipam_stack = "ContainerApp"
        elif os.environ.get('KUBERNETES_SERVICE_HOST'):
            ipam_stack = "Kubernetes"
        elif os.path.exists('/.dockerenv'):
            ipam_stack = "Docker"
        else:
            ipam_stack = "Unknown"

        return ipam_stack

globals = Globals()
