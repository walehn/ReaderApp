"""
============================================================================
Session Service - Reader Study MVP
============================================================================
역할: 세션 설정 로드 및 상태 관리

주요 기능:
  - load_session(): JSON 파일에서 세션 설정 로드
  - validate_session_mode(): 세션 모드 검증 (UNAIDED/AIDED)
  - get_session_state(): 현재 세션 상태 조회

세션 파일 형식 (sessions/session_R01_S1.json):
  {
    "reader_id": "R01",
    "session_id": "S1",
    "mode": "UNAIDED",
    "case_ids": ["case_0001", "case_0002"],
    "k_max": 3,
    "ai_threshold": 0.30
  }

사용 예시:
  from app.services.session_service import session_service

  config = session_service.load_session("R01", "S1")
  is_aided = session_service.is_aided_mode("R01", "S1")
============================================================================
"""

import json
from pathlib import Path
from typing import Optional, Dict
from app.config import settings
from app.models.schemas import SessionConfig, SessionState


class SessionService:
    """세션 관리 서비스"""

    def __init__(self):
        self.sessions_dir = settings.SESSIONS_DIR
        # 메모리 내 세션 상태 캐시
        self._session_cache: Dict[str, SessionConfig] = {}
        self._session_states: Dict[str, SessionState] = {}

    def _get_session_key(self, reader_id: str, session_id: str) -> str:
        """세션 캐시 키 생성"""
        return f"{reader_id}_{session_id}"

    def load_session(self, reader_id: str, session_id: str) -> SessionConfig:
        """
        세션 설정 로드

        Args:
            reader_id: Reader ID (예: "R01")
            session_id: Session ID (예: "S1")

        Returns:
            SessionConfig 객체
        """
        key = self._get_session_key(reader_id, session_id)

        # 캐시 확인
        if key in self._session_cache:
            return self._session_cache[key]

        # JSON 파일 로드
        filename = f"session_{reader_id}_{session_id}.json"
        filepath = self.sessions_dir / filename

        if not filepath.exists():
            raise FileNotFoundError(f"Session file not found: {filename}")

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        config = SessionConfig(**data)

        # 캐시 저장
        self._session_cache[key] = config

        return config

    def is_aided_mode(self, reader_id: str, session_id: str) -> bool:
        """세션이 AIDED 모드인지 확인"""
        try:
            config = self.load_session(reader_id, session_id)
            return config.mode == "AIDED"
        except FileNotFoundError:
            return False

    def validate_ai_access(
        self, reader_id: str, session_id: str
    ) -> bool:
        """
        AI 오버레이 접근 권한 검증

        AIDED 모드에서만 True 반환
        """
        return self.is_aided_mode(reader_id, session_id)

    def get_session_state(
        self, reader_id: str, session_id: str
    ) -> SessionState:
        """
        현재 세션 상태 조회 (진행 상황 포함)
        """
        key = self._get_session_key(reader_id, session_id)

        if key not in self._session_states:
            config = self.load_session(reader_id, session_id)
            self._session_states[key] = SessionState(
                config=config,
                current_case_index=0,
                completed_cases=[]
            )

        return self._session_states[key]

    def update_session_progress(
        self,
        reader_id: str,
        session_id: str,
        completed_case: str
    ) -> SessionState:
        """
        세션 진행 상황 업데이트
        """
        state = self.get_session_state(reader_id, session_id)

        if completed_case not in state.completed_cases:
            state.completed_cases.append(completed_case)

        # 다음 케이스로 이동
        if state.current_case_index < len(state.config.case_ids) - 1:
            state.current_case_index += 1

        return state

    def list_sessions(self) -> list[str]:
        """사용 가능한 세션 목록 조회"""
        sessions = []
        for f in self.sessions_dir.glob("session_*.json"):
            # session_R01_S1.json -> R01_S1
            name = f.stem.replace("session_", "")
            sessions.append(name)
        return sorted(sessions)

    def clear_cache(self):
        """세션 캐시 초기화"""
        self._session_cache.clear()
        self._session_states.clear()


# 싱글톤 인스턴스
session_service = SessionService()
