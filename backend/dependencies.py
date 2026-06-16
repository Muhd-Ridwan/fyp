"""
Shared FastAPI dependencies for authentication & authorization.
"""

from fastapi import Depends, HTTPException, Header
from auth import verifier, TokenVerificationError
from dynamodb_client import get_employee_by_email

def get_current_user(authorization: str = Header(default=None)) -> dict:
    """
    Extract and verifies the Cognito ID token from the Authorization header.
    Expacts: "Authorization: Bearer <id_token>
    """
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing Authorization header. Expected 'Bearer <token>'.",
        )
    
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty Bearer Token")
    
    try:
        claims = verifier.verify_token(token)
    except TokenVerificationError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc
    
    email = claims.get("email")
    if not email:
        raise HTTPException(
            status_code=401,
            detail="Token has no 'email' claim. Make sure the frontend sends the ID token.",
        )
    return {"email": email, "claims": claims}

def get_current_employee(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Resolves the authenticated user's employee profile from Dynamo DB
    Returns: {email, name, department, role}
    """
    
    email = current_user["email"]
    profile = get_employee_by_email(email)

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail=f"No employee record found for '{email}'. Has this account been added to Employees?"
        )
    
    return {
        "email": email,
        "name": profile.get("name"),
        "department": profile.get("department"),
        "role": profile.get("role"),
    }