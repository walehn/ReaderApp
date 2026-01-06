"""
============================================================================
Case Router - Reader Study MVP
============================================================================
역할: 케이스 메타데이터 및 동적 케이스 할당 API

엔드포인트:
  GET /case/meta?case_id=... - 케이스 메타데이터 조회
  GET /case/available - Dataset 폴더의 사용 가능한 케이스 목록
  GET /case/allocation-preview - 세션/블록별 케이스 할당 미리보기

응답 예시:
  /case/meta:
  {
    "case_id": "case_0001",
    "shape": [512, 512, 100],
    "slices": 100,
    "spacing": [0.7, 0.7, 2.5],
    "ai_available": true
  }

  /case/available:
  {
    "positive": ["pos_enriched_001_10667525", ...],
    "negative": ["neg_008_11155933", ...],
    "total": 100
  }
============================================================================
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List
from app.models.schemas import CaseMeta
from app.services.nifti_service import nifti_service
from app.services.case_discovery_service import case_discovery_service

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


@router.get("/available")
async def get_available_cases() -> Dict:
    """
    Dataset 폴더에서 사용 가능한 케이스 목록 조회

    Returns:
        {
            "positive": ["pos_enriched_001_...", ...],
            "negative": ["neg_008_...", ...],
            "total": N
        }
    """
    try:
        cases = case_discovery_service.scan_dataset_cases()
        count = case_discovery_service.get_total_case_count()

        return {
            "positive": [c.case_id for c in cases["positive"]],
            "negative": [c.case_id for c in cases["negative"]],
            "positive_count": count["positive"],
            "negative_count": count["negative"],
            "total": count["total"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"케이스 스캔 오류: {str(e)}")


@router.get("/allocation-preview")
async def get_allocation_preview(
    num_sessions: int = Query(..., ge=1, description="세션 수"),
    num_blocks: int = Query(default=2, ge=1, description="블록 수 (기본: 2)")
) -> Dict:
    """
    세션/블록별 케이스 할당 미리보기

    Parameters:
        num_sessions: 총 세션 수
        num_blocks: 블록 수 (기본 2)

    Returns:
        {
            "total_cases": N,
            "cases_per_session": M,
            "cases_per_block": K,
            "unused_cases": R
        }
    """
    try:
        preview = case_discovery_service.get_allocation_preview(
            num_sessions=num_sessions,
            num_blocks=num_blocks
        )
        return preview
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"할당 계산 오류: {str(e)}")


@router.get("/allocate")
async def allocate_cases(
    num_sessions: int = Query(..., ge=1, description="세션 수"),
    num_blocks: int = Query(default=2, ge=1, description="블록 수 (기본: 2)"),
    shuffle: bool = Query(default=True, description="랜덤 셔플 여부")
) -> Dict:
    """
    세션/블록별 케이스 할당 실행

    Parameters:
        num_sessions: 총 세션 수
        num_blocks: 블록 수 (기본 2)
        shuffle: 랜덤 셔플 여부 (기본 True)

    Returns:
        {
            "total_cases": N,
            "cases_per_session": M,
            "cases_per_block": K,
            "sessions": {
                "S1": {"block_a": [...], "block_b": [...]},
                ...
            }
        }
    """
    try:
        allocation = case_discovery_service.allocate_cases_to_session(
            num_sessions=num_sessions,
            num_blocks=num_blocks,
            shuffle=shuffle
        )
        return allocation
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"케이스 할당 오류: {str(e)}")
