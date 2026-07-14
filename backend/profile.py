import logging
import re
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from dependencies import get_current_employee
from dynamodb_client import get_employee_by_email, update_employee_profile

router = APIRouter(prefix="/profile")
logger = logging.getLogger(__name__)

PHONE_PATTERN = re.compile(r"^\d{0,15}$")


class UpdateProfileRequest(BaseModel):
    address: str
    phone: str

    @field_validator(
        "phone"
    )  # ("phone") = the name need to be the same as the BaseModel declaration
    @classmethod
    def validate_phone(cls, value: str) -> str:
        if not PHONE_PATTERN.fullmatch(value):
            raise ValueError("Phone must contain digits only (max 15 digits)")
        return value


@router.get("", status_code=200)
def get_profile(employee: dict = Depends(get_current_employee)):
    try:
        profile = get_employee_by_email(employee["email"])
    except ClientError as e:
        logger.error(
            "DynamoDB get employee failed for %s: %s",
            employee["email"],
            e,
            exc_info=True,
        )
        raise HTTPException(status_code=503, detail="Failed to retrieve profile")

    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    return {
        "name": profile.get("name"),
        "department": profile.get("department"),
        "role": profile.get("role"),
        "personal_email": profile.get("personal_email"),
        "address": profile.get("address"),
        "phone": profile.get("phone"),
    }


@router.patch("", status_code=200)
def update_profile(
    body: UpdateProfileRequest,
    employee: dict = Depends(get_current_employee),
):
    try:
        update_employee_profile(
            email=employee["email"],
            address=body.address,
            phone=body.phone,
        )
    except ClientError as e:
        logger.error(
            "DynamoDB update employee profile failed for %s: %s",
            employee["email"],
            e,
            exc_info=True,
        )
        raise HTTPException(status_code=503, detail="Failed to update profile")

    return {"message": "Profile updated"}
