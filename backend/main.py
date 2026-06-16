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

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

import config
from dependencies import get_current_employee
from documents import router as documents_router
from folders import router as folders_router

app = FastAPI(title="FYP Cloud Document Management", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents_router)
app.include_router(folders_router)

@app.get("/health")
def health():
    """Unauthenticated liveness check."""
    return {"status": "ok"}

@app.get("/me")
def read_current_user(employee: dict = Depends(get_current_employee)):
    """
    Returns the authenticated employee's profile (name, dept, role)
    looked up from DynamoDB by their Cognito email.
    """
    return employee