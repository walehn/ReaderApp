"""
============================================================================
Readers Router - Reader Study MVP (Phase 5)
============================================================================
역할: 리더(판독자) 계정 관리 API (관리자 전용)

엔드포인트:
  - GET    /readers           리더 목록 조회
  - GET    /readers/{id}      리더 상세 조회
  - POST   /readers           리더 생성
  - PATCH  /readers/{id}      리더 정보 수정
  - DELETE /readers/{id}      리더 비활성화

인증:
  모든 엔드포인트는 관리자 권한 필요 (require_admin)

사용 예시:
  POST /readers
  Headers: Authorization: Bearer <admin_token>
  Body: {
    "reader_code": "R01",
    "name": "Dr. Kim",
    "email": "kim@hospital.com",
    "password": "secure123",
    "group": 1
  }
============================================================================
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.models.database import Reader, StudySession, AuditLog
from app.core.dependencies import get_db, require_admin
from app.core.security import hash_password


# =============================================================================
# 라우터 설정
# =============================================================================

router = APIRouter(prefix="/readers", tags=["Readers (Admin)"])


# =============================================================================
# Pydantic 스키마
# =============================================================================

class ReaderCreateRequest(BaseModel):
    """리더 생성 요청"""
    reader_code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=1)
    group: Optional[int] = Field(None, ge=1, le=2, description="Crossover 그룹 (1 또는 2)")
    role: str = Field("reader", pattern="^(reader|admin)$", description="역할 (reader 또는 admin)")


class ReaderUpdateRequest(BaseModel):
    """리더 수정 요청"""
    name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=1)
    group: Optional[int] = Field(None, ge=1, le=2)
    is_active: Optional[bool] = None


class ReaderResponse(BaseModel):
    """리더 정보 응답"""
    id: int
    reader_code: str
    name: str
    email: str
    role: str
    group: Optional[int]
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime]
    session_count: int = 0

    class Config:
        from_attributes = True


class ReaderDetailResponse(ReaderResponse):
    """리더 상세 응답 (세션 포함)"""
    sessions: List[dict] = []


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
    admin_id: int,
    request: Request,
    resource_type: str,
    resource_id: str,
    details: Optional[str] = None
) -> None:
    """감사 로그 기록"""
    audit_log = AuditLog(
        reader_id=admin_id,
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
# 엔드포인트
# =============================================================================

@router.get("", response_model=List[ReaderResponse])
async def list_readers(
    include_inactive: bool = False,
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    리더 목록 조회

    모든 계정(리더 + 관리자)을 반환합니다.
    """
    query = select(Reader)

    if not include_inactive:
        query = query.where(Reader.is_active == True)

    query = query.order_by(Reader.reader_code)

    result = await db.execute(query)
    readers = result.scalars().all()

    # 세션 수 계산
    responses = []
    for reader in readers:
        session_count_result = await db.execute(
            select(StudySession).where(StudySession.reader_id == reader.id)
        )
        session_count = len(session_count_result.scalars().all())

        response = ReaderResponse(
            id=reader.id,
            reader_code=reader.reader_code,
            name=reader.name,
            email=reader.email,
            role=reader.role,
            group=reader.group,
            is_active=reader.is_active,
            created_at=reader.created_at,
            last_login_at=reader.last_login_at,
            session_count=session_count
        )
        responses.append(response)

    return responses


@router.get("/{reader_id}", response_model=ReaderDetailResponse)
async def get_reader(
    reader_id: int,
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    리더 상세 조회

    리더 정보와 할당된 세션 목록을 반환합니다.
    """
    result = await db.execute(
        select(Reader)
        .options(selectinload(Reader.sessions))
        .where(Reader.id == reader_id)
    )
    reader = result.scalar_one_or_none()

    if reader is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="리더를 찾을 수 없습니다"
        )

    # 세션 정보 변환
    sessions = []
    for session in reader.sessions:
        sessions.append({
            "session_id": session.id,
            "session_code": session.session_code,
            "status": session.status,
            "block_a_mode": session.block_a_mode,
            "block_b_mode": session.block_b_mode,
            "created_at": session.created_at.isoformat() if session.created_at else None
        })

    return ReaderDetailResponse(
        id=reader.id,
        reader_code=reader.reader_code,
        name=reader.name,
        email=reader.email,
        role=reader.role,
        group=reader.group,
        is_active=reader.is_active,
        created_at=reader.created_at,
        last_login_at=reader.last_login_at,
        session_count=len(sessions),
        sessions=sessions
    )


@router.post("", response_model=ReaderResponse, status_code=status.HTTP_201_CREATED)
async def create_reader(
    reader_data: ReaderCreateRequest,
    request: Request,
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    리더 생성

    새로운 리더 계정을 생성합니다.
    """
    # 중복 확인 - 이메일
    existing_email = await db.execute(
        select(Reader).where(Reader.email == reader_data.email)
    )
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"이메일 '{reader_data.email}'이 이미 사용 중입니다"
        )

    # 중복 확인 - 코드
    existing_code = await db.execute(
        select(Reader).where(Reader.reader_code == reader_data.reader_code)
    )
    if existing_code.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"코드 '{reader_data.reader_code}'가 이미 사용 중입니다"
        )

    # 리더/관리자 생성
    reader = Reader(
        reader_code=reader_data.reader_code,
        name=reader_data.name,
        email=reader_data.email,
        password_hash=hash_password(reader_data.password),
        role=reader_data.role,
        group=reader_data.group if reader_data.role == "reader" else None,
        is_active=True
    )
    db.add(reader)
    await db.commit()
    await db.refresh(reader)

    # 감사 로그
    await log_audit(
        db=db,
        action="ADMIN_READER_CREATE",
        admin_id=admin.id,
        request=request,
        resource_type="reader",
        resource_id=str(reader.id),
        details=f'{{"reader_code": "{reader.reader_code}", "group": {reader.group}}}'
    )

    return ReaderResponse(
        id=reader.id,
        reader_code=reader.reader_code,
        name=reader.name,
        email=reader.email,
        role=reader.role,
        group=reader.group,
        is_active=reader.is_active,
        created_at=reader.created_at,
        last_login_at=reader.last_login_at,
        session_count=0
    )


@router.patch("/{reader_id}", response_model=ReaderResponse)
async def update_reader(
    reader_id: int,
    update_data: ReaderUpdateRequest,
    request: Request,
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    리더 정보 수정

    이름, 이메일, 비밀번호, 그룹, 활성 상태를 수정할 수 있습니다.
    """
    result = await db.execute(
        select(Reader).where(Reader.id == reader_id)
    )
    reader = result.scalar_one_or_none()

    if reader is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="리더를 찾을 수 없습니다"
        )

    # 관리자 계정은 비밀번호와 활성 상태만 변경 가능
    if reader.role == "admin":
        has_forbidden_fields = any([
            update_data.name is not None,
            update_data.email is not None,
            update_data.group is not None
        ])
        if has_forbidden_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="관리자 계정은 비밀번호와 활성 상태만 변경할 수 있습니다"
            )

    # 변경 내역 추적
    changes = []

    if update_data.name is not None:
        changes.append(f"name: {reader.name} -> {update_data.name}")
        reader.name = update_data.name

    if update_data.email is not None:
        # 중복 확인
        existing = await db.execute(
            select(Reader).where(
                Reader.email == update_data.email,
                Reader.id != reader_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이메일이 이미 사용 중입니다"
            )
        changes.append(f"email: {reader.email} -> {update_data.email}")
        reader.email = update_data.email

    if update_data.password is not None:
        reader.password_hash = hash_password(update_data.password)
        changes.append("password: changed")

    if update_data.group is not None:
        changes.append(f"group: {reader.group} -> {update_data.group}")
        reader.group = update_data.group

    if update_data.is_active is not None:
        changes.append(f"is_active: {reader.is_active} -> {update_data.is_active}")
        reader.is_active = update_data.is_active

    await db.commit()
    await db.refresh(reader)

    # 감사 로그
    await log_audit(
        db=db,
        action="ADMIN_READER_UPDATE",
        admin_id=admin.id,
        request=request,
        resource_type="reader",
        resource_id=str(reader.id),
        details=f'{{"changes": {changes}}}'
    )

    # 세션 수 계산
    session_count_result = await db.execute(
        select(StudySession).where(StudySession.reader_id == reader.id)
    )
    session_count = len(session_count_result.scalars().all())

    return ReaderResponse(
        id=reader.id,
        reader_code=reader.reader_code,
        name=reader.name,
        email=reader.email,
        role=reader.role,
        group=reader.group,
        is_active=reader.is_active,
        created_at=reader.created_at,
        last_login_at=reader.last_login_at,
        session_count=session_count
    )


@router.delete("/{reader_id}", response_model=MessageResponse)
async def deactivate_reader(
    reader_id: int,
    request: Request,
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    리더 비활성화

    리더 계정을 삭제하지 않고 비활성화합니다.
    데이터 무결성을 위해 실제 삭제는 수행하지 않습니다.
    """
    result = await db.execute(
        select(Reader).where(Reader.id == reader_id)
    )
    reader = result.scalar_one_or_none()

    if reader is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="리더를 찾을 수 없습니다"
        )

    if reader.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="관리자 계정은 비활성화할 수 없습니다"
        )

    reader.is_active = False
    await db.commit()

    # 감사 로그
    await log_audit(
        db=db,
        action="ADMIN_READER_DEACTIVATE",
        admin_id=admin.id,
        request=request,
        resource_type="reader",
        resource_id=str(reader.id)
    )

    return MessageResponse(message=f"리더 '{reader.reader_code}'가 비활성화되었습니다")
