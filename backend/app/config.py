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
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, BeforeValidator
from typing import Optional, List, Annotated
import os
import secrets


def parse_ip_ranges(v):
    """환경 변수에서 IP 범위 리스트 파싱"""
    if v is None or v == "":
        return []
    if isinstance(v, list):
        return v
    # 쉼표로 구분된 문자열을 리스트로 변환
    return [ip.strip() for ip in v.split(",") if ip.strip()]


# 커스텀 타입: 문자열을 리스트로 변환
IPRangeList = Annotated[List[str], BeforeValidator(parse_ip_ranges)]


# 기본 경로 계산 (클래스 외부에서)
_DEFAULT_PROJECT_ROOT = Path(__file__).parent.parent.parent


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # 기본 경로 (프로젝트 루트 기준)
    PROJECT_ROOT: Path = _DEFAULT_PROJECT_ROOT

    # 데이터 디렉토리 (환경 변수로 오버라이드 가능)
    CASES_DIR: Path = _DEFAULT_PROJECT_ROOT / "cases"
    SESSIONS_DIR: Path = _DEFAULT_PROJECT_ROOT / "sessions"
    RESULTS_DIR: Path = _DEFAULT_PROJECT_ROOT / "results"

    # Dataset 디렉토리 (실제 NIfTI 파일 저장소)
    DATASET_DIR: Path = _DEFAULT_PROJECT_ROOT / "dataset"
    POSITIVE_DIR: Optional[Path] = None  # DATASET_DIR 기반으로 계산
    NEGATIVE_DIR: Optional[Path] = None
    AI_LABEL_DIR: Optional[Path] = None

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # DATASET_DIR 기반 하위 디렉토리 설정
        if self.POSITIVE_DIR is None:
            object.__setattr__(self, 'POSITIVE_DIR', self.DATASET_DIR / "positive")
        if self.NEGATIVE_DIR is None:
            object.__setattr__(self, 'NEGATIVE_DIR', self.DATASET_DIR / "negative")
        if self.AI_LABEL_DIR is None:
            object.__setattr__(self, 'AI_LABEL_DIR', self.DATASET_DIR / "LabelAI")

    # 서버 설정
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # Window/Level 프리셋 (WW, WL)
    WL_PRESETS: dict = {
        "liver": {"ww": 150, "wl": 50},
        "soft": {"ww": 400, "wl": 40}
    }

    # JPEG 품질 (레거시 render_slice용)
    JPEG_QUALITY: int = 85

    # 병변 마커 최대 수
    MAX_LESIONS: int = 3

    # 인증 설정
    SECRET_KEY: str = secrets.token_urlsafe(32)  # JWT 서명 키 (프로덕션에서는 환경변수로 설정)
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8  # 토큰 만료 시간

    # IP 제한 (선택) - 비어있으면 제한 없음
    # 환경 변수에서는 쉼표로 구분된 문자열로 설정: "192.168.0.0/16,10.0.0.0/8"
    ALLOWED_IP_RANGES: IPRangeList = []

    # pydantic-settings v2 설정
    model_config = SettingsConfigDict(
        env_prefix="READER_STUDY_",
        # 프로젝트 루트의 .env 파일 로드 (개발/Docker 공용)
        env_file=str(_DEFAULT_PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        # Docker용 변수(HTTP_PORT, DEBUG 등)는 무시
        extra="ignore",
    )


# 싱글톤 설정 인스턴스
settings = Settings()

# 디렉토리 자동 생성 (Docker 환경에서는 볼륨 마운트로 이미 존재할 수 있음)
try:
    settings.CASES_DIR.mkdir(exist_ok=True)
    settings.SESSIONS_DIR.mkdir(exist_ok=True)
    settings.RESULTS_DIR.mkdir(exist_ok=True)
except PermissionError:
    # Docker 환경에서 읽기 전용 볼륨이거나 권한 없는 경우 무시
    pass
