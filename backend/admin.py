import logging
import boto3
import config
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from dependencies import get_current_employee
from dynamodb_client import (
    create_employee,
    get_all_employees,
    get_employee_by_email,
    update_employee_department,
    set_employee_status,
)

router = APIRouter(prefix="/admin")
logger = logging.getLogger(__name__)
_cognito = boto3.client("cognito-idp", region_name=config.AWS_REGION)

def require_admin(employee: dict = Depends(get_current_employee)) -> dict:
    if employee.get("role") != "System Administrator":
        raise HTTPException(status_code=403, detail="Admin access required")
    return employee

class RegisterEmployeeRequest(BaseModel):
    email: str
    name: str
    department: str
    role: str

class UpdateDepartmentRequest(BaseModel):
    department: str

@router.post("/register", status_code=201)
def register_employee(
    body: RegisterEmployeeRequest,
    _: dict = Depends(require_admin),
):
    try:
        _cognito.admin_create_user(
            UserPoolId=config.COGNITO_USER_POOL_ID,
            Username=body.email,
            UserAttributes=[{"Name": "email", "Value": body.email}],
            DesiredDeliveryMediums=["EMAIL"],
        )
    except _cognito.exceptions.UsernameExistsException:
        raise HTTPException(status_code=409, detail="Employee already exists")
    except ClientError as e:
        logger.error("Cognito admin create user failed: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="Failed to create Cognito account")
    
    try:
        create_employee(
            email=body.email,
            name=body.name,
            department=body.department,
            role=body.role,
        )
    except ClientError as e:
        logger.error("DynamoDB create_employee failed for %s: %s", body.email, e, exc_info=True)
        try:
            _cognito.admin_delete_user(
                UserPoolId=config.COGNITO_USER_POOL_ID,
                Username=body.email,
            )
        except ClientError:
            logger.error("Rollback failed — Cognito user %s left orphaned", body.email)
        raise HTTPException(status_code=503, detail="Failed to save employee record")
    return {"message": "Employee registered successfully"}

@router.get("/employees")
def list_employees(_: dict = Depends(require_admin)):
    try:
        return get_all_employees()
    except ClientError as e:
        logger.error("DynamoDB get all employees failed: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to retrieve employees")

@router.put("/employees/{email}")
def update_employee(
    email: str,
    body: UpdateDepartmentRequest,
    _: dict = Depends(require_admin),
):
    if get_employee_by_email(email) is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    try:
        update_employee_department(email=email, department=body.department)
    except ClientError as e:
        logger.error("DynamoDB update employee failed: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to update employee")
    return {"message": "Department updated"}

@router.post("/employees/{email}/lock")
def lock_employee(email: str, _: dict = Depends(require_admin)):
    try:
        _cognito.admin_disable_user(
            UserPoolId=config.COGNITO_USER_POOL_ID,
            Username=email,
        )
    except _cognito.exceptions.UserNotFoundException:
        raise HTTPException(status_code=404, detail="Employee not found")
    except ClientError as e:
        logger.error("Cognito admin disable user failed for %s: %s", email, e, exc_info=True)
        raise HTTPException(status_code=502, detail="Failed to lock account")
    try:
        set_employee_status(email=email, status="locked")
    except ClientError as e:
        logger.error("DynamoDB set employee status failed for %s: %s", email, e, exc_info=True)
        raise HTTPException(status_code=503, detail="Account locked in cognito but failed to update status")
    return {"message": "Employee locked"}

@router.post("/employees/{email}/unlock")
def unlock_employee(email: str, _: dict = Depends(require_admin)):
    try:
        _cognito.admin_enable_user(
            UserPoolId=config.COGNITO_USER_POOL_ID,
            Username=email,
        )
    except _cognito.exceptions.UserNotFoundException:
        raise HTTPException(status_code=404, detail="Employee not found in Cognito")
    except ClientError as e:
        logger.error("Cognito enabling user failed for %s: %s", email, e, exc_info=True)
        raise HTTPException(status_code=502, detail="Failed to unlock account")
    try:
        set_employee_status(email=email, status="active")
    except ClientError as e:
        logger.error("DynamoDB set status failed for %s: %s", email, e, exc_info=True)
        raise HTTPException(status_code=503, detail="Account unlocked in Cognito but failed to update status")
    return {"message": "Employee unlocked"}
