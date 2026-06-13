"""
FYP - FastAPI backend entrypoint

Auth Flow:
    Cognito token arrives
        -> backend verifies signature (auth.py)
        -> backend extracts user's email from the token
        -> DynamoDB lookup: what department is this email in?
        -> backend returns { email, name, department, role }

Run locally with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

import config
from auth import verifier, TokenVerificationError
from dynamodb_client import get_employee_by_email

app = FastAPI(title="FYP Cloud Document Management", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/health")
def health():
    """Unauthenticated liveness check."""
    return {"status": "ok"}

@app.get("/me")
def read_current_user(current_user: dict = Depends(get_current_user)):
    """
    Returns the authenticated employee's profile (name, dept, role)
    looked up from DynamoDB by their Cognito email.
    """
    email = current_user["email"]
    profile = get_employee_by_email(email)

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail=f"No employee record found for '{email}'. Has this account been added to Employees"
        )
    
    return {
        "email": email,
        "name": profile.get("name"),
        "department": profile.get("department"),
        "role": profile.get("role"),
    }