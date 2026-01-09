"""
============================================================================
NIfTI Router - Reader Study
============================================================================
역할: NIfTI 파일 직접 스트리밍 API (NiiVue WebGL 렌더링용)

엔드포인트:
  GET /nifti/volume - NIfTI 볼륨 파일 스트리밍
  GET /nifti/overlay - AI 확률맵 파일 스트리밍 (AIDED 모드 전용)

응답:
  - Content-Type: application/gzip
  - 원본 .nii.gz 파일 직접 스트리밍

보안:
  - UNAIDED 세션에서 /nifti/overlay 호출 시 403 반환
  - DB 기반 세션 모드 검증 (Phase 3)
============================================================================
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import FileResponse, StreamingResponse
from typing import Literal
from pathlib import Path
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.services.nifti_service import nifti_service
from app.core.dependencies import get_db
from app.models.database import Reader, StudySession

router = APIRouter(prefix="/nifti", tags=["NIfTI"])


@router.get("/volume")
async def get_nifti_volume(
    case_id: str = Query(..., description="케이스 ID"),
    series: Literal["baseline", "followup"] = Query(..., description="시리즈")
):
    """
    NIfTI 볼륨 파일 직접 스트리밍

    Parameters:
        case_id: 케이스 ID (예: "case_0001", "pos_enriched_001_...", "neg_008_...")
        series: baseline 또는 followup

    Returns:
        NIfTI 파일 (.nii.gz) 스트리밍 응답
    """
    # 파일 경로 확인
    filepath = nifti_service._get_volume_filepath(case_id, series)

    if filepath is None or not filepath.exists():
        raise HTTPException(
            status_code=404,
            detail=f"NIfTI file not found for case: {case_id}, series: {series}"
        )

    # 파일 스트리밍 응답
    return FileResponse(
        path=str(filepath),
        media_type="application/gzip",
        filename=f"{case_id}_{series}.nii.gz",
        headers={
            "Content-Disposition": f'attachment; filename="{case_id}_{series}.nii.gz"',
            "Cache-Control": "public, max-age=86400",  # 24시간 캐시
            "X-Case-Id": case_id,
            "X-Series": series,
            # CORS 헤더 (NiiVue에서 접근 가능하도록)
            "Access-Control-Expose-Headers": "X-Case-Id, X-Series"
        }
    )


@router.get("/overlay")
async def get_nifti_overlay(
    case_id: str = Query(..., description="케이스 ID"),
    reader_id: str = Query(..., description="Reader Code (예: R01)"),
    session_id: str = Query(..., description="Session Code (예: S1, S2)"),
    db: AsyncSession = Depends(get_db)
):
    """
    AI 확률맵 NIfTI 파일 스트리밍 (AIDED 모드 전용)

    Parameters:
        case_id: 케이스 ID
        reader_id: Reader Code (예: R01)
        session_id: Session Code (예: S1, S2)

    Returns:
        AI 확률맵 NIfTI 파일 (.nii.gz) 스트리밍 응답

    Raises:
        403: UNAIDED 세션에서 호출 시
        404: AI 확률맵 없음
    """
    # DB 기반 세션 모드 검증
    # reader_code와 session_code로 세션을 찾아서 현재 블록의 모드 확인
    is_aided = await _validate_aided_mode_db(db, reader_id, session_id)
    if not is_aided:
        raise HTTPException(
            status_code=403,
            detail="AI overlay is not available in UNAIDED mode"
        )

    # 파일 경로 확인
    filepath = nifti_service._get_ai_prob_filepath(case_id)

    if filepath is None or not filepath.exists():
        raise HTTPException(
            status_code=404,
            detail=f"AI probability map not found for case: {case_id}"
        )

    # 파일 스트리밍 응답
    return FileResponse(
        path=str(filepath),
        media_type="application/gzip",
        filename=f"{case_id}_ai_prob.nii.gz",
        headers={
            "Content-Disposition": f'attachment; filename="{case_id}_ai_prob.nii.gz"',
            "Cache-Control": "public, max-age=86400",
            "X-Case-Id": case_id,
            "Access-Control-Expose-Headers": "X-Case-Id"
        }
    )


async def _validate_aided_mode_db(
    db: AsyncSession,
    reader_code: str,
    session_code: str
) -> bool:
    """
    DB 기반으로 현재 세션이 AIDED 모드인지 검증

    Args:
        db: DB 세션
        reader_code: Reader Code (예: R01)
        session_code: Session Code (예: S1, S2)

    Returns:
        True if current block is AIDED mode
    """
    import logging
    logger = logging.getLogger(__name__)

    # Reader 조회
    logger.info(f"[OVERLAY DEBUG] Looking for reader: {reader_code}, session: {session_code}")
    reader_result = await db.execute(
        select(Reader).where(Reader.reader_code == reader_code)
    )
    reader = reader_result.scalar_one_or_none()
    if reader is None:
        logger.warning(f"[OVERLAY DEBUG] Reader not found: {reader_code}")
        return False
    logger.info(f"[OVERLAY DEBUG] Found reader id={reader.id}")

    # Session 조회 (해당 리더의 해당 session_code)
    session_result = await db.execute(
        select(StudySession)
        .options(selectinload(StudySession.progress))
        .where(
            and_(
                StudySession.reader_id == reader.id,
                StudySession.session_code == session_code
            )
        )
    )
    session = session_result.scalar_one_or_none()
    if session is None:
        logger.warning(f"[OVERLAY DEBUG] Session not found for reader={reader.id}, session_code={session_code}")
        return False

    logger.info(f"[OVERLAY DEBUG] Found session id={session.id}, block_a={session.block_a_mode}, block_b={session.block_b_mode}")

    # 현재 블록의 모드 확인
    progress = session.progress
    if progress is None:
        # 세션이 시작되지 않았으면 Block A로 가정
        current_block = "A"
        logger.info(f"[OVERLAY DEBUG] No progress, assuming block A")
    else:
        current_block = progress.current_block
        logger.info(f"[OVERLAY DEBUG] Current block: {current_block}")

    # 현재 블록에 따른 모드 반환
    if current_block == "A":
        is_aided = session.block_a_mode == "AIDED"
    else:
        is_aided = session.block_b_mode == "AIDED"

    logger.info(f"[OVERLAY DEBUG] Result: is_aided={is_aided}")
    return is_aided


@router.get("/info")
async def get_nifti_info(
    case_id: str = Query(..., description="케이스 ID"),
    series: Literal["baseline", "followup"] = Query(..., description="시리즈")
):
    """
    NIfTI 파일 정보 조회 (다운로드 없이 메타데이터만)

    Parameters:
        case_id: 케이스 ID
        series: baseline 또는 followup

    Returns:
        파일 크기, 경로 등 정보
    """
    filepath = nifti_service._get_volume_filepath(case_id, series)

    if filepath is None or not filepath.exists():
        raise HTTPException(
            status_code=404,
            detail=f"NIfTI file not found for case: {case_id}, series: {series}"
        )

    # 파일 정보
    stat = filepath.stat()

    return {
        "case_id": case_id,
        "series": series,
        "filename": filepath.name,
        "size_bytes": stat.st_size,
        "size_mb": round(stat.st_size / (1024 * 1024), 2),
        "url": f"/nifti/volume?case_id={case_id}&series={series}"
    }
