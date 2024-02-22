import logging
import traceback
from datetime import datetime, timezone

import azure.functions as func

from app.main import app as ipam
from app.logs.logs import ipam_logger as logger
from app.routers.azure import match_resv_to_vnets

azureLogger = logging.getLogger('azure')
azureLogger.setLevel(logging.ERROR)

app = func.AsgiFunctionApp(app=ipam, http_auth_level=func.AuthLevel.ANONYMOUS)

# @app.function_name(name="ipam-sentinel")
# @app.schedule(schedule="0 * * * * *", arg_name="mytimer", run_on_startup=True, use_monitor=False)
@app.timer_trigger(schedule="0 * * * * *", arg_name="mytimer", run_on_startup=True, use_monitor=False)
async def ipam_sentinel(mytimer: func.TimerRequest) -> None:
    utc_timestamp = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()

    logger.info('Azure IPAM Sentinel function was triggered')

    if mytimer.past_due:
        logger.debug('The timer is past due ({})!'.format(utc_timestamp))

    try:
        await match_resv_to_vnets()
    except Exception as e:
        logger.error('Error running network check loop!')
        tb = traceback.format_exc()
        logger.debug(tb)
        raise e
