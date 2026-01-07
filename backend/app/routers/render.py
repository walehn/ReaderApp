"""
============================================================================
Render Router - Reader Study MVP
============================================================================
역할: 슬라이스 및 AI 오버레이 렌더링 API

엔드포인트:
  GET /render/slice - 슬라이스 PNG 이미지
  GET /render/overlay - AI 확률맵 오버레이 (AIDED 모드 전용)

슬라이스 파라미터:
  - case_id: 케이스 ID
  - series: baseline | followup
  - z: 슬라이스 인덱스
  - wl: liver | soft (Window/Level 프리셋)

오버레이 파라미터:
  - case_id, z, threshold, alpha
  - reader_id, session_id (모드 검증용)

보안:
  - UNAIDED 세션에서 /render/overlay 호출 시 403 반환
  - DB 기반 세션 검증 (Phase 3)
============================================================================
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import Response
from typing import Literal
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.services.nifti_service import nifti_service
from app.models.database import Reader, StudySession
from app.core.dependencies import get_db

router = APIRouter(prefix="/render", tags=["Render"])


@router.get("/slice")
async def render_slice(
    case_id: str = Query(..., description="케이스 ID"),
    series: Literal["baseline", "followup"] = Query(..., description="시리즈"),
    z: int = Query(..., ge=0, description="슬라이스 인덱스"),
    wl: Literal["liver", "soft"] = Query(default="liver", description="W/L 프리셋"),
    format: Literal["png", "jpeg"] = Query(default="png", description="이미지 포맷 (png=무손실, jpeg=손실)")
) -> Response:
    """
    슬라이스 이미지 렌더링

    Parameters:
        case_id: 케이스 ID
        series: baseline 또는 followup
        z: Z축 슬라이스 인덱스
        wl: Window/Level 프리셋
        format: png (무손실, 권장) 또는 jpeg (손실)

    Returns:
        PNG 또는 JPEG 이미지
    """
    try:
        image_bytes, media_type = await nifti_service.render_slice(
            case_id, series, z, wl, format
        )
        return Response(
            content=image_bytes,
            media_type=media_type,
            headers={
                "Cache-Control": "public, max-age=3600",
                "X-Case-Id": case_id,
                "X-Series": series,
                "X-Slice": str(z),
                "X-Format": format
            }
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Render error: {str(e)}")


@router.get("/overlay")
async def render_overlay(
    case_id: str = Query(..., description="케이스 ID"),
    z: int = Query(..., ge=0, description="슬라이스 인덱스"),
    threshold: float = Query(default=0.30, ge=0.0, le=1.0),
    alpha: float = Query(default=0.4, ge=0.0, le=1.0),
    reader_id: str = Query(..., description="Reader Code (모드 검증용, 예: TEST1)"),
    session_id: str = Query(..., description="Session Code (모드 검증용, 예: S1)"),
    db: AsyncSession = Depends(get_db)
) -> Response:
    """
    AI 확률맵 오버레이 렌더링 (AIDED 모드 전용)

    Parameters:
        case_id: 케이스 ID
        z: Z축 슬라이스 인덱스
        threshold: 확률 임계값 (기본 0.30)
        alpha: 오버레이 투명도 (기본 0.4)
        reader_id: Reader Code (예: TEST1)
        session_id: Session Code (예: S1)

    Returns:
        PNG 이미지 (투명도 포함)

    Raises:
        403: UNAIDED 세션에서 호출 시
        404: AI 확률맵 없음
    """
    # DB 기반 세션 모드 검증
    # 1. Reader 조회 (reader_code로)
    reader_result = await db.execute(
        select(Reader).where(Reader.reader_code == reader_id)
    )
    reader = reader_result.scalar_one_or_none()

    if reader is None:
        raise HTTPException(
            status_code=403,
            detail=f"Reader not found: {reader_id}"
        )

    # 2. Session 조회 (reader_id + session_code로)
    session_result = await db.execute(
        select(StudySession).where(
            and_(
                StudySession.reader_id == reader.id,
                StudySession.session_code == session_id
            )
        )
    )
    session = session_result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=403,
            detail=f"Session not found: {session_id}"
        )

    # 3. 현재 블록의 모드 확인
    # progress가 없으면 Block A, 있으면 current_block 사용
    session_with_progress_result = await db.execute(
        select(StudySession)
        .options(selectinload(StudySession.progress))
        .where(StudySession.id == session.id)
    )
    session = session_with_progress_result.scalar_one_or_none()

    current_block = "A"
    if session.progress:
        current_block = session.progress.current_block or "A"

    # 현재 블록의 모드 확인
    current_mode = session.block_a_mode if current_block == "A" else session.block_b_mode

    if current_mode != "AIDED":
        raise HTTPException(
            status_code=403,
            detail=f"AI overlay is not available in {current_mode} mode"
        )

    try:
        png_bytes = await nifti_service.render_overlay(
            case_id, z, threshold, alpha
        )

        if png_bytes is None:
            raise HTTPException(
                status_code=404,
                detail=f"AI probability map not found for case: {case_id}"
            )

        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=3600",
                "X-Case-Id": case_id,
                "X-Slice": str(z),
                "X-Threshold": str(threshold)
            }
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Overlay error: {str(e)}")
