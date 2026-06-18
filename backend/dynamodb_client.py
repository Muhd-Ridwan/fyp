"""
DynamoDB access for the Employee table.

Uses boto3 with the fyp-backend IAM user's credentials (picked up auto from env)
Per the Architecture Conclusion: DynamoDB stores profile + department data ONLY - no passwords.
Cognito owns authentication entirely.
"""

import boto3
import config
from datetime import datetime, timezone

_dynamodb = boto3.resource("dynamodb", region_name=config.AWS_REGION)
_employees_table = _dynamodb.Table(config.DYNAMODB_EMPLOYEES_TABLE)
_folders_table = _dynamodb.Table(config.DYNAMODB_FOLDERS_TABLE)
_documents_table = _dynamodb.Table(config.DYNAMODB_DOCUMENTS_TABLE)

# EMPLOYEES

def get_employee_by_email(email: str) -> dict | None:
    """
    Look up employee profile by email(Email = table partition key).

    Returns the item dict (name, dept, role, ...) or None if no matching record exists
    """
    response = _employees_table.get_item(Key={"email": email})
    return response.get("Item")


# FOLDERS

def create_folder(department: str, folder_id: str, name: str, created_by: str, parent_folder_id: str | None = None) -> dict:
    """
    Create a new folder record for a department.
    """

    item = {
        "department": department,
        "folder_id": folder_id,
        "name": name,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if parent_folder_id:
        item["parent_folder_id"] = parent_folder_id
    _folders_table.put_item(Item=item)
    return item

def get_folders_by_department(department: str, parent_folder_id: str | None = None,) -> list[dict]:
    """
    Return all folder belongs to dept
    """
    response = _folders_table.query(
        KeyConditionExpression="department = :dept",
        ExpressionAttributeValues={":dept": department},
    )
    items = response.get("Items", [])

    if parent_folder_id is None:
        # Root level - folders with no parent_folder_id attribute
        items = [item for item in items if "parent_folder_id" not in item]
    else:
        items = [
            item for item in items
            if item.get("parent_folder_id") == parent_folder_id
        ]
    return sorted(items, key=lambda x: x.get("created_at", ""))

def rename_folder(department: str, folder_id: str, new_name: str) -> None:
    """
    Update folder display name. Not UUID
    """
    _folders_table.update_item(
        Key={"department": department, "folder_id": folder_id},
        UpdateExpression="SET #n = :name",
        ExpressionAttributeNames={"#n": "name"},
        ExpressionAttributeValues={":name": new_name},
    )

def delete_folder(department: str, folder_id: str)-> None:
    """
    Delete a folder record. Does not automatically delete files inside it.
    Caller is responsible for handling orphaned documents if needed.
    """
    _folders_table.delete_item(
        Key={"department": department, "folder_id": folder_id}
    )

def get_all_subfolder_ids(department: str, folder_id: str) -> list[str]:
    """
    Recursively collect all sub-folder IDS under a given folder.
    Used by delete_fodler to cascade delete nested folders
    """
    all_ids: list[str] = []
    queue = [folder_id]
    while queue:
        current = queue.pop()
        sub_folders = get_folders_by_department(department, parent_folder_id=current)
        for sf in sub_folders:
            all_ids.append(sf["folder_id"])
            queue.append(sf["folder_id"])
    return all_ids

# DOCUMENTS

def create_document(
    department: str,
    file_id: str,
    display_name: str,
    s3_key: str,
    uploaded_by: str,
    file_size: int,
    content_type: str,
    folder_id: str | None = None,
) -> dict:
    """
    Create a document metadata record after successful S3 Upload.
    s3_key is a stable UUID-based path - display name is what user sees.
    folder_id None for root-level files.
    """
    item ={
        "department": department,
        "file_id": file_id,
        "display_name": display_name,
        "s3_key": s3_key,
        "uploaded_by": uploaded_by,
        "file_size": file_size,
        "content_type": content_type,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    if folder_id:
        item["folder_id"] = folder_id
    _documents_table.put_item(Item=item)
    return item

def get_documents_by_department(
        department: str, folder_id: str | None = None
) -> list[dict]:
    """
    Return all documents for a department.
    If folder_id is provided, returns only files inside that folder.
    If folder_id None, returns root files
    """
    response = _documents_table.query(
        KeyConditionExpression="department = :dept",
        ExpressionAttributeValues={":dept": department},
    )
    items = response.get("Items", [])

    if folder_id is None:
        items = [item for item in items if "folder_id" not in item]
    else:
        items = [item for item in items if item.get("folder_id") == folder_id]
    
    return sorted(items, key=lambda x: x.get("uploaded_at", ""), reverse=True)

def get_document(department: str, file_id: str) -> dict | None:
    """
    Fetch a single document record by department + file_id.
    Returns None if not found
    """
    response = _documents_table.get_item(
        Key={"department": department, "file_id": file_id}
    )
    return response.get("Item")

def rename_document(department: str, file_id: str, new_name: str) -> None:
    """
    Update a document name display name only
    """
    _documents_table.update_item(
        Key={"department": department, "file_id": file_id,},
        UpdateExpression="SET display_name = :name",
        ExpressionAttributeValues={":name": new_name},
    )

def delete_document(department: str, file_id: str) -> None:
    """
    Delete a document metadata record from DynamoDB
    Caller separately delete the S3 object using file's s3 key
    """
    _documents_table.delete_item(
        Key={"department": department, "file_id": file_id}
    )

def get_all_employees() -> list[dict]:
    response = _employees_table.scan()
    return response.get("Items", [])

def create_employee(email: str, name: str, department: str, role: str) -> None:
    _employees_table.put_item(Item={
        "email": email,
        "name": name,
        "department": department,
        "role": role,
        "status": "active",
    })

def update_employee_department(email: str, department: str) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="SET department = :dept",
        ExpressionAttributeValues={":dept", department},
    )

def set_employee_status(email: str, status: str) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="SET #s = :status",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":status" status},
    )

def update_employee_onboarding(email: str, personal_email: str, nric_last4_hash: str) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="SET personal_email = :pe, nric_last4_hash = :nh, onboarding_complete = :oc",
        ExpressionAttributeValues={
            ":pe": personal_email,
            ":nh": nric_last4_hash,
            ":oc": True,
        },
    )

def update_employee_reset_token(email:str, token: str, expiry: int) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="SET reset_token = :t, reset_token_expiry = :e",
        ExpressionAttributeValues={":t", token, ":e": expiry},
    )

def clear_employee_reset_token(email: str) -> None:
    _employees_table.update_item(
        Key={"email", email},
        UpdateExpression="REMOVE reset_token, reset_token_expiry",
    )

def update_employee_profile(email: str, address: str, phone: str) -> None:
    _employees_table.update_item(
        Key={"email": email},
        UpdateExpression="SET address = :a, phone = :p",
        ExpressionAttributeValues={":a": address, ":p": phone},
    )
