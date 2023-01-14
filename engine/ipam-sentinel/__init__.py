import datetime

import azure.functions as func

from app.logs.logs import ipam_logger as logger

from app.routers.azure import match_resv_to_vnets
async def main(mytimer: func.TimerRequest) -> None:
    utc_timestamp = datetime.datetime.utcnow().replace(
        tzinfo=datetime.timezone.utc).isoformat()

    if mytimer.past_due:
        logger.info('The timer is past due!')

    logger.info('Python timer trigger function ran at %s', utc_timestamp)

    await match_resv_to_vnets()
