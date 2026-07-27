"""
Track Login.
Will not be tracked if the user refresh the page to get refresh token
Only track when login
"""

import logging
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from dependencies import get_current_employee
from dynamodb_client import create_audit_log_entry

router = APIRouter(prefix="/auth")
logger = logging.getLogger(__name__)


@router.post("/log-login", status_code=201)
def log_login(employee: dict = Depends(get_current_employee)):
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="No dept assigned to this acc.")
    try:
        create_audit_log_entry(
            department=department,
            action="login",
            actor_email=employee["email"],
        )
    except ClientError as e:
        logger.error(
            "Audit log failed for login %s: %s", employee["email"], e, exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to record login")

    return {"message": "Login recorded"}
