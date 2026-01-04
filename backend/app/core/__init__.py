"""
============================================================================
Core Package - Reader Study MVP
============================================================================
역할: 인증, 보안, 미들웨어 등 핵심 기능 모듈

모듈:
  - security: 비밀번호 해싱, JWT 토큰 처리
  - dependencies: FastAPI 의존성 (인증 검증)
  - middleware: IP 제한, 감사 로그

사용 예시:
  from app.core.security import hash_password, verify_password
  from app.core.dependencies import get_current_reader, require_admin
============================================================================
"""

# 순환 import 방지를 위해 런타임에 import
# from app.core.security import hash_password, verify_password, create_access_token
