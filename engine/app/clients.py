import asyncio
import hashlib
import json

from collections import OrderedDict
from datetime import datetime, timedelta

from azure.identity.aio import OnBehalfOfCredential, ClientSecretCredential

from app.globals import globals

class ClientFactory():
    def __init__(self):
        self.client_db = []
        self.watcher_task = asyncio.create_task(self.__watcher(60))

    def get_client(self, type, token, **kwargs):
        hash_data = self.__generate_hash(token, **kwargs)
        exists = next((x for x in self.client_db if (isinstance(x.client, type) and x.hash == hash_data)), None)

        if exists:
            exists.renew()

            return exists
        else:
            new_client = Client(type, token, hash_data, **kwargs)
            self.client_db.append(new_client)

            return new_client

    def __generate_hash(self, token, **kwargs):
        kwargs_keys = list(kwargs.keys())
        kwargs_keys.sort()

        sorted_kwargs = OrderedDict({i: kwargs[i] for i in kwargs_keys})
        kwargs_json = json.dumps(sorted_kwargs)

        hash_data = token + kwargs_json
        hash = hashlib.md5(hash_data.encode()).hexdigest()

        return hash

    async def __prune(self):
        for client in self.client_db:
            if client.expire < datetime.now():
                self.client_db.remove(client)
                del client

    async def __watcher(self, interval):
        while True:
            await asyncio.gather(
                asyncio.sleep(interval),
                self.__prune()
            )

    def __del__(self):
        self.watcher_task.cancel()

class Client():
    def __init__(self, type, token, hash_data, **kwargs):
        if token == "admin":
            self.credentials = ClientSecretCredential(globals.TENANT_ID, globals.CLIENT_ID, globals.CLIENT_SECRET, authority=globals.AUTHORITY_HOST)
        else:
            self.credentials = OnBehalfOfCredential(globals.TENANT_ID, globals.CLIENT_ID, client_secret=globals.CLIENT_SECRET, user_assertion=token, authority=globals.AUTHORITY_HOST)

        azure_arm_url = 'https://{}'.format(globals.AZURE_ARM_URL)
        azure_arm_scope = '{}/.default'.format(azure_arm_url)

        self.client = type(
            credential=self.credentials,
            base_url=azure_arm_url,
            credential_scopes=[azure_arm_scope],
            **kwargs
        )

        self.hash = hash_data
        self.renew()

    def renew(self):
        self.expire = datetime.now() + timedelta(seconds = 60)

    def __del__(self):
        try:
            loop = asyncio.get_event_loop()

            if loop.is_running():
                loop.create_task(self.client.close())
                loop.create_task(self.credentials.close())
            else:
                loop.run_until_complete(self.client.close())
                loop.run_until_complete(self.credentials.close())
        except Exception:
            pass

client_factory = ClientFactory()
