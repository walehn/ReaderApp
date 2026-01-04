"""
============================================================================
Render Router - Reader Study MVP
============================================================================
역할: 슬라이스 및 AI 오버레이 렌더링 API

엔드포인트:
  GET /render/slice - 슬라이스 JPEG 이미지
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
============================================================================
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from typing import Literal

from app.services.nifti_service import nifti_service
from app.services.session_service import session_service

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
    reader_id: str = Query(..., description="Reader ID (모드 검증용)"),
    session_id: str = Query(..., description="Session ID (모드 검증용)")
) -> Response:
    """
    AI 확률맵 오버레이 렌더링 (AIDED 모드 전용)

    Parameters:
        case_id: 케이스 ID
        z: Z축 슬라이스 인덱스
        threshold: 확률 임계값 (기본 0.30)
        alpha: 오버레이 투명도 (기본 0.4)
        reader_id: Reader ID
        session_id: Session ID

    Returns:
        PNG 이미지 (투명도 포함)

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
