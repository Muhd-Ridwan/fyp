import logging
import bcrypt
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from dependencies import get_current_employee
from dynamodb_client import get_employee_by_email, update_employee_onboarding

router = APIRouter(prefix="/onboarding")
logger = logging.getLogger(__name__)

class OnboardingRequest(BaseModel):
    nric_last4: str

@router.post("/complete", status_code=200)
def complete_onboarding(
    body: OnboardingRequest,
    employee: dict = Depends(get_current_employee),
):
    if len(body.nric_last4) != 4 or not body.nric_last4.isalnum():
        raise HTTPException(status_code=400, detail="NRIC last 4 characters must be exactly 4 alphanumeric characters")
    try:
        profile = get_employee_by_email(employee["email"])
    except ClientError as e:
        logger.error("DynamoDB get employee failed for %s: %s", employee["email"], e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to retrieve employee record")
    
    if profile and profile.get("onboarding_complete"):
        raise HTTPException(status_code=409, detail="Onboarding already completed")
    
    nric_hash = bcrypt.hashpw(body.nric_last4.upper().encode(), bcrypt.gensalt()).decode()

    try:
        update_employee_onboarding(
            email=employee["email"],
            nric_last4_hash=nric_hash
        )
    except ClientError as e:
        logger.error("DynamoDB update employee failed for %s: %s", employee["email"], e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to complete onboarding")
    
    return {"message": "Onboarding complete"}