"""
============================================================================
Admin Router - Reader Study MVP
============================================================================
역할: 관리자용 데이터 내보내기 및 시스템 관리 API

엔드포인트:
  GET /admin/export - 결과 데이터 내보내기 (CSV/JSON)
  GET /admin/sessions - 사용 가능한 세션 목록
  GET /admin/cache-stats - 캐시 통계

내보내기 형식:
  - CSV: 환자 수준 테이블 + 병변 수준 테이블
  - JSON: 전체 데이터 구조화

필터 옵션:
  - session_id: 특정 세션만
  - reader_id: 특정 Reader만
============================================================================
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import Response, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Literal, Optional
import csv
import json
from io import StringIO

from app.models.database import get_db, StudyResult, LesionMark
from app.services.session_service import session_service
from app.services.cache_service import get_cache_stats, clear_all_caches

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/export")
async def export_results(
    format: Literal["csv", "json"] = Query(default="csv"),
    session_id: Optional[str] = Query(default=None),
    reader_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db)
) -> Response:
    """
    결과 데이터 내보내기

    Parameters:
        format: 출력 형식 (csv | json)
        session_id: 필터 - 세션 ID (선택)
        reader_id: 필터 - Reader ID (선택)

    Returns:
        CSV 또는 JSON 파일
    """
    # 쿼리 빌드
    query = select(StudyResult).options(selectinload(StudyResult.lesions))

    if session_id:
        query = query.where(StudyResult.session_id == session_id)
    if reader_id:
        query = query.where(StudyResult.reader_id == reader_id)

    query = query.order_by(
        StudyResult.reader_id,
        StudyResult.session_id,
        StudyResult.case_id
    )

    result = await db.execute(query)
    results = result.scalars().all()

    if format == "json":
        return _export_json(results)
    else:
        return _export_csv(results)


def _export_json(results: list[StudyResult]) -> JSONResponse:
    """JSON 형식 내보내기"""
    data = {
        "patient_level": [],
        "lesion_level": []
    }

    for r in results:
        # 환자 수준
        data["patient_level"].append({
            "reader_id": r.reader_id,
            "session_id": r.session_id,
            "mode": r.mode,
            "case_id": r.case_id,
            "patient_decision": r.patient_decision,
            "lesion_count": len(r.lesions),
            "time_spent_sec": r.time_spent_sec,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })

        # 병변 수준
        for lesion in r.lesions:
            data["lesion_level"].append({
                "reader_id": r.reader_id,
                "session_id": r.session_id,
                "case_id": r.case_id,
                "lesion_order": lesion.mark_order,
                "x": lesion.x,
                "y": lesion.y,
                "z": lesion.z,
                "confidence": lesion.confidence
            })

    return JSONResponse(
        content=data,
        headers={
            "Content-Disposition": "attachment; filename=reader_study_results.json"
        }
    )


def _export_csv(results: list[StudyResult]) -> Response:
    """CSV 형식 내보내기 (환자 수준)"""
    output = StringIO()
    writer = csv.writer(output)

    # 헤더
    writer.writerow([
        "reader_id", "session_id", "mode", "case_id",
        "patient_decision", "lesion_count", "time_spent_sec", "created_at",
        # 병변 정보 (최대 3개)
        "lesion1_x", "lesion1_y", "lesion1_z", "lesion1_conf",
        "lesion2_x", "lesion2_y", "lesion2_z", "lesion2_conf",
        "lesion3_x", "lesion3_y", "lesion3_z", "lesion3_conf"
    ])

    # 데이터 행
    for r in results:
        row = [
            r.reader_id, r.session_id, r.mode, r.case_id,
            int(r.patient_decision), len(r.lesions), r.time_spent_sec,
            r.created_at.isoformat() if r.created_at else ""
        ]

        # 병변 정보 (최대 3개)
        sorted_lesions = sorted(r.lesions, key=lambda x: x.mark_order)
        for i in range(3):
            if i < len(sorted_lesions):
                l = sorted_lesions[i]
                row.extend([l.x, l.y, l.z, l.confidence])
            else:
                row.extend(["", "", "", ""])

        writer.writerow(row)

    csv_content = output.getvalue()
    output.close()

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=reader_study_results.csv"
        }
    )


@router.get("/sessions")
async def list_sessions() -> dict:
    """
    사용 가능한 세션 목록 조회

    Returns:
        세션 ID 목록
    """
    sessions = session_service.list_sessions()
    return {"sessions": sessions}


@router.get("/cache-stats")
async def get_cache_statistics() -> dict:
    """
    캐시 통계 조회

    Returns:
        각 캐시의 현재 크기 및 최대 크기
    """
    return get_cache_stats()


@router.post("/cache-clear")
async def clear_caches() -> dict:
    """
    모든 캐시 초기화

    Returns:
        성공 메시지
    """
    clear_all_caches()
    return {"message": "All caches cleared"}
