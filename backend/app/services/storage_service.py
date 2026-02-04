from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

from app.config import (
    S3_BUCKET,
    SUPABASE_SERVICE_KEY,
    SUPABASE_STORAGE_BUCKET,
    SUPABASE_URL,
)


def _safe_filename(filename: str) -> str:
    # Avoid path traversal and normalize spacing.
    base_name = Path(filename).name
    return base_name.replace(" ", "_")


def _supabase_enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY and SUPABASE_STORAGE_BUCKET)


def _upload_to_supabase_storage(
    filename: str, content: bytes, overwrite_key: Optional[str] = None
) -> str:
    """
    Upload to Supabase Storage and return the object key.

    If overwrite_key is set, upload to that path (replaces existing object).
    Notes:
    - Uses `SUPABASE_SERVICE_KEY` (server-only).
    - Stores into bucket `SUPABASE_STORAGE_BUCKET` (default: `resumes`).
    """
    try:
        from supabase import create_client  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "Supabase Storage is configured but the `supabase` package is not installed. "
            "Add `supabase` to backend/requirements.txt."
        ) from exc

    safe_name = _safe_filename(filename)
    if overwrite_key:
        object_key = overwrite_key
    else:
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        object_key = f"uploads/{timestamp}_{safe_name}"

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    file_options = {"upsert": "true"} if overwrite_key else None
    response = client.storage.from_(SUPABASE_STORAGE_BUCKET).upload(
        object_key, content, file_options=file_options
    )
    error = getattr(response, "error", None)
    if error is None and isinstance(response, dict):
        error = response.get("error")
    if error:
        raise RuntimeError(f"Supabase upload failed: {error}")
    return object_key


def save_resume_file(
    filename: str, content: bytes, overwrite_key: Optional[str] = None
) -> Optional[str]:
    """Persist a resume file and return the storage key.

    If overwrite_key is provided, replace the file at that key (avoids duplicate copies).
    If S3 is configured, this will return an S3 object key placeholder.
    Otherwise, it saves to a local storage directory for dev.
    """

    if _supabase_enabled():
        return _upload_to_supabase_storage(filename, content, overwrite_key)

    if S3_BUCKET:
        # Placeholder for S3 upload - add boto3 integration later.
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        safe_name = _safe_filename(filename)
        return f"s3://{S3_BUCKET}/resumes/{timestamp}_{safe_name}"

    storage_dir = Path(__file__).resolve().parent.parent / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    safe_name = _safe_filename(filename)
    if overwrite_key:
        key_path = Path(overwrite_key)
        target_path = key_path if key_path.is_absolute() else storage_dir / overwrite_key.lstrip("uploads/")
        target_path.parent.mkdir(parents=True, exist_ok=True)
    else:
        target_path = storage_dir / safe_name
    target_path.write_bytes(content)
    return str(target_path)
