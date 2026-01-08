"""
============================================================================
SQLite Database Models - Reader Study MVP
============================================================================
역할: 결과 저장 및 사용자/세션 관리를 위한 SQLAlchemy ORM 모델

테이블:
  - study_config: 전역 연구 설정 (Singleton)
  - readers: 리더(판독자) 및 관리자 계정
  - study_sessions: 스터디 세션 (Block/Mode 매핑)
  - session_progress: 세션 진행 상태 영속화
  - study_results: 환자 수준 판정 결과
  - lesion_marks: 병변 마커 (study_results 참조)
  - audit_logs: 감사 로그

사용 예시:
  from app.models.database import get_db, StudyResult, Reader, StudyConfig

  async with get_db() as db:
      result = StudyResult(reader_id="R01", ...)
      db.add(result)
      await db.commit()

데이터베이스 위치:
  /home/walehn/ReaderApp/results/reader_study.db
============================================================================
"""

from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def _utc_now() -> datetime:
    """Timezone-aware UTC 현재 시간 반환 (모델 기본값용)"""
    return datetime.now(timezone.utc)

# =============================================================================
# 데이터베이스 설정
# =============================================================================

# config에서 결과 저장 경로 가져오기 (환경 변수 지원)
from app.config import settings
RESULTS_DIR = settings.RESULTS_DIR
try:
    RESULTS_DIR.mkdir(exist_ok=True)
except PermissionError:
    # Docker 환경에서 이미 존재하는 볼륨의 경우 무시
    pass
DATABASE_URL = f"sqlite+aiosqlite:///{RESULTS_DIR}/reader_study.db"

# 엔진 및 세션 설정
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# ORM 베이스
Base = declarative_base()


# =============================================================================
# ORM 모델 - 전역 연구 설정
# =============================================================================

# 기본 Crossover 매핑 (2x2x2 Latin Square)
DEFAULT_CROSSOVER_MAPPING = """{
  "group_1": {
    "S1": {"block_A": "UNAIDED", "block_B": "AIDED"},
    "S2": {"block_A": "AIDED", "block_B": "UNAIDED"}
  },
  "group_2": {
    "S1": {"block_A": "AIDED", "block_B": "UNAIDED"},
    "S2": {"block_A": "UNAIDED", "block_B": "AIDED"}
  }
}"""

# 기본 그룹명 (Lock 후에도 수정 가능)
DEFAULT_GROUP_NAMES = '{"group_1": "Group 1", "group_2": "Group 2"}'


class StudyConfig(Base):
    """
    전역 연구 설정 테이블 (Singleton - 단일 레코드)

    역할:
      - 연구 전체의 구조적 설정 저장
      - 첫 세션 시작 후 핵심 설정 자동 잠금
      - Crossover 디자인 매핑 관리

    Lock 정책:
      - 잠기는 필드: total_sessions, total_blocks, total_groups,
                    crossover_mapping, k_max, require_lesion_marking
      - 수정 가능: study_name, study_description, ai_threshold, group_names

    MVP 제한:
      - 세션=2, 블록=2, 그룹=2 구조만 공식 지원
    """
    __tablename__ = "study_config"

    id = Column(Integer, primary_key=True, default=1)

    # 세션/블록 구조 (MVP: 모두 2로 고정)
    total_sessions = Column(Integer, default=2, nullable=False)
    total_blocks = Column(Integer, default=2, nullable=False)
    total_groups = Column(Integer, default=2, nullable=False)

    # Crossover 매핑 (JSON Text, canonical 저장)
    crossover_mapping = Column(Text, default=DEFAULT_CROSSOVER_MAPPING, nullable=False)

    # 입력 설정
    k_max = Column(Integer, default=3, nullable=False)
    ai_threshold = Column(Float, default=0.30, nullable=False)
    confidence_mode = Column(String(20), default="categorical", nullable=False)
    # patient_decision은 항상 필수 (연구 방법론상 고정) - 필드 없음
    require_lesion_marking = Column(Boolean, default=True, nullable=False)

    # 케이스 순서 설정
    case_order_mode = Column(String(20), default="random", nullable=False)
    random_seed = Column(Integer, nullable=True)

    # Lock 상태
    is_locked = Column(Boolean, default=False, nullable=False)
    locked_at = Column(DateTime, nullable=True)
    locked_by = Column(Integer, ForeignKey("readers.id", ondelete="SET NULL"), nullable=True)

    # 메타데이터
    study_name = Column(String(200), default="Reader Study", nullable=False)
    study_description = Column(Text, nullable=True)
    group_names = Column(Text, default=DEFAULT_GROUP_NAMES, nullable=False)  # Lock 후에도 수정 가능
    created_at = Column(DateTime, default=_utc_now)
    updated_at = Column(DateTime, default=_utc_now, onupdate=_utc_now)

    # 관계 (Lock 발생시킨 리더 참조)
    locked_by_reader = relationship("Reader", foreign_keys=[locked_by])


# =============================================================================
# ORM 모델 - 사용자 관리
# =============================================================================

class Reader(Base):
    """
    리더(판독자) 및 관리자 계정 테이블

    역할:
      - reader: 일반 판독자 (본인 세션만 접근)
      - admin: 관리자 (전체 관리 기능)

    그룹:
      - Group 1: Session1에서 Block A=UNAIDED, B=AIDED
      - Group 2: Session1에서 Block A=AIDED, B=UNAIDED
    """
    __tablename__ = "readers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reader_code = Column(String(50), unique=True, nullable=False, index=True)  # R01, R02...
    name = Column(String(100), nullable=False)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="reader", nullable=False)  # reader | admin
    group = Column(Integer, nullable=True)  # 1 | 2 (crossover 그룹, admin은 null)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=_utc_now)
    last_login_at = Column(DateTime, nullable=True)

    # 관계
    sessions = relationship("StudySession", back_populates="reader", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="reader")


class StudySession(Base):
    """
    스터디 세션 테이블 (기존 JSON 파일 대체)

    Block/Mode 매핑:
      - Group 1, S1: Block A=UNAIDED, B=AIDED
      - Group 1, S2: Block A=AIDED, B=UNAIDED
      - Group 2, S1: Block A=AIDED, B=UNAIDED
      - Group 2, S2: Block A=UNAIDED, B=AIDED

    케이스 순서:
      - 세션 최초 진입 시 랜덤 생성
      - JSON 배열로 저장
    """
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_code = Column(String(50), nullable=False)  # S1, S2
    reader_id = Column(Integer, ForeignKey("readers.id"), nullable=False)

    # Block/Mode 매핑
    block_a_mode = Column(String(10), nullable=False)  # UNAIDED | AIDED
    block_b_mode = Column(String(10), nullable=False)  # AIDED | UNAIDED

    # 케이스 순서 (랜덤, 최초 진입 시 1회 생성) - JSON 배열
    case_order_block_a = Column(Text, nullable=True)
    case_order_block_b = Column(Text, nullable=True)

    # 설정
    k_max = Column(Integer, default=3, nullable=False)
    ai_threshold = Column(Float, default=0.30, nullable=False)

    # 상태: pending(대기), in_progress(진행중), completed(완료)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime, default=_utc_now)

    # 관계
    reader = relationship("Reader", back_populates="sessions")
    progress = relationship("SessionProgress", back_populates="session", uselist=False, cascade="all, delete-orphan")

    # 유니크 제약: reader당 session_code는 고유
    __table_args__ = (
        UniqueConstraint('reader_id', 'session_code', name='uq_reader_session'),
    )


class SessionProgress(Base):
    """
    세션 진행 상태 영속화 테이블

    서버 재시작 후에도 진행 상태 유지
    """
    __tablename__ = "session_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("study_sessions.id"), nullable=False)

    # 진행 상태
    current_block = Column(String(1), default="A", nullable=False)  # A | B
    current_case_index = Column(Integer, default=0, nullable=False)
    completed_cases = Column(Text, default="[]", nullable=False)  # JSON 배열

    # 시간 기록
    started_at = Column(DateTime, nullable=True)
    last_accessed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # 관계
    session = relationship("StudySession", back_populates="progress")

    # 유니크: session당 1개
    __table_args__ = (
        UniqueConstraint('session_id', name='uq_session_progress'),
    )


class AuditLog(Base):
    """
    감사 로그 테이블

    기록 대상:
      - LOGIN, LOGOUT: 로그인/로그아웃
      - SESSION_START, SESSION_COMPLETE: 세션 시작/완료
      - CASE_SUBMIT: 케이스 결과 제출
      - ADMIN_*: 관리자 작업
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reader_id = Column(Integer, ForeignKey("readers.id"), nullable=True)  # 로그인 전 작업은 null
    action = Column(String(50), nullable=False)
    resource_type = Column(String(50), nullable=True)  # session, case, reader
    resource_id = Column(String(100), nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv6 지원
    user_agent = Column(String(500), nullable=True)
    details = Column(Text, nullable=True)  # JSON 형식 추가 정보
    created_at = Column(DateTime, default=_utc_now, index=True)

    # 관계
    reader = relationship("Reader", back_populates="audit_logs")


# =============================================================================
# ORM 모델 - 연구 결과
# =============================================================================

class StudyResult(Base):
    """환자 수준 판정 결과 테이블"""
    __tablename__ = "study_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reader_id = Column(String(50), nullable=False, index=True)
    session_id = Column(String(50), nullable=False, index=True)
    mode = Column(String(10), nullable=False)  # UNAIDED | AIDED
    case_id = Column(String(50), nullable=False, index=True)
    patient_decision = Column(Boolean, nullable=False)
    time_spent_sec = Column(Float, nullable=False)
    created_at = Column(DateTime, default=_utc_now)

    # 병변 마커 관계
    lesions = relationship("LesionMark", back_populates="result", cascade="all, delete-orphan")

    # 복합 유니크 제약조건: 동일 reader/session/case 조합은 1회만 허용
    __table_args__ = (
        # UniqueConstraint를 사용하지 않고, 코드 레벨에서 중복 체크
    )


class LesionMark(Base):
    """병변 마커 테이블"""
    __tablename__ = "lesion_marks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    result_id = Column(Integer, ForeignKey("study_results.id"), nullable=False)
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    z = Column(Integer, nullable=False)
    confidence = Column(String(20), nullable=False)  # definite | probable | possible
    mark_order = Column(Integer, nullable=False)  # 1, 2, 3

    # 역참조
    result = relationship("StudyResult", back_populates="lesions")


# =============================================================================
# 데이터베이스 유틸리티
# =============================================================================

async def init_db():
    """데이터베이스 테이블 생성"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """비동기 DB 세션 제공"""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
