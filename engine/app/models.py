from pydantic import BaseModel, ValidationError, EmailStr
from typing import Optional, List, Any

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

class VNetsUpdate(List[str]):
    """DOCSTRING"""

class CIDRReq(BaseModel):
    """DOCSTRING"""

    size: int

class DeleteResvReq(List[str]):
    """DOCSTRING"""

#######################
#   RESPONSE MODELS   #
#######################

class VNet(BaseModel):
    """DOCSTRING"""

    id: str
    active: Optional[bool]

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
    userId: str
    createdOn: float
    status: str

class BlockBasic(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    resv: List[Reservation]

class BlockBasicUtil(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    resv: List[Reservation]
    size: int
    used: int

class Block(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    resv: List[Reservation]

class BlockExpand(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNetExpand]
    resv: List[Reservation]

class BlockUtil(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    resv: List[Reservation]
    size: int
    used: int

class BlockExpandUtil(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNetExpandUtil]
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
#   ADMIN MODELS   #
####################

class Admin(BaseModel):
    """DOCSTRING"""

    name: str
    email: EmailStr
    id: UUID

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

class User(BaseModel):
    """DOCSTRING"""

    id: UUID
    apiRefresh: int
    isAdmin: bool

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
