import os

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

globals = Globals()
