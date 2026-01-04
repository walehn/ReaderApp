"""
============================================================================
Pydantic Schemas - Reader Study MVP
============================================================================
역할: API 요청/응답 데이터 검증 및 직렬화

스키마 목록:
  인증/사용자:
    - ReaderBase, ReaderCreate, ReaderUpdate, ReaderResponse
    - LoginRequest, LoginResponse
  세션 관리:
    - SessionConfigDB, SessionProgressResponse
    - SessionSummary, SessionEnterResponse
  케이스/결과:
    - CaseMeta, SliceRequest, OverlayRequest
    - LesionMark, StudySubmission
  감사 로그:
    - AuditLogEntry

사용 예시:
  from app.models.schemas import CaseMeta, StudySubmission, ReaderCreate
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


# =============================================================================
# 인증/사용자 스키마 (Phase 1)
# =============================================================================

class ReaderBase(BaseModel):
    """리더 기본 정보"""
    reader_code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=1, max_length=200)
    role: Literal["reader", "admin"] = "reader"
    group: Optional[int] = Field(None, ge=1, le=2, description="Crossover 그룹 (1 또는 2)")


class ReaderCreate(ReaderBase):
    """리더 생성 요청"""
    password: str = Field(..., min_length=1)


class ReaderUpdate(BaseModel):
    """리더 정보 수정 요청"""
    name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    group: Optional[int] = Field(None, ge=1, le=2)
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=1)


class ReaderResponse(BaseModel):
    """리더 정보 응답"""
    id: int
    reader_code: str
    name: str
    email: str
    role: str
    group: Optional[int]
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    """로그인 요청"""
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    """로그인 응답"""
    reader_code: str
    name: str
    role: str
    group: Optional[int]


# =============================================================================
# 세션 관리 스키마 (Phase 1, DB 기반)
# =============================================================================

class SessionConfigDB(BaseModel):
    """DB 기반 세션 설정"""
    id: int
    session_code: str
    reader_code: str
    block_a_mode: Literal["UNAIDED", "AIDED"]
    block_b_mode: Literal["UNAIDED", "AIDED"]
    k_max: int = 3
    ai_threshold: float = 0.30
    status: Literal["pending", "in_progress", "completed"]
    created_at: datetime

    class Config:
        from_attributes = True


class SessionProgressResponse(BaseModel):
    """세션 진행 상태 응답"""
    current_block: Literal["A", "B"]
    current_case_index: int
    total_cases_in_block: int
    completed_cases_count: int
    progress_percent: float
    started_at: Optional[datetime]
    last_accessed_at: Optional[datetime]


class SessionSummary(BaseModel):
    """세션 요약 (대시보드용)"""
    session_code: str
    status: str
    block_a_mode: str
    block_b_mode: str
    progress_percent: float
    current_block: Optional[str]
    current_case_index: Optional[int]
    total_cases: int
    last_accessed_at: Optional[datetime]


class SessionEnterResponse(BaseModel):
    """세션 진입 응답"""
    session_id: int
    session_code: str
    current_block: str
    current_mode: str
    current_case_id: str
    current_case_index: int
    total_cases_in_block: int
    k_max: int
    ai_threshold: float
    is_new_session: bool  # 최초 진입 여부


class CurrentCaseResponse(BaseModel):
    """현재 케이스 정보 응답"""
    session_code: str
    block: str
    mode: str
    case_id: str
    case_index: int
    total_cases_in_block: int
    is_last_in_block: bool
    is_session_complete: bool


# =============================================================================
# 감사 로그 스키마 (Phase 1)
# =============================================================================

class AuditLogEntry(BaseModel):
    """감사 로그 항목"""
    id: int
    reader_code: Optional[str]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    ip_address: Optional[str]
    details: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogFilter(BaseModel):
    """감사 로그 필터"""
    reader_id: Optional[int] = None
    action: Optional[str] = None
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    limit: int = Field(default=100, le=1000)
