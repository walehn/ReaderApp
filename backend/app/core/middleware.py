"""
============================================================================
Middleware - Reader Study MVP
============================================================================
역할: IP 제한, 요청 로깅, 보안 헤더 등 미들웨어

미들웨어:
  - IPRestrictionMiddleware: 허용된 IP 대역만 접근 허용
  - RequestLoggingMiddleware: 모든 요청 로깅 (디버그용)
  - SecurityHeadersMiddleware: 보안 관련 HTTP 헤더 추가

설정:
  ALLOWED_IP_RANGES: 허용 IP 대역 리스트 (CIDR 표기)
    예: ["192.168.0.0/16", "10.0.0.0/8"]
    빈 리스트면 모든 IP 허용

사용법:
  from app.core.middleware import IPRestrictionMiddleware

  app.add_middleware(IPRestrictionMiddleware)

주의:
  - 미들웨어는 역순으로 실행됨 (마지막 추가된 것이 먼저 실행)
  - IP 제한은 프록시 환경에서 X-Forwarded-For 헤더 고려
============================================================================
"""

import ipaddress
import time
import logging
from typing import List, Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from app.config import settings


# =============================================================================
# 로거 설정
# =============================================================================

logger = logging.getLogger("reader_study")


# =============================================================================
# IP 유틸리티
# =============================================================================

def get_client_ip(request: Request) -> str:
    """
    클라이언트 IP 주소 추출

    X-Forwarded-For 헤더가 있으면 첫 번째 IP 사용 (프록시 환경)
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


def is_ip_allowed(client_ip: str, allowed_ranges: List[str]) -> bool:
    """
    IP가 허용된 범위에 있는지 확인

    Args:
        client_ip: 클라이언트 IP 주소
        allowed_ranges: 허용 IP 범위 리스트 (CIDR 표기)

    Returns:
        허용 여부
    """
    # 빈 리스트면 모든 IP 허용
    if not allowed_ranges:
        return True

    try:
        ip = ipaddress.ip_address(client_ip)

        for range_str in allowed_ranges:
            try:
                network = ipaddress.ip_network(range_str, strict=False)
                if ip in network:
                    return True
            except ValueError:
                # 잘못된 네트워크 형식 무시
                logger.warning(f"Invalid IP range format: {range_str}")
                continue

        return False

    except ValueError:
        # 잘못된 IP 주소
        logger.warning(f"Invalid client IP: {client_ip}")
        return False


# =============================================================================
# IP 제한 미들웨어
# =============================================================================

class IPRestrictionMiddleware(BaseHTTPMiddleware):
    """
    IP 제한 미들웨어

    ALLOWED_IP_RANGES 설정에 따라 접근을 제한합니다.
    빈 리스트면 모든 IP 허용 (개발 환경용).
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # 허용 IP 대역 가져오기
        allowed_ranges = getattr(settings, 'ALLOWED_IP_RANGES', [])

        # 빈 리스트면 바로 통과
        if not allowed_ranges:
            return await call_next(request)

        # 클라이언트 IP 추출
        client_ip = get_client_ip(request)

        # IP 검증
        if not is_ip_allowed(client_ip, allowed_ranges):
            logger.warning(f"Access denied for IP: {client_ip}")
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "접근이 허용되지 않는 IP입니다",
                    "ip": client_ip
                }
            )

        return await call_next(request)


# =============================================================================
# 요청 로깅 미들웨어
# =============================================================================

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    요청 로깅 미들웨어

    모든 HTTP 요청의 메서드, 경로, 상태 코드, 소요 시간을 로깅합니다.
    DEBUG 모드에서만 상세 로깅을 수행합니다.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()

        # 요청 처리
        response = await call_next(request)

        # 소요 시간 계산
        process_time = time.time() - start_time

        # 로깅 (디버그 모드에서만 상세 로깅)
        client_ip = get_client_ip(request)
        log_message = (
            f"{request.method} {request.url.path} "
            f"- {response.status_code} "
            f"- {process_time:.3f}s "
            f"- {client_ip}"
        )

        # 상태 코드에 따라 로그 레벨 결정
        if response.status_code >= 500:
            logger.error(log_message)
        elif response.status_code >= 400:
            logger.warning(log_message)
        elif settings.DEBUG:
            logger.info(log_message)

        # X-Process-Time 헤더 추가
        response.headers["X-Process-Time"] = f"{process_time:.3f}"

        return response


# =============================================================================
# 보안 헤더 미들웨어
# =============================================================================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    보안 헤더 미들웨어

    OWASP 권장 보안 헤더를 응답에 추가합니다.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # 보안 헤더 추가
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # HTTPS 환경에서만 HSTS 헤더 추가
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        return response
