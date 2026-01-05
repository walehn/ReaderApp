"""
============================================================================
Admin Router - Reader Study MVP (Phase 5)
============================================================================
역할: 관리자용 데이터 내보내기, 감사 로그, 시스템 관리 API

엔드포인트:
  데이터 내보내기:
  - GET /admin/export           결과 데이터 내보내기 (CSV/JSON)

  감사 로그:
  - GET /admin/audit-logs       감사 로그 조회

  시스템 관리:
  - GET /admin/sessions         사용 가능한 세션 목록 (레거시)
  - GET /admin/cache-stats      캐시 통계
  - POST /admin/cache-clear     캐시 초기화

  결과 관리:
  - DELETE /admin/results/{id}  결과 삭제

인증:
  모든 엔드포인트는 관리자 권한 필요 (Phase 5에서 추가)

필터 옵션:
  - session_id: 특정 세션만
  - reader_id: 특정 Reader만
============================================================================
"""

from fastapi import APIRouter, HTTPException, Query, Depends, Request
from fastapi.responses import Response, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import Literal, Optional, List
from pydantic import BaseModel
from datetime import datetime
import csv
import json
from io import StringIO

from app.models.database import get_db, StudyResult, LesionMark, AuditLog, Reader
from app.services.session_service import session_service
from app.services.cache_service import get_cache_stats, clear_all_caches
from app.core.dependencies import require_admin

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
async def clear_caches(
    admin: Reader = Depends(require_admin)
) -> dict:
    """
    모든 캐시 초기화 (관리자 전용)

    Returns:
        성공 메시지
    """
    clear_all_caches()
    return {"message": "All caches cleared"}


# =============================================================================
# Pydantic 스키마 (Phase 5)
# =============================================================================

class AuditLogResponse(BaseModel):
    """감사 로그 응답"""
    id: int
    reader_code: Optional[str]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    ip_address: Optional[str]
    details: Optional[str]
    created_at: datetime


class MessageResponse(BaseModel):
    """단순 메시지 응답"""
    message: str


# =============================================================================
# 감사 로그 API (Phase 5)
# =============================================================================

@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    action: Optional[str] = Query(None, description="작업 유형 필터 (LOGIN, LOGOUT, ADMIN_* 등)"),
    reader_id: Optional[int] = Query(None, description="리더 ID 필터"),
    limit: int = Query(100, ge=1, le=1000, description="최대 결과 수"),
    offset: int = Query(0, ge=0, description="오프셋"),
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    감사 로그 조회 (관리자 전용)

    모든 시스템 활동 로그를 조회합니다.
    """
    query = select(AuditLog).options(selectinload(AuditLog.reader))

    if action:
        query = query.where(AuditLog.action.contains(action))

    if reader_id:
        query = query.where(AuditLog.reader_id == reader_id)

    query = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    responses = []
    for log in logs:
        responses.append(AuditLogResponse(
            id=log.id,
            reader_code=log.reader.reader_code if log.reader else None,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            ip_address=log.ip_address,
            details=log.details,
            created_at=log.created_at
        ))

    return responses


# =============================================================================
# 결과 관리 API (Phase 5)
# =============================================================================

def get_client_ip(request: Request) -> str:
    """클라이언트 IP 추출"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.delete("/results/{result_id}", response_model=MessageResponse)
async def delete_result(
    result_id: int,
    request: Request,
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    결과 삭제 (관리자 전용)

    특정 결과와 관련 병변 마커를 삭제합니다.
    """
    result = await db.execute(
        select(StudyResult)
        .options(selectinload(StudyResult.lesions))
        .where(StudyResult.id == result_id)
    )
    study_result = result.scalar_one_or_none()

    if study_result is None:
        raise HTTPException(
            status_code=404,
            detail="결과를 찾을 수 없습니다"
        )

    # 결과 정보 저장 (로그용)
    result_info = {
        "reader_id": study_result.reader_id,
        "session_id": study_result.session_id,
        "case_id": study_result.case_id
    }

    # 삭제
    await db.delete(study_result)
    await db.commit()

    # 감사 로그
    audit_log = AuditLog(
        reader_id=admin.id,
        action="ADMIN_RESULT_DELETE",
        resource_type="result",
        resource_id=str(result_id),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
        details=json.dumps(result_info)
    )
    db.add(audit_log)
    await db.commit()

    return MessageResponse(message=f"결과 {result_id}이 삭제되었습니다")
