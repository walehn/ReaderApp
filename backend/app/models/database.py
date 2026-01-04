"""
============================================================================
SQLite Database Models - Reader Study MVP
============================================================================
역할: 결과 저장을 위한 SQLAlchemy ORM 모델

테이블:
  - study_results: 환자 수준 판정 결과
  - lesion_marks: 병변 마커 (study_results 참조)

사용 예시:
  from app.models.database import get_db, StudyResult

  async with get_db() as db:
      result = StudyResult(reader_id="R01", ...)
      db.add(result)
      await db.commit()

데이터베이스 위치:
  /home/walehn/ReaderApp/results/reader_study.db
============================================================================
"""

from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime
from pathlib import Path

# =============================================================================
# 데이터베이스 설정
# =============================================================================

# 결과 저장 경로
RESULTS_DIR = Path(__file__).parent.parent.parent.parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)
DATABASE_URL = f"sqlite+aiosqlite:///{RESULTS_DIR}/reader_study.db"

# 엔진 및 세션 설정
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# ORM 베이스
Base = declarative_base()


# =============================================================================
# ORM 모델
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
    created_at = Column(DateTime, default=datetime.utcnow)

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
