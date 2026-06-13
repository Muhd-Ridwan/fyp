"""
DynamoDB access for the Employee table.

Uses boto3 with the fyp-backend IAM user's credentials (picked up auto from env)
Per the Architecture Conclusion: DynamoDB stores profile + department data ONLY - no passwords.
Cognito owns authentication entirely.
"""

import boto3
import config

_dynamodb = boto3.resource("dynamodb", region_name=config.AWS_REGION)
_employees_table = _dynamodb.Table(config.DYNAMODB_EMPLOYEES_TABLE)

def get_employee_by_email(email: str) -> dict | None:
    """
    Look up employee profile by email(Email = table partition key).

    Returns the item dict (name, dept, role, ...) or None if no matching record exists
    """
    response = _employees_table.get_item(Key={"email": email})
    return response.get("Item")