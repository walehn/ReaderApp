"""
============================================================================
Authentication Router - Reader Study MVP
============================================================================
역할: 로그인, 로그아웃, 현재 사용자 정보 조회 API

엔드포인트:
  - POST /auth/login     이메일/비밀번호로 로그인, JWT 토큰 반환
  - POST /auth/logout    로그아웃 (감사 로그 기록)
  - GET  /auth/me        현재 로그인한 사용자 정보 조회

요청/응답 예시:
  POST /auth/login
  Request:
    {"email": "reader@hospital.com", "password": "mypassword"}
  Response:
    {
      "access_token": "eyJ...",
      "token_type": "bearer",
      "reader": {
        "id": 1,
        "reader_code": "R01",
        "name": "Dr. Kim",
        "email": "reader@hospital.com",
        "role": "reader",
        "group": 1
      }
    }

  GET /auth/me
  Headers: Authorization: Bearer <token>
  Response:
    {
      "id": 1,
      "reader_code": "R01",
      "name": "Dr. Kim",
      "email": "reader@hospital.com",
      "role": "reader",
      "group": 1
    }

보안:
  - 비밀번호는 bcrypt로 해싱되어 저장
  - JWT 토큰 만료: 8시간
  - 로그인 시도마다 감사 로그 기록
============================================================================
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Reader, AuditLog
from app.core.dependencies import get_db, get_current_active_reader
from app.core.security import verify_password, create_access_token


# =============================================================================
# 라우터 설정
# =============================================================================

router = APIRouter(prefix="/auth", tags=["Authentication"])


# =============================================================================
# Pydantic 스키마
# =============================================================================

class LoginRequest(BaseModel):
    """로그인 요청"""
    email: EmailStr
    password: str


class ReaderResponse(BaseModel):
    """리더 정보 응답 (비밀번호 제외)"""
    id: int
    reader_code: str
    name: str
    email: str
    role: str
    group: Optional[int]
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """로그인 응답"""
    access_token: str
    token_type: str = "bearer"
    reader: ReaderResponse


class MessageResponse(BaseModel):
    """단순 메시지 응답"""
    message: str


# =============================================================================
# 유틸리티 함수
# =============================================================================

def get_client_ip(request: Request) -> str:
    """
    클라이언트 IP 주소 추출

    X-Forwarded-For 헤더가 있으면 첫 번째 IP 사용 (프록시 환경)
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def log_audit(
    db: AsyncSession,
    action: str,
    reader_id: Optional[int],
    request: Request,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[str] = None
) -> None:
    """
    감사 로그 기록

    Args:
        db: DB 세션
        action: 작업 유형 (LOGIN, LOGOUT, LOGIN_FAILED 등)
        reader_id: 리더 ID (로그인 전은 None)
        request: FastAPI Request 객체
        resource_type: 리소스 유형 (선택)
        resource_id: 리소스 ID (선택)
        details: 추가 정보 JSON (선택)
    """
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
# 엔드포인트
# =============================================================================

@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    로그인

    이메일과 비밀번호로 인증하고 JWT 토큰을 반환합니다.
    """
    # 이메일로 리더 조회
    result = await db.execute(
        select(Reader).where(Reader.email == login_data.email)
    )
    reader = result.scalar_one_or_none()

    # 인증 실패 - 이메일 없음
    if reader is None:
        await log_audit(
            db=db,
            action="LOGIN_FAILED",
            reader_id=None,
            request=request,
            details=f'{{"reason": "email_not_found", "email": "{login_data.email}"}}'
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다",
        )

    # 인증 실패 - 비밀번호 불일치
    if not verify_password(login_data.password, reader.password_hash):
        await log_audit(
            db=db,
            action="LOGIN_FAILED",
            reader_id=reader.id,
            request=request,
            details='{"reason": "wrong_password"}'
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다",
        )

    # 비활성화된 계정
    if not reader.is_active:
        await log_audit(
            db=db,
            action="LOGIN_FAILED",
            reader_id=reader.id,
            request=request,
            details='{"reason": "inactive_account"}'
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다. 관리자에게 문의하세요.",
        )

    # 로그인 성공 - 토큰 생성
    access_token = create_access_token(
        reader_id=reader.id,
        role=reader.role
    )

    # 마지막 로그인 시간 업데이트
    reader.last_login_at = datetime.utcnow()
    await db.commit()
    await db.refresh(reader)

    # 감사 로그 기록
    await log_audit(
        db=db,
        action="LOGIN",
        reader_id=reader.id,
        request=request
    )

    return LoginResponse(
        access_token=access_token,
        reader=ReaderResponse.model_validate(reader)
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    reader: Reader = Depends(get_current_active_reader),
    db: AsyncSession = Depends(get_db)
):
    """
    로그아웃

    JWT는 서버 측에서 무효화할 수 없으므로,
    클라이언트에서 토큰을 삭제해야 합니다.
    이 엔드포인트는 감사 로그 기록용입니다.
    """
    await log_audit(
        db=db,
        action="LOGOUT",
        reader_id=reader.id,
        request=request
    )

    return MessageResponse(message="로그아웃되었습니다")


@router.get("/me", response_model=ReaderResponse)
async def get_current_user(
    reader: Reader = Depends(get_current_active_reader)
):
    """
    현재 사용자 정보 조회

    Authorization 헤더의 JWT 토큰으로 인증된 사용자 정보를 반환합니다.
    """
    return ReaderResponse.model_validate(reader)
