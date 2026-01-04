"""
============================================================================
Configuration - Reader Study MVP
============================================================================
역할: 애플리케이션 전역 설정 관리

설정 항목:
  - CASES_DIR: NIfTI 케이스 디렉토리
  - SESSIONS_DIR: 세션 설정 JSON 디렉토리
  - RESULTS_DIR: 결과 저장 디렉토리
  - WL_PRESETS: Window/Level 프리셋
  - CACHE_SIZES: 캐시 크기 설정
  - SECRET_KEY: JWT 서명 키
  - ACCESS_TOKEN_EXPIRE_HOURS: 토큰 만료 시간

환경 변수:
  READER_STUDY_CASES_DIR: 케이스 디렉토리 경로 (선택)
  READER_STUDY_DEBUG: 디버그 모드 (선택)
  READER_STUDY_SECRET_KEY: JWT 시크릿 키 (프로덕션 필수)
============================================================================
"""

from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional, List
import os
import secrets


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # 기본 경로 (프로젝트 루트 기준)
    PROJECT_ROOT: Path = Path(__file__).parent.parent.parent

    # 데이터 디렉토리
    CASES_DIR: Path = PROJECT_ROOT / "cases"
    SESSIONS_DIR: Path = PROJECT_ROOT / "sessions"
    RESULTS_DIR: Path = PROJECT_ROOT / "results"

    # 서버 설정
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # Window/Level 프리셋 (WW, WL)
    WL_PRESETS: dict = {
        "liver": {"ww": 150, "wl": 50},
        "soft": {"ww": 400, "wl": 40}
    }

    # 캐시 설정
    SLICE_CACHE_SIZE: int = 500  # 슬라이스 이미지 캐시
    VOLUME_CACHE_SIZE: int = 10  # NIfTI 볼륨 캐시

    # JPEG 품질
    JPEG_QUALITY: int = 85

    # 병변 마커 최대 수
    MAX_LESIONS: int = 3

    # 인증 설정
    SECRET_KEY: str = secrets.token_urlsafe(32)  # JWT 서명 키 (프로덕션에서는 환경변수로 설정)
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8  # 토큰 만료 시간

    # IP 제한 (선택) - 비어있으면 제한 없음
    ALLOWED_IP_RANGES: List[str] = []  # 예: ["192.168.0.0/16", "10.0.0.0/8"]

    class Config:
        env_prefix = "READER_STUDY_"


# 싱글톤 설정 인스턴스
settings = Settings()

# 디렉토리 자동 생성
settings.CASES_DIR.mkdir(exist_ok=True)
settings.SESSIONS_DIR.mkdir(exist_ok=True)
settings.RESULTS_DIR.mkdir(exist_ok=True)
