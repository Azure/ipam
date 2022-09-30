from ast import Assert
import json
from unittest.mock import Mock
import pytest
from fastapi.testclient import TestClient
from app.dependencies import check_token_expired, get_admin
from app.main import app
from app.models import SpaceReq


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
    monkeypatch.undo()


# # Causing monkey patch leak issue
# @pytest.mark.asyncio
# async def test_get_spaces_when_expand_and_admin_true_and_vnet_donot_match_then_return_spaces_without_vnet(monkeypatch):
#     app.dependency_overrides[check_token_expired] = override_check_token_expired
#     app.dependency_overrides[get_admin] = override_get_admin_and_set_true    
    
#     unmatched_vnets = [{
#         "id": "some id that do not match",
#         "active": True
#       }]

#     async def mock_cosmos_query(*args, **kwargs):   
#           return fake_spaces

#     async def mock_vnet_obj(*args, **kwargs):
#           return unmatched_vnets

#     monkeypatch.setattr('app.routers.space.cosmos_query', mock_cosmos_query)
#     monkeypatch.setattr('app.routers.space.arg_query', mock_vnet_obj)
#     response = client.get("/api/spaces",  headers={"authorization": "fake user"}, params={"expand": "true"})

#     jsonObj = response.json()
#     spaceBlocks = jsonObj[0]['blocks']
#     blockVNets = spaceBlocks[0]['vnets']
#     assert response.status_code == 200
#     assert jsonObj[0]['name'] == 'TestSpace'
#     assert spaceBlocks[0]['name'] == 'TestBlock'
#     assert len(blockVNets) == 0
#     monkeypatch.undo()


def test_create_space_when_not_admin_then_raise_403_httpexception():
    app.dependency_overrides[check_token_expired] = override_check_token_expired
    app.dependency_overrides[get_admin] = override_get_admin_and_set_false
    response = client.post("/api/spaces", data = json.dumps({"name": "test",  "desc": "test"}))
    assert response.status_code == 403
    assert response.json() == {"error": "This API is admin restricted."}

@pytest.mark.asyncio
async def test_create_space_when_admin_but_duplicate_space_then_raise_400_httpexception(monkeypatch):
    app.dependency_overrides[check_token_expired] = override_check_token_expired
    app.dependency_overrides[get_admin] = override_get_admin_and_set_true


    async def mock_cosmos_query(*args, **kwargs):   
        return fake_spaces

    monkeypatch.setattr('app.routers.space.cosmos_query', mock_cosmos_query)

    response = client.post("/api/spaces", data = json.dumps({"name": "TestSpace",  "desc": "TestSpace"}))
    assert response.status_code == 400
    assert response.json() == {"error": "Space name must be unique."}    
    monkeypatch.undo()

@pytest.mark.asyncio
async def test_create_space_when_admin_and_not__duplicate_space_then_create_new_space(monkeypatch):
    app.dependency_overrides[check_token_expired] = override_check_token_expired
    app.dependency_overrides[get_admin] = override_get_admin_and_set_true

    test_fake_space = {"name": "Test Fake Space",  "desc": "Test Fake Space"}
    async def mock_cosmos_query(*args, **kwargs):   
        return fake_spaces

    async def mock_cosmos_upsert(*args, **kwargs):   
        return test_fake_space    

    test_mock = Mock(side_effect=mock_cosmos_upsert)
    monkeypatch.setattr('app.routers.space.cosmos_upsert', test_mock)
    monkeypatch.setattr('app.routers.space.cosmos_query', mock_cosmos_query)

    response = client.post("/api/spaces", data = json.dumps(test_fake_space))
    assert response.status_code == 201
    assert test_mock.call_count == 1
    monkeypatch.undo()

def test_get_space_when_expand_and_not_admin_then_raise_403_httpexception():
    app.dependency_overrides[check_token_expired] = override_check_token_expired
    app.dependency_overrides[get_admin] = override_get_admin_and_set_false           
    response = client.get("/api/spaces/test_fake_space",  headers={"authorization": "fake user"}, params={"expand": "true"})
    assert response.status_code == 403
    assert response.json() == {"error": "Expand parameter can only be used by admins."}

@pytest.mark.asyncio
async def test_get_space_when_admin_and_not_found_space_then_raise_400_httpexception(monkeypatch):
    app.dependency_overrides[check_token_expired] = override_check_token_expired
    app.dependency_overrides[get_admin] = override_get_admin_and_set_true

    async def mock_cosmos_query(*args, **kwargs):   
        return fake_spaces    

    monkeypatch.setattr('app.routers.space.cosmos_query', mock_cosmos_query)    
    response = client.get("/api/spaces/test_fake_space",  headers={"authorization": "fake user"}, params={"expand": "true"})
    assert response.status_code == 400
    assert response.json() == {"error": "Invalid space name."}
    monkeypatch.undo()

@pytest.mark.asyncio
async def test_get_space_when_admin_and_not_expand_and_found_space_then_return_space(monkeypatch):
    app.dependency_overrides[check_token_expired] = override_check_token_expired
    app.dependency_overrides[get_admin] = override_get_admin_and_set_true

    async def mock_cosmos_query(*args, **kwargs):   
        return fake_spaces    

    monkeypatch.setattr('app.routers.space.cosmos_query', mock_cosmos_query)    
    response = client.get("/api/spaces/TestSpace",  headers={"authorization": "fake user"}, params={"expand": "false"})

    jsonObj = response.json()
    assert response.status_code == 200
    assert jsonObj['name'] == 'TestSpace'  
    monkeypatch.undo()


# Causing monkey patch leak issue
@pytest.mark.asyncio
async def test_get_spaces_when_expand_and_admin_true_and_vnet_donot_match_then_return_spaces_without_vnet(monkeypatch):
    app.dependency_overrides[check_token_expired] = override_check_token_expired
    app.dependency_overrides[get_admin] = override_get_admin_and_set_true    
    
    unmatched_vnets = [{
        "id": "some id that do not match",
        "active": True
      }]

    async def mock_cosmos_query(*args, **kwargs):   
          return fake_spaces

    async def mock_vnet_obj(*args, **kwargs):
          return unmatched_vnets

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
    monkeypatch.undo()





@pytest.mark.asyncio
async def test_get_space_when_admin_and_expand_and_found_space_then_return_space_and_vnet(monkeypatch):
    app.dependency_overrides[check_token_expired] = override_check_token_expired
    app.dependency_overrides[get_admin] = override_get_admin_and_set_true

    fake_vnets = [{
        "id": "/subscriptions/0d475e11-cdf6-4c4a-b890-7fc9956c1a6f/resourceGroups/rg-network/providers/Microsoft.Network/virtualNetworks/spoke-d-net",
        "active": True
      }]

    async def mock_cosmos_query(*args, **kwargs):   
          return fake_spaces

    async def mock_vnet_obj2(*args, **kwargs):
          return fake_vnets

    monkeypatch.setattr('app.routers.space.cosmos_query', mock_cosmos_query)
    monkeypatch.setattr('app.routers.space.arg_query', mock_vnet_obj2)    
 
    response = client.get("/api/spaces/TestSpace",  headers={"authorization": "fake user"}, params={"expand": "true"})

    jsonObj = response.json()
    print(jsonObj)
    spaceBlocks = jsonObj['blocks']
    blockVNets = spaceBlocks[0]['vnets']
    print(blockVNets)
    assert response.status_code == 200
    assert jsonObj['name'] == 'TestSpace'    
    assert blockVNets[0]['id'] == fake_vnets[0]['id']  
    monkeypatch.undo()