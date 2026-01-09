"""
============================================================================
FastAPI Dependencies - Reader Study MVP
============================================================================
역할: 인증 및 권한 검증을 위한 FastAPI 의존성

의존성:
  - get_current_reader: JWT 토큰에서 현재 로그인한 리더 추출
  - get_current_active_reader: 활성 상태인 리더만 허용
  - require_admin: 관리자 역할 필수
  - get_optional_reader: 선택적 인증 (없어도 통과)

사용 예시:
  from app.core.dependencies import get_current_reader, require_admin

  @router.get("/my-sessions")
  async def my_sessions(reader: Reader = Depends(get_current_reader)):
      return reader.sessions

  @router.post("/admin/create-reader")
  async def create_reader(admin: Reader = Depends(require_admin)):
      ...
============================================================================
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import make_transient

from app.models.database import async_session, Reader
from app.core.security import decode_token


# =============================================================================
# 보안 스키마
# =============================================================================

# Bearer 토큰 추출기 (auto_error=False로 선택적 인증 지원)
security = HTTPBearer(auto_error=False)


# =============================================================================
# 데이터베이스 세션 의존성
# =============================================================================

async def get_db() -> AsyncSession:
    """
    비동기 DB 세션 제공

    FastAPI의 의존성 주입 시스템과 함께 사용
    """
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


# =============================================================================
# 인증 의존성
# =============================================================================

async def get_current_reader(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Reader:
    """
    현재 로그인한 리더 추출

    Authorization: Bearer <token> 헤더에서 JWT 토큰을 추출하고,
    토큰의 유효성을 검증한 후 해당 리더를 반환합니다.

    Raises:
        HTTPException 401: 토큰이 없거나 유효하지 않음
        HTTPException 401: 리더를 찾을 수 없음
    """
    # 토큰 존재 확인
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증이 필요합니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # 토큰 디코딩
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 리더 ID 추출
    reader_id_str = payload.get("sub")
    if reader_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰에 사용자 정보가 없습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        reader_id = int(reader_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="잘못된 토큰 형식입니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # DB에서 리더 조회
    result = await db.execute(select(Reader).where(Reader.id == reader_id))
    reader = result.scalar_one_or_none()

    if reader is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자를 찾을 수 없습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # MissingGreenlet 에러 방지: 필요한 스칼라 속성들을 세션 컨텍스트 내에서 즉시 로드
    # 다른 DB 세션에서 접근할 때 lazy loading을 방지하여 캐싱된 값 사용
    _ = reader.id
    _ = reader.reader_code
    _ = reader.name
    _ = reader.email
    _ = reader.role
    _ = reader.group
    _ = reader.is_active
    _ = reader.created_at
    _ = reader.last_login_at

    # 핵심: 세션에서 완전히 분리하여 다른 세션 컨텍스트에서 안전하게 사용
    # make_transient()는 객체를 detached → transient 상태로 전환하여 세션 참조 제거
    make_transient(reader)

    return reader


async def get_current_active_reader(
    reader: Reader = Depends(get_current_reader)
) -> Reader:
    """
    활성 상태인 리더만 허용

    비활성화된 계정은 접근 거부됩니다.

    Raises:
        HTTPException 403: 비활성화된 계정
    """
    if not reader.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다. 관리자에게 문의하세요.",
        )
    return reader


async def require_admin(
    reader: Reader = Depends(get_current_active_reader)
) -> Reader:
    """
    관리자 역할 필수

    관리자만 접근 가능한 엔드포인트에서 사용합니다.

    Raises:
        HTTPException 403: 관리자 권한 없음
    """
    if reader.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다",
        )
    return reader


async def get_optional_reader(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[Reader]:
    """
    선택적 인증

    인증이 없어도 통과하지만, 토큰이 있으면 리더 정보를 반환합니다.
    공개 API이지만 로그인 사용자에게 추가 기능을 제공할 때 사용합니다.

    Returns:
        Reader 또는 None
    """
    if credentials is None:
        return None

    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        return None

    reader_id_str = payload.get("sub")
    if reader_id_str is None:
        return None

    try:
        reader_id = int(reader_id_str)
    except ValueError:
        return None

    result = await db.execute(select(Reader).where(Reader.id == reader_id))
    return result.scalar_one_or_none()
