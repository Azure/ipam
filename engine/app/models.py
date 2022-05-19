from pydantic import BaseModel, ValidationError, EmailStr
from typing import Optional, List

from netaddr import IPSet, IPNetwork, IPAddress
from datetime import datetime
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

class VNet(BaseModel):
    """DOCSTRING"""

    vnet: str

class IPReservation(BaseModel):
    """DOCSTRING"""

    cidr: IPv4Address
    userId: EmailStr
    createdOn: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.timestamp(),
            IPAddress: lambda v: str(v),
        }

class BlockReq(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: IPv4Network

    class Config:
        json_encoders = {
            IPNetwork: lambda v: str(v),
        }

class BlockRes(BaseModel):
    """DOCSTRING"""

    name: str
    cidr: IPv4Network
    vnets: List
    resv: List

    class Config:
        json_encoders = {
            IPNetwork: lambda v: str(v),
        }

class SpaceReq(BaseModel):
    """DOCSTRING"""

    name: str
    desc: str

class SpaceRes(BaseModel):
    """DOCSTRING"""

    name: str
    desc: str
    vnets: List[str]
    blocks: List[BlockRes]

if __name__ == "__main__":
    # json_reservation = json.dumps(IPReservation.schema(), indent=4)
    # print(json_reservation)

    rData = {
        "cidr": "10.0.0.1",
        "userId": "matt@elnica6yahoo.onmicrosoft.com",
        "createdOn": datetime.now().timestamp()
    }

    rA = IPReservation(**rData)

    print(rA.json())

    # json_block = json.dumps(BlockReq.schema(), indent=4)
    # print(json_block)

    # dataA = {
    #     "name": "AzureBlockA",
    #     "cidr": "10.0.0.0/24"
    # }

    # xA = BlockReq(**dataA)

    # print(xA)

    # dataB = {
    #     "name": "AzureBlockB",
    #     "cidr": "10.0.0.x/24"
    # }

    # try:
    #     xB = BlockReq(**dataB)
    # except ValidationError as e:
    #     print("Error creating Model class...")
