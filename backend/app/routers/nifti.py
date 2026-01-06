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
============================================================================
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from typing import Literal
from pathlib import Path

from app.services.nifti_service import nifti_service
from app.services.session_service import session_service

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
    reader_id: str = Query(..., description="Reader ID (모드 검증용)"),
    session_id: str = Query(..., description="Session ID (모드 검증용)")
):
    """
    AI 확률맵 NIfTI 파일 스트리밍 (AIDED 모드 전용)

    Parameters:
        case_id: 케이스 ID
        reader_id: Reader ID
        session_id: Session ID

    Returns:
        AI 확률맵 NIfTI 파일 (.nii.gz) 스트리밍 응답

    Raises:
        403: UNAIDED 세션에서 호출 시
        404: AI 확률맵 없음
    """
    # 세션 모드 검증 - UNAIDED면 403
    if not session_service.validate_ai_access(reader_id, session_id):
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
