import logging
import secrets
import time
import bcrypt
import boto3
import resend
import config

from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from dynamodb_client import (
    get_employee_by_email,
    update_employee_reset_token,
    clear_employee_reset_token,
    record_failed_reset_attempt,
    clear_reset_attempts,
)

router = APIRouter(prefix="/auth")
logger = logging.getLogger(__name__)
resend.api_key = config.RESEND_API_KEY
_cognito = boto3.client("cognito-idp", region_name=config.AWS_REGION)

_RESET_TOKEN_TTL = 1800
_MAX_RESET_ATTEMPTS = 5
_LOCKOUT_SECONDS = 900  # 15 Minutes


class VerifyEmailRequest(BaseModel):
    work_email: str


class SendResetRequest(BaseModel):
    work_email: str
    nric_last4: str
    personal_email: EmailStr


class ResetPasswordRequest(BaseModel):
    work_email: str
    token: str
    new_password: str


@router.post("/forgot-password/verify-email", status_code=200)
def verify_email(body: VerifyEmailRequest):
    try:
        profile = get_employee_by_email(body.work_email)
    except ClientError as e:
        logger.error(
            "DynamoDB get employee failed for %s: %s", body.work_email, e, exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to verify email")
    if profile is None:
        raise HTTPException(status_code=404, detail="No employee found with this email")

    return {"message": "Email verified"}


@router.post("/forgot-password/send-reset", status_code=200)
def send_reset(body: SendResetRequest, request: Request):
    try:
        profile = get_employee_by_email(body.work_email)
    except ClientError as e:
        logger.error(
            "DyanmoDB get employee failed for %s: %s", body.work_email, e, exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to process request")

    if not profile or not profile.get("onboarding_complete"):
        raise HTTPException(
            status_code=400, detail="No employee found matching the provided details"
        )
    locked_until = profile.get("reset_locked_until", 0)
    if locked_until and time.time() < locked_until:
        raise HTTPException(
            status_code=429, detail="Too many attempts. Please try again in 15 minutes."
        )
    stored_personal_email = profile.get("personal_email", "")
    stored_nric_hash = profile.get("nric_last4_hash", "")
    verified = (
        bool(stored_nric_hash)
        and bcrypt.checkpw(body.nric_last4.upper().encode(), stored_nric_hash.encode())
        and body.personal_email.lower() == stored_personal_email.lower()
    )

    if not verified:
        attempt_count = profile.get("reset_attempt_count", 0) + 1
        try:
            if attempt_count >= _MAX_RESET_ATTEMPTS:
                record_failed_reset_attempt(
                    body.work_email, locked_until=int(time.time()) + _LOCKOUT_SECONDS
                )
            else:
                record_failed_reset_attempt(body.work_email, locked_until=None)
        except ClientError as e:
            logger.error(
                "DynamoDB record failed reset attempt failed for %s: %s",
                body.work_email,
                e,
                exc_info=True,
            )
        raise HTTPException(
            status_code=400, detail="No employee found matching the provided details"
        )
    try:
        clear_reset_attempts(body.work_email)
    except ClientError as e:
        logger.error(
            "DynamoDB clear reset attempts failed for %s: %s",
            body.work_email,
            e,
            exc_info=True,
        )

    token = secrets.token_urlsafe(32)
    expiry = int(time.time()) + _RESET_TOKEN_TTL

    try:
        update_employee_reset_token(email=body.work_email, token=token, expiry=expiry)
    except ClientError as e:
        logger.error(
            "DynamoDB update employee reset token failed for %s: %s",
            body.work_email,
            e,
            exc_info=True,
        )
        raise HTTPException(status_code=503, detail="Failed to process request")

    origin = request.headers.get("origin", "")
    reset_link = f"{origin}/reset-password?token={token}&email={body.work_email}"

    try:
        resend.Emails.send(
            {
                "from": config.RESEND_FROM_EMAIL,
                "to": body.personal_email,
                "subject": "DocuVault - Password Reset Request",
                "html": f"""
                <p>Hello {profile.get("name", "")},</p>
                <p>We received a request to reset your DocuVault password.</p>
                <p><a href="{reset_link}">Click here to reset your password</a></p>
                <p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>
                """,
            }
        )
    except Exception as e:
        logger.error(
            "Resend email failed for %s: %s", body.work_email, e, exc_info=True
        )
        try:
            clear_employee_reset_token(email=body.work_email)
        except ClientError:
            logger.error(
                "Failed to clear reset token for %s after Resend failure",
                body.work_email,
            )
        raise HTTPException(status_code=503, detail="Failed to send reset email")

    return {"message": "Reset link sent to your personal email"}


@router.post("/reset-password", status_code=200)
def reset_password(body: ResetPasswordRequest):
    try:
        profile = get_employee_by_email(body.work_email)
    except ClientError as e:
        logger.error(
            "DynamoDB get employee failed for %s: %s", body.work_email, e, exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to process request")

    if not profile:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    stored_token = profile.get("reset_token")
    token_expiry = profile.get("reset_token_expiry", 0)

    if not stored_token or body.token != stored_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    if int(time.time()) > token_expiry:
        raise HTTPException(status_code=400, detail="Reset link has expired")

    try:
        _cognito.admin_set_user_password(
            UserPoolId=config.COGNITO_USER_POOL_ID,
            Username=body.work_email,
            Password=body.new_password,
            Permanent=True,
        )
    except _cognito.exceptions.InvalidPasswordException:
        raise HTTPException(
            status_code=400, detail="Password does not meet requirements"
        )
    except ClientError as e:
        logger.error(
            "Cognito admin set user password failed for %s: %s",
            body.work_email,
            e,
            exc_info=True,
        )
        raise HTTPException(status_code=502, detail="Failed to reset password")

    try:
        clear_employee_reset_token(email=body.work_email)
    except ClientError as e:
        logger.error(
            "DynamoDB clear employee reset token failed for %s: %s",
            body.work_email,
            e,
            exc_info=True,
        )
        logger.warning(
            "Reset token for %s not cleared - will expired naturally %s",
            body.work_email,
            token_expiry,
        )

    return {"message": "Password reset successfully"}
