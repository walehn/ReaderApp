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
    z_flipped_baseline: bool = Field(
        default=False,
        description="Baseline Z축 반전 필요 여부"
    )
    z_flipped_followup: bool = Field(
        default=False,
        description="Followup Z축 반전 필요 여부"
    )


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


# =============================================================================
# 연구 설정 스키마 (StudyConfig)
# =============================================================================

class CrossoverBlockMapping(BaseModel):
    """개별 블록의 모드 매핑"""
    block_A: Literal["UNAIDED", "AIDED"]
    block_B: Literal["UNAIDED", "AIDED"]


class CrossoverSessionMapping(BaseModel):
    """세션별 블록 매핑"""
    S1: CrossoverBlockMapping
    S2: CrossoverBlockMapping


class CrossoverMapping(BaseModel):
    """전체 Crossover 매핑 (그룹별)"""
    group_1: CrossoverSessionMapping
    group_2: CrossoverSessionMapping


class StudyConfigResponse(BaseModel):
    """연구 설정 조회 응답"""
    id: int
    total_sessions: int
    total_blocks: int
    total_groups: int
    crossover_mapping: dict  # JSON으로 파싱된 CrossoverMapping
    k_max: int
    ai_threshold: float
    confidence_mode: str
    require_lesion_marking: bool
    case_order_mode: str
    random_seed: Optional[int]
    is_locked: bool
    locked_at: Optional[datetime]
    locked_by: Optional[int]
    study_name: str
    study_description: Optional[str]
    group_names: dict  # {"group_1": "Group 1", "group_2": "Group 2"} - Lock 후에도 수정 가능
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudyConfigPublicResponse(BaseModel):
    """공개 연구 설정 (인증 불필요) - 세션/블록 수 및 그룹명 노출"""
    total_sessions: int
    total_blocks: int
    study_name: str
    group_names: Optional[dict] = None  # {"group_1": "그룹명", ...} - 표시용


class StudyConfigUpdateRequest(BaseModel):
    """연구 설정 수정 요청

    Lock 전: 모든 필드 수정 가능
    Lock 후: study_name, study_description, ai_threshold, group_names만 수정 가능
    """
    # 구조 설정 (Lock 후 수정 불가)
    total_sessions: Optional[int] = Field(None, ge=1, le=4)
    total_blocks: Optional[int] = Field(None, ge=1, le=4)
    total_groups: Optional[int] = Field(None, ge=1, le=4)
    crossover_mapping: Optional[dict] = None

    # 입력 설정 (Lock 후 수정 불가)
    k_max: Optional[int] = Field(None, ge=1, le=10)
    require_lesion_marking: Optional[bool] = None

    # 케이스 순서 설정
    case_order_mode: Optional[Literal["random", "fixed"]] = None
    random_seed: Optional[int] = None

    # 수정 가능 필드 (Lock 후에도 변경 가능)
    ai_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    confidence_mode: Optional[Literal["categorical", "continuous"]] = None
    study_name: Optional[str] = Field(None, max_length=200)
    study_description: Optional[str] = None
    group_names: Optional[dict] = None  # {"group_1": "그룹명", ...} - Lock 후에도 수정 가능


class MessageResponse(BaseModel):
    """일반 메시지 응답"""
    message: str


# =============================================================================
# 대시보드 스키마 (Dashboard)
# =============================================================================

class DashboardSummaryResponse(BaseModel):
    """전체 진행 요약"""
    total_readers: int = Field(..., description="전체 리더 수 (활성화된)")
    readers_started: int = Field(..., description="1개 이상 세션 시작한 리더 수")
    readers_completed: int = Field(..., description="모든 세션 완료한 리더 수")
    total_sessions: int = Field(..., description="전체 할당된 세션 수")
    completed_sessions: int = Field(..., description="완료된 세션 수")
    in_progress_sessions: int = Field(..., description="진행중 세션 수")
    pending_sessions: int = Field(..., description="대기중 세션 수")
    overall_progress_percent: float = Field(..., description="전체 진행률 (%)")
    study_config_locked: bool = Field(..., description="연구 설정 잠금 상태")


class SessionProgressDetail(BaseModel):
    """세션 진행 상세"""
    session_id: int
    session_code: str
    status: str
    block_a_mode: str
    block_b_mode: str
    current_block: Optional[str]
    current_case_index: Optional[int]
    total_cases: int
    completed_cases: int
    progress_percent: float
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


class ReaderProgressResponse(BaseModel):
    """리더별 진행 현황"""
    reader_id: int
    reader_code: str
    name: str
    group: Optional[int]
    sessions: list[SessionProgressDetail]
    total_progress_percent: float
    avg_reading_time_sec: Optional[float]
    last_accessed_at: Optional[datetime]
    status: Literal["idle", "active", "completed"]  # 활동 상태


class GroupProgressResponse(BaseModel):
    """그룹별 진행 현황"""
    group: int
    total_readers: int
    readers_started: int
    readers_completed: int
    total_sessions: int
    completed_sessions: int
    progress_percent: float


class SessionStatsResponse(BaseModel):
    """세션별 통계"""
    session_code: str
    total_assigned: int
    completed: int
    in_progress: int
    pending: int
    completion_rate: float
