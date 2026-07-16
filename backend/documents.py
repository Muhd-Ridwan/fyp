"""
Documents management routes - upload, list, download

Upload flow:
    file received
        1,. generate UUID as file_id
        2. S3 upload at '{department}/{file_uuid}'
        3, DynamoDB record created: {file_id, display_name, s3_key, .....}
"""

import os
import uuid
import io
import logging
import dynamodb_client
import s3_client
import asyncio

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from dependencies import get_current_employee
from rag import index_document, delete_document_vectors
from botocore.exceptions import ClientError

router = APIRouter(prefix="/documents", tags=["documents"])
logger = logging.getLogger(__name__)


class RenameDocumentRequest(BaseModel):
    name: str


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    folder_id: str | None = Query(default=None),
    employee: dict = Depends(get_current_employee),
):
    """
    Upload a document to the authenticated employee's department folder in S3 & Create metadata in DynamoDB

    folder_id query param is optional:
        None = file stores in root
        <uuid> = files stored in that folder
    """

    department = employee["department"]
    if not department:
        raise HTTPException(
            status_code=403, detail="No department assigned to this account."
        )

    # Cleaning display name
    display_name = os.path.basename(file.filename or "")
    if not display_name:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_id = str(uuid.uuid4())
    s3_key = f"{department}/{file_id}"
    content_type = file.content_type or "application/octet-stream"

    # Upload bytes to S3
    file_bytes = await file.read()
    try:
        s3_client.upload_file_by_key(io.BytesIO(file_bytes), s3_key, content_type)
    except ClientError as e:
        logger.error("S3 upload failed for %s: %s", s3_key, e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to upload file to storage")

    try:
        # Write metadata to DynamoDB
        document = dynamodb_client.create_document(
            department=department,
            file_id=file_id,
            display_name=display_name,
            s3_key=s3_key,
            uploaded_by=employee["email"],
            file_size=file.size or 0,
            content_type=content_type,
            folder_id=folder_id,
        )
    except ClientError as e:
        logger.error(
            "DynamoDB create document failed for %s: %s", file_id, e, exc_info=True
        )
        try:
            s3_client.delete_file_by_key(s3_key)
        except ClientError:
            logger.error("S3 rollback failed - orphaned key %s", s3_key)
        raise HTTPException(status_code=503, detail="Failed to save file record")

    try:
        await asyncio.to_thread(
            index_document, file_bytes, display_name, file_id, department
        )

    except Exception as e:
        logger.error(
            "RAG indexing failed for %s (%s): %s",
            file_id,
            display_name,
            e,
            exc_info=True,
        )

    return document


@router.get("/list")
def list_documents(
    folder_id: str | None = Query(default=None),
    flat: bool = Query(default=False),
    employee: dict = Depends(get_current_employee),
):
    """
    List all documents in the authenticated employee's dept folder
    folder_id omitted at root level
    """
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="No dept assigned to this acc.")

    try:
        files = dynamodb_client.get_documents_by_department(
            department, folder_id=folder_id, flat=flat
        )
    except ClientError as e:
        logger.error("DynamoDB get documents failed: %s", e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to retrieve documents")

    return {"department": department, "folder_id": folder_id, "files": files}


@router.get("/download/{file_id}")
def download_document(
    file_id: str,
    employee: dict = Depends(get_current_employee),
):
    """
    Generate a URL to download the file
    """
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="No dept assigned")
    document = dynamodb_client.get_document(department, file_id)
    if document is None:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        url = s3_client.generate_download_url(
            s3_key=document["s3_key"],
            filename=document["display_name"],
        )
    except ClientError as e:
        logger.error(
            "S3 presign failed for %s: %s", document["s3_key"], e, exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to generate download link")

    return {
        "file_id": file_id,
        "filename": document["display_name"],
        "url": url,
    }


@router.patch("/{file_id}/rename")
def rename_document(
    file_id: str,
    body: RenameDocumentRequest,
    employee: dict = Depends(get_current_employee),
):
    """
    Rename a doc display name
    """
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="Noe dept assigned to this acc.")

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="File name cannot empty")

    document = dynamodb_client.get_document(department, file_id)
    if document is None:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        dynamodb_client.rename_document(department, file_id, name)
    except ClientError as e:
        logger.error(
            "DynamoDB rename_document failed for %s: %s", file_id, e, exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to rename file")

    return {"file_id": file_id, "display_name": name}


@router.delete("/{file_id}")
def delete_document(
    file_id: str,
    employee: dict = Depends(get_current_employee),
):
    """
    Delete a doc - S3 object first, then dynamodb record.
    If S3 delete fails, dynamodb record stays
    """
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="No dept assigned to this acc.")
    document = dynamodb_client.get_document(department, file_id)
    if document is None:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        delete_document_vectors(file_id, department)
    except Exception as e:
        logger.error("Pinecone delete failed for %s: %s", file_id, e, exc_info=True)
        raise HTTPException(status_code=503, detail="Failed to delete file vectors")

    try:
        s3_client.delete_file_by_key(document["s3_key"])
    except ClientError as e:
        logger.error(
            "S3 delete failed for %s: %s", document["s3_key"], e, exc_info=True
        )
        raise HTTPException(
            status_code=503, detail="Failed to delete file from storage"
        )

    try:
        dynamodb_client.delete_document(department, file_id)
    except ClientError as e:
        logger.error(
            "DyanmoDB delete_document failed for %s: %s", file_id, e, exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to delete file record")

    return {"file_id": file_id, "deleted": True}
