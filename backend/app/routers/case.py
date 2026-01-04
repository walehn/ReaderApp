"""
============================================================================
Case Router - Reader Study MVP
============================================================================
역할: 케이스 메타데이터 API

엔드포인트:
  GET /case/meta?case_id=... - 케이스 메타데이터 조회

응답 예시:
  {
    "case_id": "case_0001",
    "shape": [512, 512, 100],
    "slices": 100,
    "spacing": [0.7, 0.7, 2.5],
    "ai_available": true
  }
============================================================================
"""

from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import CaseMeta
from app.services.nifti_service import nifti_service

router = APIRouter(prefix="/case", tags=["Case"])


@router.get("/meta", response_model=CaseMeta)
async def get_case_metadata(
    case_id: str = Query(..., description="케이스 ID (예: case_0001)")
) -> CaseMeta:
    """
    케이스 메타데이터 조회

    Parameters:
        case_id: 케이스 ID

    Returns:
        CaseMeta: shape, slices, spacing, ai_available
    """
    try:
        meta = await nifti_service.get_case_metadata(case_id)
        return meta
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
