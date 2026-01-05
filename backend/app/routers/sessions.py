"""
============================================================================
Sessions Router - Reader Study MVP (Phase 3)
============================================================================
역할: DB 기반 세션 관리 API (인증 필수)

엔드포인트:
  - GET  /sessions/my          내 세션 목록 조회 (대시보드용)
  - POST /sessions/{id}/enter  세션 진입 (최초/재진입)
  - GET  /sessions/{id}/current 현재 케이스 정보 조회
  - POST /sessions/{id}/advance 다음 케이스로 이동

관리자 전용:
  - POST /sessions/assign      리더에게 세션 할당
  - POST /sessions/{id}/reset  세션 초기화

인증:
  모든 엔드포인트는 JWT 토큰 인증이 필요합니다.
  Authorization: Bearer <token>

사용 예시:
  GET /sessions/my
  Headers: Authorization: Bearer eyJ...

  Response:
  [
    {
      "session_id": 1,
      "session_code": "S1",
      "status": "in_progress",
      "block_a_mode": "UNAIDED",
      "block_b_mode": "AIDED",
      "progress_percent": 45.5,
      "current_block": "A",
      "total_cases": 120
    }
  ]
============================================================================
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.models.database import Reader, AuditLog
from app.core.dependencies import get_db, get_current_active_reader, require_admin
from app.services.study_session_service import StudySessionService


# =============================================================================
# 라우터 설정
# =============================================================================

router = APIRouter(prefix="/sessions", tags=["Sessions"])


# =============================================================================
# Pydantic 스키마
# =============================================================================

class SessionSummaryResponse(BaseModel):
    """세션 요약 응답"""
    session_id: int
    session_code: str
    status: str
    block_a_mode: str
    block_b_mode: str
    progress_percent: float
    current_block: Optional[str]
    current_case_index: Optional[int]
    total_cases: int
    last_accessed_at: Optional[datetime]


class SessionEnterRequest(BaseModel):
    """세션 진입 요청"""
    block_a_cases: List[str] = Field(..., description="Block A 케이스 ID 목록")
    block_b_cases: List[str] = Field(..., description="Block B 케이스 ID 목록")


class SessionEnterResponse(BaseModel):
    """세션 진입 응답"""
    session_id: int
    session_code: str
    current_block: str
    current_mode: str
    current_case_id: Optional[str]
    current_case_index: int
    total_cases_in_block: int
    k_max: int
    ai_threshold: float
    is_new_session: bool


class CurrentCaseResponse(BaseModel):
    """현재 케이스 정보 응답"""
    session_code: str
    block: Optional[str]
    mode: Optional[str]
    case_id: Optional[str]
    case_index: Optional[int]
    total_cases_in_block: int
    is_last_in_block: bool
    is_session_complete: bool


class AdvanceCaseRequest(BaseModel):
    """케이스 진행 요청"""
    completed_case_id: str = Field(..., description="완료된 케이스 ID")


class SessionAssignRequest(BaseModel):
    """세션 할당 요청 (관리자용)"""
    reader_id: int
    session_code: str = Field(..., pattern="^S[12]$", description="S1 또는 S2")
    k_max: int = Field(default=3, ge=1, le=10)
    ai_threshold: float = Field(default=0.30, ge=0.0, le=1.0)


class SessionAssignResponse(BaseModel):
    """세션 할당 응답"""
    session_id: int
    session_code: str
    reader_id: int
    block_a_mode: str
    block_b_mode: str
    status: str


class MessageResponse(BaseModel):
    """단순 메시지 응답"""
    message: str


# =============================================================================
# 유틸리티 함수
# =============================================================================

def get_client_ip(request: Request) -> str:
    """클라이언트 IP 추출"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def log_audit(
    db: AsyncSession,
    action: str,
    reader_id: int,
    request: Request,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[str] = None
) -> None:
    """감사 로그 기록"""
    audit_log = AuditLog(
        reader_id=reader_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent", "")[:500],
        details=details
    )
    db.add(audit_log)
    await db.commit()


# =============================================================================
# 리더 엔드포인트
# =============================================================================

@router.get("/my", response_model=List[SessionSummaryResponse])
async def get_my_sessions(
    reader: Reader = Depends(get_current_active_reader),
    db: AsyncSession = Depends(get_db)
):
    """
    내 세션 목록 조회

    현재 로그인한 리더에게 할당된 모든 세션의 요약 정보를 반환합니다.
    """
    service = StudySessionService(db)
    sessions = await service.get_reader_sessions(reader.id)
    return [SessionSummaryResponse(**s) for s in sessions]


@router.post("/{session_id}/enter", response_model=SessionEnterResponse)
async def enter_session(
    session_id: int,
    enter_request: SessionEnterRequest,
    request: Request,
    reader: Reader = Depends(get_current_active_reader),
    db: AsyncSession = Depends(get_db)
):
    """
    세션 진입

    최초 진입 시 케이스 순서를 랜덤 생성합니다.
    재진입 시 이전 진행 상태를 복원합니다.
    """
    service = StudySessionService(db)

    try:
        result = await service.enter_session(
            session_id=session_id,
            reader_id=reader.id,
            block_a_cases=enter_request.block_a_cases,
            block_b_cases=enter_request.block_b_cases
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    # 감사 로그
    action = "SESSION_START" if result["is_new_session"] else "SESSION_RESUME"
    await log_audit(
        db=db,
        action=action,
        reader_id=reader.id,
        request=request,
        resource_type="session",
        resource_id=str(session_id)
    )

    return SessionEnterResponse(**result)


@router.get("/{session_id}/current", response_model=CurrentCaseResponse)
async def get_current_case(
    session_id: int,
    reader: Reader = Depends(get_current_active_reader),
    db: AsyncSession = Depends(get_db)
):
    """
    현재 케이스 정보 조회

    세션의 현재 진행 상태와 케이스 정보를 반환합니다.
    """
    service = StudySessionService(db)

    try:
        result = await service.get_current_case(session_id, reader.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    return CurrentCaseResponse(**result)


@router.post("/{session_id}/advance", response_model=CurrentCaseResponse)
async def advance_to_next_case(
    session_id: int,
    advance_request: AdvanceCaseRequest,
    request: Request,
    reader: Reader = Depends(get_current_active_reader),
    db: AsyncSession = Depends(get_db)
):
    """
    다음 케이스로 이동

    현재 케이스를 완료 처리하고 다음 케이스 정보를 반환합니다.
    Block A 완료 시 Block B로 자동 전환됩니다.
    """
    service = StudySessionService(db)

    try:
        result = await service.advance_to_next_case(
            session_id=session_id,
            reader_id=reader.id,
            completed_case_id=advance_request.completed_case_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    # 감사 로그
    if result["is_session_complete"]:
        await log_audit(
            db=db,
            action="SESSION_COMPLETE",
            reader_id=reader.id,
            request=request,
            resource_type="session",
            resource_id=str(session_id)
        )
    else:
        await log_audit(
            db=db,
            action="CASE_COMPLETE",
            reader_id=reader.id,
            request=request,
            resource_type="case",
            resource_id=advance_request.completed_case_id
        )

    return CurrentCaseResponse(**result)


# =============================================================================
# 관리자 엔드포인트
# =============================================================================

@router.post("/assign", response_model=SessionAssignResponse)
async def assign_session(
    assign_request: SessionAssignRequest,
    request: Request,
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    리더에게 세션 할당 (관리자 전용)

    리더의 그룹에 따라 Block/Mode 매핑이 자동으로 결정됩니다.
    """
    service = StudySessionService(db)

    try:
        session = await service.create_session_for_reader(
            reader_id=assign_request.reader_id,
            session_code=assign_request.session_code,
            k_max=assign_request.k_max,
            ai_threshold=assign_request.ai_threshold
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 감사 로그
    await log_audit(
        db=db,
        action="ADMIN_SESSION_ASSIGN",
        reader_id=admin.id,
        request=request,
        resource_type="session",
        resource_id=str(session.id),
        details=f'{{"target_reader_id": {assign_request.reader_id}, "session_code": "{assign_request.session_code}"}}'
    )

    return SessionAssignResponse(
        session_id=session.id,
        session_code=session.session_code,
        reader_id=session.reader_id,
        block_a_mode=session.block_a_mode,
        block_b_mode=session.block_b_mode,
        status=session.status
    )


@router.post("/{session_id}/reset", response_model=MessageResponse)
async def reset_session(
    session_id: int,
    request: Request,
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    세션 초기화 (관리자 전용)

    세션의 진행 상태를 초기화하고 다시 시작할 수 있도록 합니다.
    케이스 순서는 재진입 시 새로 생성됩니다.
    """
    service = StudySessionService(db)

    try:
        await service.reset_session(session_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 감사 로그
    await log_audit(
        db=db,
        action="ADMIN_SESSION_RESET",
        reader_id=admin.id,
        request=request,
        resource_type="session",
        resource_id=str(session_id)
    )

    return MessageResponse(message=f"세션 {session_id}이 초기화되었습니다")
