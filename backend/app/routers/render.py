"""
============================================================================
Render Router - Reader Study MVP
============================================================================
역할: 슬라이스 렌더링 API (서버 사이드 렌더링용)

엔드포인트:
  GET /render/slice - 슬라이스 PNG/JPEG 이미지

슬라이스 파라미터:
  - case_id: 케이스 ID
  - series: baseline | followup
  - z: 슬라이스 인덱스
  - wl: liver | soft (Window/Level 프리셋)

Note:
  AI 오버레이는 NiiVue에서 /nifti/overlay를 통해 직접 렌더링됩니다.
============================================================================
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from typing import Literal

from app.services.nifti_service import nifti_service

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
