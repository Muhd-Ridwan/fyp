"""
Department overview - aggregated stats computed on read from existing
"""

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException

import dynamodb_client
from dependencies import get_current_employee
from documents import CONTENT_TYPE_EXTENSIONS

router = APIRouter(prefix="/overview", tags=["overview"])
logger = logging.getLogger(__name__)

RECENT_UPLOADS_LIMIT = 10
LARGEST_FILES_LIMIT = 5
BUSIEST_FOLDERS_LIMIT = 5


def _file_type_label(content_type: str) -> str:
    extension = CONTENT_TYPE_EXTENSIONS.get(content_type)
    return extension[1:].upper() if extension else "OTHER"


@router.get("")
def get_overview(employee: dict = Depends(get_current_employee)):
    department = employee["department"]
    if not department:
        raise HTTPException(status_code=403, detail="No dept assigned to this acc.")

    try:
        documents = dynamodb_client.get_documents_by_department(department, flat=True)
        folders = dynamodb_client.get_folders_by_department(department, flat=True)
    except ClientError as e:
        logger.error(
            "DynamoDB overview fetch failed for %s: %s", department, e, exc_info=True
        )
        raise HTTPException(status_code=503, detail="Failed to load overview")

    total_documents = len(documents)
    total_storage_bytes = sum(d.get("file_size", 0) for d in documents)

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    uploaded_this_week = sum(
        1 for d in documents if datetime.fromisoformat(d["uploaded_at"]) >= week_ago
    )

    type_counts = Counter(
        _file_type_label(d.get("content_type", "")) for d in documents
    )
    file_types = [
        {
            "extension": ext,
            "count": count,
            "percent": (
                round(count / total_documents * 100, 1) if total_documents else 0
            ),
        }
        for ext, count in type_counts.most_common()
    ]

    recent_uploads = sorted(documents, key=lambda d: d["uploaded_at"], reverse=True)[
        :RECENT_UPLOADS_LIMIT
    ]
    largest_files = sorted(
        documents, key=lambda d: d.get("file_size", 0), reverse=True
    )[:LARGEST_FILES_LIMIT]

    folder_counts = Counter(d["folder_id"] for d in documents if d.get("folder_id"))
    folder_names = {f["folder_id"]: f["name"] for f in folders}
    busiest_folders = [
        {
            "folder_id": folder_id,
            "name": folder_names.get(folder_id, "Unknown folder"),
            "file_count": count,
        }
        for folder_id, count in folder_counts.most_common(BUSIEST_FOLDERS_LIMIT)
    ]

    return {
        "department": department,
        "total_documents": total_documents,
        "total_folders": len(folders),
        "total_storage_bytes": total_storage_bytes,
        "uploaded_this_week": uploaded_this_week,
        "file_types": file_types,
        "recent_uploads": [
            {
                "file_id": d["file_id"],
                "display_name": d["display_name"],
                "uploaded_at": d["uploaded_at"],
            }
            for d in recent_uploads
        ],
        "largest_files": [
            {
                "file_id": d["file_id"],
                "display_name": d["display_name"],
                "file_size": d.get("file_size", 0),
            }
            for d in largest_files
        ],
        "busiest_folders": busiest_folders,
    }
