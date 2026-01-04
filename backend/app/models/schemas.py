"""
============================================================================
Pydantic Schemas - Reader Study MVP
============================================================================
역할: API 요청/응답 데이터 검증 및 직렬화

스키마 목록:
  - CaseMeta: 케이스 메타데이터 (shape, slices, spacing)
  - SliceRequest: 슬라이스 렌더링 요청
  - OverlayRequest: AI 오버레이 요청
  - LesionMark: 병변 마커 (x, y, z, confidence)
  - StudySubmission: 결과 제출
  - SessionConfig: 세션 설정

사용 예시:
  from app.models.schemas import CaseMeta, StudySubmission
  meta = CaseMeta(shape=[256, 256, 100], slices=100, spacing=[1.0, 1.0, 2.5])
============================================================================
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime


# =============================================================================
# 케이스 관련 스키마
# =============================================================================

class CaseMeta(BaseModel):
    """케이스 메타데이터"""
    case_id: str
    shape: list[int] = Field(..., description="볼륨 shape [x, y, z]")
    slices: int = Field(..., description="Z축 슬라이스 수")
    spacing: list[float] = Field(..., description="복셀 간격 [x, y, z] mm")
    ai_available: bool = Field(default=False, description="AI 확률맵 존재 여부")


# =============================================================================
# 렌더링 요청 스키마
# =============================================================================

class SliceRequest(BaseModel):
    """슬라이스 렌더링 요청 파라미터"""
    case_id: str
    series: Literal["baseline", "followup"]
    z: int = Field(..., ge=0, description="슬라이스 인덱스")
    wl: Literal["liver", "soft"] = Field(default="liver", description="Window/Level 프리셋")


class OverlayRequest(BaseModel):
    """AI 오버레이 요청 파라미터 (AIDED 모드 전용)"""
    case_id: str
    z: int = Field(..., ge=0)
    threshold: float = Field(default=0.30, ge=0.0, le=1.0)
    alpha: float = Field(default=0.4, ge=0.0, le=1.0)


# =============================================================================
# 병변 마커 스키마
# =============================================================================

class LesionMark(BaseModel):
    """개별 병변 마커"""
    x: int = Field(..., ge=0, description="X 좌표 (픽셀)")
    y: int = Field(..., ge=0, description="Y 좌표 (픽셀)")
    z: int = Field(..., ge=0, description="Z 슬라이스 인덱스")
    confidence: Literal["definite", "probable", "possible"] = Field(
        ..., description="병변 확신도"
    )


# =============================================================================
# 결과 제출 스키마
# =============================================================================

class StudySubmission(BaseModel):
    """Reader Study 결과 제출"""
    reader_id: str = Field(..., min_length=1)
    session_id: str = Field(..., min_length=1)
    mode: Literal["UNAIDED", "AIDED"]
    case_id: str = Field(..., min_length=1)
    patient_new_met_present: bool = Field(..., description="환자 수준 판정 (Yes/No)")
    lesions: list[LesionMark] = Field(default=[], max_length=3)
    time_spent_sec: float = Field(..., ge=0, description="소요 시간 (초)")


class StudySubmissionResponse(BaseModel):
    """결과 제출 응답"""
    success: bool
    message: str
    result_id: Optional[int] = None


# =============================================================================
# 세션 설정 스키마
# =============================================================================

class SessionConfig(BaseModel):
    """세션 설정 (JSON 파일에서 로드)"""
    reader_id: str
    session_id: str
    mode: Literal["UNAIDED", "AIDED"]
    case_ids: list[str]
    k_max: int = Field(default=3, description="최대 병변 마커 수")
    ai_threshold: float = Field(default=0.30)


class SessionState(BaseModel):
    """현재 세션 상태"""
    config: SessionConfig
    current_case_index: int = 0
    completed_cases: list[str] = []


# =============================================================================
# 내보내기 스키마
# =============================================================================

class ExportRequest(BaseModel):
    """데이터 내보내기 요청"""
    session_id: Optional[str] = None
    reader_id: Optional[str] = None
    format: Literal["csv", "json"] = "csv"


class PatientLevelResult(BaseModel):
    """환자 수준 결과 (내보내기용)"""
    reader_id: str
    session_id: str
    mode: str
    case_id: str
    patient_decision: bool
    lesion_count: int
    time_spent_sec: float
    created_at: datetime


class LesionLevelResult(BaseModel):
    """병변 수준 결과 (내보내기용)"""
    reader_id: str
    session_id: str
    case_id: str
    lesion_order: int
    x: int
    y: int
    z: int
    confidence: str
