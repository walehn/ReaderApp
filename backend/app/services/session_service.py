"""
============================================================================
Session Service - Reader Study MVP
============================================================================
역할: 세션 목록 조회 (JSON 파일 기반 레거시 세션용)

주요 기능:
  - list_sessions(): 사용 가능한 세션 목록 조회

Note:
  DB 기반 세션 관리는 study_session_service.py를 사용합니다.
  이 서비스는 레거시 JSON 파일 세션 호환성을 위해 유지됩니다.

사용 예시:
  from app.services.session_service import session_service

  sessions = session_service.list_sessions()
============================================================================
"""

from app.config import settings


class SessionService:
    """세션 관리 서비스 (레거시 JSON 파일용)"""

    def __init__(self):
        self.sessions_dir = settings.SESSIONS_DIR

    def list_sessions(self) -> list[str]:
        """사용 가능한 세션 목록 조회"""
        sessions = []
        for f in self.sessions_dir.glob("session_*.json"):
            # session_R01_S1.json -> R01_S1
            name = f.stem.replace("session_", "")
            sessions.append(name)
        return sorted(sessions)


# 싱글톤 인스턴스
session_service = SessionService()
