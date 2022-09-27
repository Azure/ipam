# test_capitalize.py



import pytest
from fastapi.testclient import TestClient
from app.dependencies import check_token_expired, get_admin
from app.main import app


client = TestClient(app)


fake_spaces = {
  "spaces": [
  {
        "name": "TestSpace",
        "desc": "Test Space",
        "blocks": [
            {
                "name": "TestBlock",
                "cidr": "10.0.0.0/16",
                "vnets": [
                    {
                        "id": "/subscriptions/0d475e11-cdf6-4c4a-b890-7fc9956c1a6f/resourceGroups/rg-network/providers/Microsoft.Network/virtualNetworks/spoke-d-net",
                        "active": True
                    },
                    {
                        "id": "/subscriptions/1eb2d5f0-c69b-4bdf-ba34-7bfc14f69da4/resourceGroups/rg-network/providers/Microsoft.Network/virtualNetworks/spoke-c-net",
                        "active": True
                    },
                    {
                        "id": "/subscriptions/93eb74de-8ad3-4938-96b3-a90ef1c14751/resourceGroups/rg-network/providers/Microsoft.Network/virtualNetworks/spoke-a-net",
                        "active": True
                    },
                    {
                        "id": "/subscriptions/9dde0edf-caf7-457f-868e-572f4536deb6/resourceGroups/rg-network/providers/Microsoft.Network/virtualNetworks/hub-net",
                        "active": True
                    },
                    {
                        "id": "/subscriptions/ba1c9297-be3a-44a4-b8ab-f0052a5e0ea7/resourceGroups/rg-network/providers/Microsoft.Network/virtualNetworks/spoke-b-net",
                        "active": True
                    },
                    {
                        "id": "/subscriptions/049c47c9-bb8d-4c78-b3a5-690ff00ad542/resourceGroups/demoNetworkSvcs-rg-kdqwe4vlninue/providers/Microsoft.Network/virtualNetworks/demo-vnet-kdqwe4vlninue",
                        "active": True
                    },
                    {
                        "id": "/subscriptions/049c47c9-bb8d-4c78-b3a5-690ff00ad542/resourceGroups/demoNetworkSvcs-rg-5i2idytjvtqyk/providers/Microsoft.Network/virtualNetworks/demo-vnet-5i2idytjvtqyk",
                        "active": True
                    }
                ],
                "resv": []
            }
        ]
    }]
  }


async def override_check_token_expired():
    return True

async def override_get_admin_and_set_false():
    return False   

async def override_get_admin_and_set_true():
    return True    

def mock_user_assertion():
    return 'Fake User'    

def test_get_spaces_when_expand_and_not_admin_then_raise_403_httpexception():
    app.dependency_overrides[check_token_expired] = override_check_token_expired
    app.dependency_overrides[get_admin] = override_get_admin_and_set_false
    response = client.get("/api/spaces",  headers={"authorization": "fake user"}, params={"expand": "true"})
    assert response.status_code == 403
    assert response.json() == {"error": "Expand parameter can only be used by admins."}

@pytest.mark.asyncio
async def test_get_spaces_when_expand_and_admin_true_and_vnet_matches_then_return_spaces_with_vnet(monkeypatch):
    app.dependency_overrides[check_token_expired] = override_check_token_expired
    app.dependency_overrides[get_admin] = override_get_admin_and_set_true
    
    
    fake_vnets = [{
        "id": "/subscriptions/0d475e11-cdf6-4c4a-b890-7fc9956c1a6f/resourceGroups/rg-network/providers/Microsoft.Network/virtualNetworks/spoke-d-net",
        "active": True
      }]

    async def mock_cosmos_query(*args, **kwargs):   
          return fake_spaces

    async def mock_vnet_obj(*args, **kwargs):
          return fake_vnets

    monkeypatch.setattr('app.routers.space.cosmos_query', mock_cosmos_query)
    monkeypatch.setattr('app.routers.space.arg_query', mock_vnet_obj)
    response = client.get("/api/spaces",   headers={"authorization": "fake user"}, params={"expand": "true"})

    jsonObj = response.json()
    spaceBlocks = jsonObj[0]['blocks']
    blockVNets = spaceBlocks[0]['vnets']
    
    assert response.status_code == 200
    assert jsonObj[0]['name'] == 'TestSpace'
    assert spaceBlocks[0]['name'] == 'TestBlock'
    assert blockVNets[0]['id'] == fake_vnets[0]['id'] 



@pytest.mark.asyncio
async def test_get_spaces_when_expand_and_admin_true_and_vnet_donot_matche_then_return_spaces_without_vnet(monkeypatch):
    app.dependency_overrides[check_token_expired] = override_check_token_expired
    app.dependency_overrides[get_admin] = override_get_admin_and_set_true
    
    
    fake_vnets = [{
        "id": "/subscriptions/0d475e11-cdf6-4c4a-b890-7fc9956c1a7f/resourceGroups/rg-network/providers/Microsoft.Network/virtualNetworks/spoke-d-net",
        "active": True
      }]

    async def mock_cosmos_query(*args, **kwargs):   
          return fake_spaces

    async def mock_vnet_obj(*args, **kwargs):
          return fake_vnets

    monkeypatch.setattr('app.routers.space.cosmos_query', mock_cosmos_query)
    monkeypatch.setattr('app.routers.space.arg_query', mock_vnet_obj)
    response = client.get("/api/spaces",  headers={"authorization": "fake user"}, params={"expand": "true"})

    jsonObj = response.json()
    spaceBlocks = jsonObj[0]['blocks']
    blockVNets = spaceBlocks[0]['vnets']
    assert response.status_code == 200
    assert jsonObj[0]['name'] == 'TestSpace'
    assert spaceBlocks[0]['name'] == 'TestBlock'
    assert len(blockVNets) == 0
