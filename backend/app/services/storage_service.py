from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

from app.config import S3_BUCKET

def save_resume_file(filename: str, content: bytes) -> Optional[str]:
    """Persist a resume file and return the storage key.

    If S3 is configured, this will return an S3 object key placeholder.
    Otherwise, it saves to a local storage directory for dev.
    """

    if S3_BUCKET:
        # Placeholder for S3 upload - add boto3 integration later.
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"s3://{S3_BUCKET}/resumes/{timestamp}_{filename}"

    storage_dir = Path(__file__).resolve().parent.parent / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    safe_name = filename.replace(" ", "_")
    target_path = storage_dir / safe_name
    target_path.write_bytes(content)
    return str(target_path)
