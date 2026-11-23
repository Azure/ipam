"""
Setup mode detector.

Until at least one administrator is designated, every signed-in user is treated
as an administrator (see ``resolve_admin``). That's what lets the first person to
sign in finish setting Azure IPAM up, but it also gives everyone in the tenant
full control, so it's reported to everyone as critical until it's resolved. A
deployment returns to setup mode if its last administrator is removed.

The admin endpoints re-run this detector whenever the list of administrators
changes, so the notification clears as soon as setup is complete.
"""

from app.dependencies import in_setup_mode
from app.globals import globals
from app.notifications.models import Notification, NotificationAction
from app.routers.common.helper import cosmos_query

NOTIFICATION_ID = "setup-mode"

ADMINS_GUIDE_URL = "https://azure.github.io/ipam/#/how-to/README?id=managing-administrators"


async def detect():
    admin_query = await cosmos_query("SELECT * FROM c WHERE c.type = 'admin'", globals.TENANT_ID)

    admins = admin_query[0]['admins'] if admin_query else []

    if not in_setup_mode(admins):
        return []

    return [
        Notification(
            id=NOTIFICATION_ID,
            severity="critical",
            audience="all",
            category="Access",
            title="Finish setting up Azure IPAM by designating administrators",
            message="""
                Azure IPAM has no designated administrators, so everyone who signs in is treated as one, with
                full control over Spaces, Blocks, Reservations and who administers Azure IPAM. Complete setup by
                designating one or more administrators on the Admins page, which restricts administrative access
                to the users and service principals you choose.
            """,
            dismissible=False,
            actions=[
                NotificationAction(id="designate-admins", label="Designate administrators", kind="navigate", to="/admin/admins"),
                NotificationAction(id="admins-guide", label="How to manage administrators", kind="link", href=ADMINS_GUIDE_URL),
            ],
        )
    ]
