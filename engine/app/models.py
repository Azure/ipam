from typing import Annotated, Any, Dict, List, Literal, Optional, Union
from uuid import UUID

from netaddr import IPAddress, IPNetwork
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    GetCoreSchemaHandler,
    GetJsonSchemaHandler,
    model_validator,
)
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import CoreSchema, core_schema


class IPv4Network(str):
    """
    Pydantic-compatible ``str`` subtype that validates a value as an IPv4
    network in CIDR notation (e.g. ``10.0.0.0/8``).
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
        except Exception:
            m = None
        if not m:
            raise ValueError('invalid ip network format')
        return input_value

class IPv4Address(str):
    """
    Pydantic-compatible ``str`` subtype that validates a value as an IPv4
    address (e.g. ``10.0.0.1``).
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
        except Exception:
            m = None
        if not m:
            raise ValueError('invalid ip address format')
        return input_value

#######################
#   RESPONSE MODELS   #
#######################

class VNet(BaseModel):
    """Reference to an Azure Virtual Network associated with a Block, tracked by resource ID and active status."""

    id: str
    active: Optional[bool] = None

class Network(BaseModel):
    """Reference to a generic Azure network resource associated with a Block, tracked by resource ID and active status."""

    id: str
    active: Optional[bool] = None

class ExtEndpoint(BaseModel):
    """An endpoint (named host) with a description and IP address defined within an external subnet."""

    name: str
    desc: str
    ip: str

class ExtSubnet(BaseModel):
    """A subnet within an external network, containing a CIDR range and its endpoints."""

    name: str
    desc: str
    cidr: str
    endpoints: List[ExtEndpoint]

class ExtSubnetExpand(BaseModel):
    """An external subnet enriched with its parent space, block, and external network context."""

    name: str
    desc: str
    space: str
    block: str
    external: str
    cidr: str
    endpoints: List[ExtEndpoint]

class ExtNet(BaseModel):
    """An external (non-Azure) network defined within a Block, with a CIDR range and child subnets."""

    name: str
    desc: str
    cidr: IPv4Network
    subnets: List[ExtSubnet]

class ExtNetExpand(BaseModel):
    """An external network enriched with its parent space and block context."""

    name: str
    desc: str
    space: str
    block: str
    cidr: IPv4Network
    subnets: List[ExtSubnet]

class VNets(BaseModel):
    """A collection of Virtual Network resource IDs."""

    ids: List[str]

class Subnet(BaseModel):
    """A subnet within a Virtual Network, identified by name and address prefix."""

    name: str
    prefix: str

class SubnetUtil(BaseModel):
    """A subnet with address utilization details (total and used address counts)."""

    name: str
    prefix: str
    size: int
    used: int

class NetworkExpand(BaseModel):
    """A network resource with expanded details including its prefixes and Azure resource context."""

    name: str
    id: str
    prefixes: List[str]
    resource_group: str
    subscription_id: str
    tenant_id: str

class VNetExpand(BaseModel):
    """A Virtual Network with expanded details including its prefixes, subnets, and Azure resource context."""

    name: str
    id: str
    prefixes: List[str]
    subnets: List[Subnet]
    resource_group: str
    subscription_id: str
    tenant_id: str

class VNetExpandUtil(BaseModel):
    """A Virtual Network with expanded details and address utilization (total and used address counts)."""

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
    """A CIDR reservation within a Block, tracking creation/settlement metadata and status."""

    id: str
    cidr: str
    desc: Union[str, None] = None
    createdOn: float
    createdBy: str
    settledOn: Union[float, None] = None
    settledBy: Union[str, None] = None
    status: str

class ReservationExpand(BaseModel):
    """A CIDR reservation enriched with its parent space, block, and a derived IPAM reservation ID tag."""

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
    """A Block summary containing its CIDR, associated networks, externals, and reservations."""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExtNet]
    resv: List[Reservation]

class BlockBasicUtil(BaseModel):
    """A Block summary with address utilization (total and used address counts)."""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExtNet]
    resv: List[Reservation]
    size: int
    used: int

class Block(BaseModel):
    """A network Block within a Space, containing a CIDR, its Virtual Networks, externals, and reservations."""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExtNet]
    resv: List[Reservation]

class BlockExpand(BaseModel):
    """A Block with its Virtual Networks expanded to full detail."""

    name: str
    cidr: str
    vnets: List[VNetExpand]
    externals: List[ExtNet]
    resv: List[Reservation]

class BlockUtil(BaseModel):
    """A Block with address utilization (total and used address counts)."""

    name: str
    cidr: str
    vnets: List[VNet]
    externals: List[ExtNet]
    resv: List[Reservation]
    size: int
    used: int

class BlockExpandUtil(BaseModel):
    """A Block with expanded Virtual Networks and address utilization."""

    name: str
    cidr: str
    vnets: List[VNetExpandUtil]
    externals: List[ExtNet]
    resv: List[Reservation]
    size: int
    used: int

class SpaceBasic(BaseModel):
    """A Space summary containing its description and basic Block information."""

    name: str
    desc: str
    blocks: List[BlockBasic]

class SpaceBasicUtil(BaseModel):
    """A Space summary with per-Block and aggregate address utilization."""

    name: str
    desc: str
    blocks: List[BlockBasicUtil]
    size: int
    used: int

class Space(BaseModel):
    """A top-level Space that groups related network Blocks."""

    name: str
    desc: str
    blocks: List[Block]

class SpaceExpand(BaseModel):
    """A Space with its Blocks and Virtual Networks expanded to full detail."""

    name: str
    desc: str
    blocks: List[BlockExpand]

class SpaceUtil(BaseModel):
    """A Space with per-Block and aggregate address utilization."""

    name: str
    desc: str
    blocks: List[BlockUtil]
    size: int
    used: int

class SpaceExpandUtil(BaseModel):
    """A Space with expanded Blocks and aggregate address utilization."""

    name: str
    desc: str
    blocks: List[BlockExpandUtil]
    size: int
    used: int

######################
#   REQUEST MODELS   #
######################

class SpaceReq(BaseModel):
    """Request body for creating or updating a Space."""

    name: str
    desc: str

class BlockReq(BaseModel):
    """Request body for creating a Block with a name and CIDR."""

    name: str
    cidr: IPv4Network

class SpaceCIDRReq(BaseModel):
    """Request body for finding the next available CIDR of a given size across a Space's Blocks."""

    blocks: list
    size: int
    desc: Optional[str] = None
    reverse_search: Optional[bool] = False
    smallest_cidr: Optional[bool] = False

class BlockCIDRReq(BaseModel):
    """Request body for reserving a CIDR within a Block, either by explicit CIDR or by size."""

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

class ExtNetReq(BaseModel):
    """Request body for creating an external network, either by explicit CIDR or by size."""

    name: str
    desc: Optional[str] = None
    cidr: Optional[IPv4Network] = None
    size: Optional[int] = None

    @model_validator(mode='before')
    @classmethod
    def validate_request(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'cidr' in data and 'size' in data:
                if data['cidr'] is not None:
                    raise AssertionError("the 'cidr' and 'size' parameters can only be used alternatively")
            if 'cidr' not in data and 'size' not in data:
                raise AssertionError("it is required to provide either the 'cidr' or 'size' parameter")

        return data

class ExtSubnetReq(BaseModel):
    """Request body for creating an external subnet, either by explicit CIDR or by size."""

    name: str
    desc: Optional[str] = None
    cidr: Optional[IPv4Network] = None
    size: Optional[int] = None

    @model_validator(mode='before')
    @classmethod
    def validate_request(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'cidr' in data and 'size' in data:
                if data['cidr'] is not None:
                    raise AssertionError("the 'cidr' and 'size' parameters can only be used alternatively")
            if 'cidr' not in data and 'size' not in data:
                raise AssertionError("it is required to provide either the 'cidr' or 'size' parameter")

        return data

class ExtEndpointReq(BaseModel):
    """Request body for creating an endpoint within an external subnet."""

    name: str
    desc: str
    ip: Union[IPv4Address, None]

class JSONPatch(BaseModel):
    """A single JSON Patch (RFC 6902) operation used to update a resource."""

    op: str
    path: str
    value: Any = None

SpaceUpdate = Annotated[List[JSONPatch], None]

BlockUpdate = Annotated[List[JSONPatch], None]

ExtNetUpdate = Annotated[List[JSONPatch], None]

ExtSubnetUpdate = Annotated[List[JSONPatch], None]

ExtEndpointUpdate = Annotated[List[JSONPatch], None]

VNetsUpdate = Annotated[List[str], None]

ExtNetsUpdate = Annotated[List[ExtNet], None]

DeleteExtEndpointsReq = Annotated[List[str], None]

DeleteResvReq = Annotated[List[str], None]

####################
#   AZURE MODELS   #
####################

class VNetPeering(BaseModel):
    """A peering connection from a Virtual Network to a remote network."""

    name: str
    remote_network: str
    state: str

class VWanHub(BaseModel):
    """An Azure Virtual WAN hub with its address prefix, parent space/block, and peerings."""

    name: str
    id: str
    prefix: IPv4Network
    vwan_name: str
    vwan_id: str
    parent_space: Union[str,  None] = None
    parent_block: Union[List[str], None] = None
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
    """An Azure network resource (VNet or vWAN hub) with its prefixes, peerings, and utilization."""

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
    """An IPAM administrator, either a user (with email) or a service principal."""

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
    # Legacy format (Inovua)
    values: Optional[Dict[str, dict]] = None
    order: Optional[List[str]] = None
    sort: Union[dict, None] = None
    # AG Grid format
    columnState: Optional[List[dict]] = None

class User(BaseModel):
    """IPAM user settings such as dark mode, API refresh interval, and admin status."""

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
    """IPAM user settings expanded to include saved grid view configurations."""

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
    """A single JSON Patch (RFC 6902) operation used to update a resource."""

    op: str
    path: str
    value: Any = None

UserUpdate = Annotated[List[JSONPatch], None]

###################
#   TOOL MODELS   #
###################

class VNetCIDRReq(BaseModel):
    """Request body for finding the next available CIDR for a new Virtual Network."""

    space: str
    blocks: List[str]
    size: int
    reverse_search: Optional[bool] = False
    smallest_cidr: Optional[bool] = False

class SubnetCIDRReq(BaseModel):
    """Request body for finding the next available CIDR for a new subnet within a Virtual Network."""

    vnet_id: str
    size: int
    reverse_search: Optional[bool] = False
    smallest_cidr: Optional[bool] = False

class NewSubnetCIDR(BaseModel):
    """Response describing an available CIDR for a new subnet within a Virtual Network."""

    vnet_name: str
    resource_group: str
    subscription_id: str
    cidr: str

class NewVNetCIDR(BaseModel):
    """Response describing an available CIDR for a new Virtual Network within a Space/Block."""

    space: str
    block: str
    cidr: str

class CIDRContainer(BaseModel):
    space: str
    block: str

class CIDRCheckReq(BaseModel):
    """Request body for checking whether a CIDR overlaps existing IPAM-managed networks."""

    cidr: IPv4Network

class CIDRCheckRes(BaseModel):
    """Result describing an existing network that overlaps the requested CIDR."""

    name: str
    id: str
    resource_group: str
    subscription_id: UUID
    tenant_id: UUID
    prefixes: List[IPv4Network]
    containers: List[CIDRContainer]

#####################
#   HEALTH MODELS   #
#####################

class HealthCheck(BaseModel):
    """Result of a single dependency health check."""

    ok: bool
    detail: Optional[str] = None

class Health(BaseModel):
    """Overall health status with per-dependency check results."""

    ok: bool
    checks: Dict[str, HealthCheck]

#####################
#   STATUS MODELS   #
#####################

class ImageDetails(BaseModel):
    """Details of the container image the engine is running from."""

    image_id: str
    image_version: str
    image_codename: str
    image_pretty_name: str

class Status(BaseModel):
    """Runtime status of the engine including version, stack, environment, and start time."""

    status: str
    version: str
    stack: str
    environment: str
    start_time: str
    mode: Optional[str] = None
    container: Optional[ImageDetails] = None
