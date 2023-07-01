from pydantic import BaseModel, ValidationError, EmailStr, root_validator, validator
from typing import Optional, Union, Literal, List, Dict, Any

from netaddr import IPSet, IPNetwork, IPAddress
from datetime import datetime
from uuid import UUID
import json

class IPv4Network(str):
    """
    DOCSTRING
    """

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(
            pattern='x.x.x.x/x',
            examples=['10.0.0.0/8', '172.16.0.0/16', '192.168.0.0/24'],
        )

    @classmethod
    def validate(cls, v):
        if not isinstance(v, str):
            raise TypeError('string required')
        try:
            m = IPNetwork(v)
        except:
            m = None
        if not m:
            raise ValueError('invalid ip network format')
        return v

    def __repr__(self):
        return f'IPNetwork({super().__repr__()})'

class IPv4Address(str):
    """
    DOCSTRING
    """

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(
            pattern='x.x.x.x',
            examples=['10.0.0.1', '172.16.0.1', '192.168.0.1'],
        )

    @classmethod
    def validate(cls, v):
        if not isinstance(v, str):
            raise TypeError('string required')
        try:
            m = IPAddress(v)
        except:
            m = None
        if not m:
            raise ValueError('invalid ip address format')
        return v

    def __repr__(self):
        return f'IPAddress({super().__repr__()})'

######################
#   REQUEST MODELS   #
######################

class SpaceReq(BaseModel):
    """DOCSTRING"""

    name: str
    desc: str

class BlockReq(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: IPv4Network

class JSONPatch(BaseModel):
    """DOCSTRING"""

    op: str
    path: str
    value: Any

class SpaceUpdate(List[JSONPatch]):
    """DOCSTRING"""

class BlockUpdate(List[JSONPatch]):
    """DOCSTRING"""

class VNetsUpdate(List[str]):
    """DOCSTRING"""

class ExtNetsUpdate(List[str]):
    """DOCSTRING"""

class SpaceCIDRReq(BaseModel):
    """DOCSTRING"""

    blocks: list
    size: int
    desc: Optional[str] = None
    reverse_search: Optional[bool] = False
    smallest_cidr: Optional[bool] = False

class BlockCIDRReq(BaseModel):
    """DOCSTRING"""

    size: int
    desc: Optional[str] = None
    reverse_search: Optional[bool] = False
    smallest_cidr: Optional[bool] = False

class DeleteResvReq(List[str]):
    """DOCSTRING"""

#######################
#   RESPONSE MODELS   #
#######################

class VNet(BaseModel):
    """DOCSTRING"""

    id: str
    active: Optional[bool]

class Network(BaseModel):
    """DOCSTRING"""

    id: str
    active: Optional[bool]

class ExternalNetwork(BaseModel):
    """DOCSTRING"""

    name: str
    desc: str
    cidr : IPv4Network

class VNets(BaseModel):
    """DOCSTRING"""

    ids: List[str]

class Subnet(BaseModel):
    """DOCSTRING"""

    name: str
    prefix: str

class SubnetUtil(BaseModel):
    """DOCSTRING"""

    name: str
    prefix: str
    size: int
    used: int

class NetworkExpand(BaseModel):
    """DOCSTRING"""

    name: str
    id: str
    prefixes: List[str]
    resource_group: str
    subscription_id: str
    tenant_id: str

class VNetExpand(BaseModel):
    """DOCSTRING"""

    name: str
    id: str
    prefixes: List[str]
    subnets: List[Subnet]
    resource_group: str
    subscription_id: str
    tenant_id: str

class VNetExpandUtil(BaseModel):
    """DOCSTRING"""

    name: str
    id: str
    prefixes: List[str]
    subnets: List[SubnetUtil]
    resource_group: str
    subscription_id: str
    tenant_id: str
    size: int
    used: int

class Reservation(BaseModel):
    """DOCSTRING"""

    id: str
    cidr: str
    desc: Union[str, None]
    createdOn: float
    createdBy: str
    settledOn: Union[float, None]
    settledBy: Union[str, None]
    status: str

class ReservationExpand(BaseModel):
    """DOCSTRING"""

    id: str
    space: Optional[str]
    block: Optional[str]
    cidr: str
    desc: Union[str, None]
    createdOn: float
    createdBy: str
    settledOn: Union[float, None]
    settledBy: Union[str, None]
    status: str
    tag: Optional[dict]

    @root_validator
    def format_tag(cls, values) -> dict:
        values["tag"] = { "X-IPAM-RES-ID": values["id"]}
        
        return values

class BlockBasic(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExternalNetwork]
    resv: List[Reservation]

class BlockBasicUtil(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExternalNetwork]
    resv: List[Reservation]
    size: int
    used: int

class Block(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExternalNetwork]
    resv: List[Reservation]

class BlockExpand(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNetExpand]
    externals: List[ExternalNetwork]
    resv: List[Reservation]

class BlockUtil(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExternalNetwork]
    resv: List[Reservation]
    size: int
    used: int

class BlockExpandUtil(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNetExpandUtil]
    externals: List[ExternalNetwork]
    resv: List[Reservation]
    size: int
    used: int

class SpaceBasic(BaseModel):
    """DOCSTRING"""

    name: str
    desc: str
    blocks: List[BlockBasic]

class SpaceBasicUtil(BaseModel):
    """DOCSTRING"""

    name: str
    desc: str
    blocks: List[BlockBasicUtil]
    size: int
    used: int

class Space(BaseModel):
    """DOCSTRING"""

    name: str
    desc: str
    blocks: List[Block]

class SpaceExpand(BaseModel):
    """DOCSTRING"""

    name: str
    desc: str
    blocks: List[BlockExpand]

class SpaceUtil(BaseModel):
    """DOCSTRING"""

    name: str
    desc: str
    blocks: List[BlockUtil]
    size: int
    used: int

class SpaceExpandUtil(BaseModel):
    """DOCSTRING"""

    name: str
    desc: str
    blocks: List[BlockExpandUtil]
    size: int
    used: int

####################
#   AZURE MODELS   #
####################

# class VWanHubMetadata(BaseModel):
#     """DOCSTRING"""

#     vwan_name: str
#     vwan_id: str

class VNetPeering(BaseModel):
    """DOCSTRING"""

    name: str
    remote_network: str
    state: str

class VWanHub(BaseModel):
    """DOCSTRING"""

    name: str
    id: str
    prefix: IPv4Network
    vwan_name: str
    vwan_id: str
    parent_space: Union[str,  None]
    parent_block: Union[str, None]
    resource_group: str
    subscription_id: UUID
    tenant_id: str
    peerings: List[VNetPeering]
    size: int

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
        }

class AzureNetwork(BaseModel):
    """DOCSTRING"""

    name: str
    id: str
    type: str
    prefixes: List[IPv4Network]
    resource_group: str
    subscription_id: UUID
    tenant_id: str
    peerings: List[VNetPeering]
    size: int
    used: Union[int, None]

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
        }

####################
#   ADMIN MODELS   #
####################

class Admin(BaseModel):
    """DOCSTRING"""

    type: Literal["User", "Principal"]
    name: str
    email: Optional[EmailStr]
    id: UUID

    @validator('email', pre=True, always=True)
    def check_email(cls, v, values, **kwargs):
        if 'type' in values and values['type'] == "Principal" and v is not None:
            raise ValueError("email should not be set for 'principal' type")
        if 'type' in values and values['type'] == "User" and v is None:
            raise ValueError("email must be set for 'user' type")

        return v

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
        }

class Subscription(UUID):
    """DOCSTRING"""

class Exclusions(List[UUID]):
    """DOCSTRING"""

###################
#   USER MODELS   #
###################

class ViewSettings(BaseModel):
    values: Dict[str, dict]
    order: List[str]
    sort: Union[dict, None]

class User(BaseModel):
    """DOCSTRING"""

    id: UUID
    darkMode: bool
    apiRefresh: int
    isAdmin: bool

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
        }

class UserExpand(BaseModel):
    """DOCSTRING"""

    id: UUID
    darkMode: bool
    apiRefresh: int
    isAdmin: bool
    views: Dict[str, ViewSettings]

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
        }

class JSONPatch(BaseModel):
    """DOCSTRING"""

    op: str
    path: str
    value: Any

class UserUpdate(List[JSONPatch]):
    """DOCSTRING"""

###################
#   TOOL MODELS   #
###################

class VNetCIDRReq(BaseModel):
    """DOCSTRING"""

    space: str
    blocks: List[str]
    size: int
    reverse_search: Optional[bool] = False
    smallest_cidr: Optional[bool] = False

class SubnetCIDRReq(BaseModel):
    """DOCSTRING"""

    vnet_id: str
    size: int
    reverse_search: Optional[bool] = False
    smallest_cidr: Optional[bool] = False

class NewSubnetCIDR(BaseModel):
    """DOCSTRING"""

    vnet_name: str
    resource_group: str
    subscription_id: str
    cidr: str

class NewVNetCIDR(BaseModel):
    """DOCSTRING"""

    space: str
    block: str
    cidr: str
