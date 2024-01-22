from pydantic_core import CoreSchema, core_schema
from pydantic.json_schema import JsonSchemaValue

from pydantic import (
    GetCoreSchemaHandler,
    GetJsonSchemaHandler,
    ConfigDict,
    BaseModel,
    EmailStr,
    model_validator
)

from typing import (
    Annotated,
    Optional,
    Union,
    Literal,
    List,
    Dict,
    Any
)

from netaddr import IPNetwork, IPAddress
from uuid import UUID

class IPv4Network(str):
    """
    DOCSTRING
    """

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: GetCoreSchemaHandler
    ) -> CoreSchema:
        return core_schema.no_info_after_validator_function(cls.validate, handler(str))

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        json_schema = handler(core_schema)
        json_schema = handler.resolve_ref_schema(json_schema)
        json_schema['pattern'] = 'x.x.x.x/x'
        json_schema['examples'] = [
            '10.0.0.0/8',
            '172.16.0.0/16',
            '192.168.0.0/24'
        ]

        return json_schema

    @classmethod
    def validate(cls, input_value: Any):
        if not isinstance(input_value, str):
            raise TypeError('string required')
        try:
            m = IPNetwork(input_value)
        except:
            m = None
        if not m:
            raise ValueError('invalid ip network format')
        return input_value

class IPv4Address(str):
    """
    DOCSTRING
    """

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: GetCoreSchemaHandler
    ) -> CoreSchema:
        return core_schema.no_info_after_validator_function(cls.validate, handler(str))

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        json_schema = handler(core_schema)
        json_schema = handler.resolve_ref_schema(json_schema)
        json_schema['pattern'] = 'x.x.x.x'
        json_schema['examples'] = [
            '10.0.0.1',
            '172.16.0.1',
            '192.168.0.1'
        ]

        return json_schema

    @classmethod
    def validate(cls, input_value: Any):
        if not isinstance(input_value, str):
            raise TypeError('string required')
        try:
            m = IPAddress(input_value)
        except:
            m = None
        if not m:
            raise ValueError('invalid ip address format')
        return input_value

#######################
#   RESPONSE MODELS   #
#######################

class VNet(BaseModel):
    """DOCSTRING"""

    id: str
    active: Optional[bool] = None

class Network(BaseModel):
    """DOCSTRING"""

    id: str
    active: Optional[bool] = None

class ExtNet(BaseModel):
    """DOCSTRING"""

    name: str
    desc: str
    cidr: IPv4Network

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
    desc: Union[str, None] = None
    createdOn: float
    createdBy: str
    settledOn: Union[float, None] = None
    settledBy: Union[str, None] = None
    status: str

class ReservationExpand(BaseModel):
    """DOCSTRING"""

    id: str
    space: Optional[str] = None
    block: Optional[str] = None
    cidr: str
    desc: Union[str, None] = None
    createdOn: float
    createdBy: str
    settledOn: Union[float, None] = None
    settledBy: Union[str, None] = None
    status: str
    tag: Optional[dict] = None

    @model_validator(mode='before')
    @classmethod
    def format_tag(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'id' in data:
                data["tag"] = { "X-IPAM-RES-ID": data["id"]}
          
                return data

class BlockBasic(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExtNet]
    resv: List[Reservation]

class BlockBasicUtil(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExtNet]
    resv: List[Reservation]
    size: int
    used: int

class Block(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExtNet]
    resv: List[Reservation]

class BlockExpand(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNetExpand]
    externals: List[ExtNet]
    resv: List[Reservation]

class BlockUtil(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExtNet]
    resv: List[Reservation]
    size: int
    used: int

class BlockExpandUtil(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: str
    vnets: List[VNetExpandUtil]
    externals: List[ExtNet]
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

class SpaceCIDRReq(BaseModel):
    """DOCSTRING"""

    blocks: list
    size: int
    desc: Optional[str] = None
    reverse_search: Optional[bool] = False
    smallest_cidr: Optional[bool] = False

class BlockCIDRReq(BaseModel):
    """DOCSTRING"""

    size: Optional[int] = None
    cidr: Optional[IPv4Network] = None
    desc: Optional[str] = None
    reverse_search: Optional[bool] = False
    smallest_cidr: Optional[bool] = False

    @model_validator(mode='before')
    @classmethod
    def validate_request(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'cidr' in data and any(x in data for x in ['reverse_search', 'smallest_cidr']):
                if data['cidr'] is not None:
                    raise AssertionError("the 'cidr' parameter can only be used in conjuction with 'desc'")
            if 'cidr' in data and 'size' in data:
                if data['cidr'] is not None:
                    raise AssertionError("the 'cidr' and 'size' parameters can only be used alternatively")
            if 'cidr' not in data and 'size' not in data:
                raise AssertionError("it is required to provide either the 'cidr' or 'size' parameter")

        return data

class JSONPatch(BaseModel):
    """DOCSTRING"""

    op: str
    path: str
    value: Any = None

SpaceUpdate = Annotated[List[JSONPatch], None]

BlockUpdate = Annotated[List[JSONPatch], None]

VNetsUpdate = Annotated[List[str], None]

ExtNetsUpdate = Annotated[List[ExtNet], None]

DeleteExtNetReq = Annotated[List[str], None]

DeleteResvReq = Annotated[List[str], None]

####################
#   AZURE MODELS   #
####################

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
    parent_space: Union[str,  None] = None
    parent_block: Union[str, None] = None
    resource_group: str
    subscription_id: UUID
    tenant_id: str
    peerings: List[VNetPeering]
    size: int

    model_config = ConfigDict(
        json_encoders = {
            UUID: lambda v: str(v)
        }
    )

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
    used: Union[int, None] = None

    model_config = ConfigDict(
        json_encoders = {
            UUID: lambda v: str(v)
        }
    )

####################
#   ADMIN MODELS   #
####################

class Admin(BaseModel):
    """DOCSTRING"""

    type: Literal["User", "Principal"]
    name: str
    email: Optional[EmailStr] = None
    id: UUID

    @model_validator(mode='before')
    @classmethod
    def validate_request(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'type' in data and 'email' in data:
                if data['type'] == "Principal" and data['email'] is not None:
                    raise ValueError("email should not be set for 'principal' type")
            if 'type' in data and 'email' not in data:
                if data['type'] == "User":
                    raise ValueError("email must be set for 'user' type")

        return data

    model_config = ConfigDict(
        json_encoders = {
            UUID: lambda v: str(v)
        }
    )

Subscription = Annotated[UUID, None]

Exclusions = Annotated[List[UUID], None]

###################
#   USER MODELS   #
###################

class ViewSettings(BaseModel):
    values: Dict[str, dict]
    order: List[str]
    sort: Union[dict, None] = None

class User(BaseModel):
    """DOCSTRING"""

    id: UUID
    darkMode: bool
    apiRefresh: int
    isAdmin: bool

    model_config = ConfigDict(
        json_encoders = {
            UUID: lambda v: str(v)
        }
    )

class UserExpand(BaseModel):
    """DOCSTRING"""

    id: UUID
    darkMode: bool
    apiRefresh: int
    isAdmin: bool
    views: Dict[str, ViewSettings]

    model_config = ConfigDict(
        json_encoders = {
            UUID: lambda v: str(v)
        }
    )

class JSONPatch(BaseModel):
    """DOCSTRING"""

    op: str
    path: str
    value: Any = None

UserUpdate = Annotated[List[JSONPatch], None]

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

class CIDRContainer(BaseModel):
    space: str
    block: str

class CIDRCheckReq(BaseModel):
    """DOCSTRING"""

    cidr: IPv4Network

class CIDRCheckRes(BaseModel):
    """DOCSTRING"""

    name: str
    id: str
    resource_group: str
    subscription_id: UUID
    tenant_id: UUID
    prefixes: List[IPv4Network]
    containers: List[CIDRContainer]

#####################
#   STATUS MODELS   #
#####################

class ImageDetails(BaseModel):
    """DOCSTRING"""

    image_id: str
    image_version: str
    image_codename: str
    image_pretty_name: str

class Status(BaseModel):
    """DOCSTRING"""

    status: str
    version: str
    container: ImageDetails
