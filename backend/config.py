"""
Configuration loader for my fyp backend.

All values are read from environment variables
Use python-dotenv locally
in Elastic Beanstalk, set these as environment properties in the EB console instead of a.env file.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# AWS region
# All other service must live within the same region
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID", "")
DYNAMODB_EMPLOYEES_TABLE = os.getenv("DYNAMODB_EMPLOYEES_TABLE", "Employees")
DYNAMODB_FOLDERS_TABLE = os.getenv("DYNAMODB_FOLDERS_TABLE", "Folders")
DYNAMODB_DOCUMENTS_TABLE = os.getenv("DYNAMODB_DOCUMENTS_TABLE", "Documents")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "")

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

if not COGNITO_USER_POOL_ID or not COGNITO_APP_CLIENT_ID or not S3_BUCKET_NAME:
    raise RuntimeError(
        "Cognito user pool id and cognito app client id must be set and S3 bucket name must be set"
    )