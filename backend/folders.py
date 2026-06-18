"""
Folder management routes - create, list, rename, delete (dept scoped)
Folder are DynamoDB only concept. S3 objects use flat UUID keys and are
unaffected by folder operations

Routes:
    POST /folders
    GET /folders
    PATCH /folders/{id}/rename
    DELETE /fodlers/{id}
"""

import uuid
import logging
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

import dynamodb_client
import s3_client
from dependencies import get_current_employee

router = APIRouter(prefix="/folders", tags=["folders"])
logger = logging.getLogger(__name__)

class CreateFolderRequest(BaseModel):
    name: str
    parent_folder_id: str | None = None

class RenameFolderRequest(BaseModel):
    name: str

@router.post("")
def create_folder(
    body: CreateFolderRequest,
    employee: dict = Depends(get_current_employee),
):
    """
    Create new folder for authenticated employee dept
    """
    department = employee["department"]
    name = body.name.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Folder name cannot empty")
    
    folder_id = str(uuid.uuid4())
    try:
        folder = dynamodb_client.create_folder(
            department=department,
            folder_id=folder_id,
            name=name,
            created_by=employee["email"],
            parent_folder_id=body.parent_folder_id,
        )
    except ClientError as e:
        logger.error("Dynamo DB create folder failed: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to create folder")
    return folder

@router.get("")
def list_folders(
    parent_folder_id: str | None = Query(default=None), 
    employee: dict = Depends(get_current_employee),
):
    """
    List all folders in the authenticated employe's department
    """
    department = employee["department"]
    try:
        folders = dynamodb_client.get_folders_by_department(department, parent_folder_id=parent_folder_id)
    except ClientError as e:
        logger.error("Dynamo DB get folder failed: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to retrieve folders")
    return {"department": department, "folders": folders}

@router.patch("/{folder_id}/rename")
def rename_folder(
    folder_id: str,
    body: RenameFolderRequest,
    employee: dict = Depends(get_current_employee),
):
    """
    Rename folder only patch display name
    """
    department = employee["department"]
    name = body.name.strip()

    if not name:
        raise HTTPException(status_code=400, detail="FOlder name cannot be empty")
    try:
        dynamodb_client.rename_folder(department, folder_id, name)
    except ClientError as e:
        logger.error("DynamoDB rename folder failed: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to rename folder")
    return {"folder_id": folder_id, "name": name}

@router.delete("/{folder_id}")
def delete_folder(
    folder_id: str,
    employee: dict = Depends(get_current_employee),
):
    """
    Delete a folder & cascade-delete all documents inside it.

    Order operation
        1. Fetch all doc in folder
        2. Delete each file S3 object
        3. Delete each file's DynamoDB record
        4. Delete folder record itself
    """
    department = employee["department"]
    try:
        all_folder_ids = [folder_id] + dynamodb_client.get_all_subfolder_ids(
            department, folder_id
        )

        for fid in all_folder_ids:
            files = dynamodb_client.get_documents_by_department(department, folder_id=fid)
            for file in files:
                s3_client.delete_file_by_key(file["s3_key"])
                dynamodb_client.delete_document(department, file["file_id"])
        
        for fid in reversed(all_folder_ids):
            dynamodb_client.delete_folder(department, fid)
    except ClientError as e:
        logger.error("delete folder failed for %s/%s: %s", department, folder_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete folder")

    return {
        "folder_id": folder_id,
        "deleted": True,
        "folders_deleted": len(all_folder_ids),
    }