"""
============================================================================
Security Module - Reader Study MVP
============================================================================
역할: 비밀번호 해싱 및 JWT 토큰 처리

기능:
  - hash_password(password): 비밀번호를 bcrypt로 해싱
  - verify_password(plain, hashed): 비밀번호 검증
  - create_access_token(reader_id, role): JWT 액세스 토큰 생성
  - decode_token(token): JWT 토큰 디코딩 및 검증

설정:
  - SECRET_KEY: JWT 서명 키 (환경변수 READER_STUDY_SECRET_KEY)
  - ALGORITHM: HS256
  - ACCESS_TOKEN_EXPIRE_HOURS: 8시간

사용 예시:
  from app.core.security import hash_password, verify_password, create_access_token

  hashed = hash_password("mypassword")
  is_valid = verify_password("mypassword", hashed)
  token = create_access_token(reader_id=1, role="reader")
============================================================================
"""

import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets

from app.config import settings


# =============================================================================
# Timezone-aware UTC datetime 유틸리티
# =============================================================================

def utc_now() -> datetime:
    """
    Timezone-aware UTC 현재 시간 반환

    datetime.utcnow() 대신 사용하면 JSON 직렬화 시 "+00:00" 또는 "Z" 형태로
    시간대 정보가 포함되어, 클라이언트에서 올바르게 변환할 수 있습니다.

    Returns:
        datetime: UTC timezone 정보를 포함한 현재 시간

    Example:
        >>> utc_now()
        datetime.datetime(2026, 1, 5, 8, 44, 29, tzinfo=datetime.timezone.utc)
        >>> utc_now().isoformat()
        '2026-01-05T08:44:29+00:00'
    """
    return datetime.now(timezone.utc)

# =============================================================================
# 비밀번호 해싱 설정 (bcrypt 직접 사용)
# =============================================================================


def hash_password(password: str) -> str:
    """
    비밀번호를 bcrypt로 해싱

    Args:
        password: 평문 비밀번호

    Returns:
        해싱된 비밀번호 문자열
    """
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    비밀번호 검증

    Args:
        plain_password: 평문 비밀번호
        hashed_password: 저장된 해시값

    Returns:
        일치 여부
    """
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# =============================================================================
# JWT 토큰 설정
# =============================================================================

# 기본 시크릿 키 (프로덕션에서는 반드시 환경변수로 설정)
DEFAULT_SECRET_KEY = secrets.token_urlsafe(32)
SECRET_KEY = getattr(settings, 'SECRET_KEY', None) or DEFAULT_SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8


def create_access_token(
    reader_id: int,
    role: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    JWT 액세스 토큰 생성

    Args:
        reader_id: 리더 ID (DB PK)
        role: 역할 ("reader" | "admin")
        expires_delta: 만료 시간 (기본 8시간)

    Returns:
        JWT 토큰 문자열
    """
    if expires_delta is None:
        expires_delta = timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    expire = utc_now() + expires_delta
    to_encode = {
        "sub": str(reader_id),
        "role": role,
        "exp": expire,
        "iat": utc_now()
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """
    JWT 토큰 디코딩 및 검증

    Args:
        token: JWT 토큰 문자열

    Returns:
        페이로드 딕셔너리 또는 None (검증 실패 시)
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def get_token_reader_id(token: str) -> Optional[int]:
    """
    토큰에서 리더 ID 추출

    Args:
        token: JWT 토큰 문자열

    Returns:
        리더 ID 또는 None
    """
    payload = decode_token(token)
    if payload is None:
        return None

    try:
        return int(payload.get("sub"))
    except (TypeError, ValueError):
        return None


def get_token_role(token: str) -> Optional[str]:
    """
    토큰에서 역할 추출

    Args:
        token: JWT 토큰 문자열

    Returns:
        역할 문자열 또는 None
    """
    payload = decode_token(token)
    if payload is None:
        return None

    return payload.get("role")
