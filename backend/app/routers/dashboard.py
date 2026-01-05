"""
============================================================================
Dashboard Router - Reader Study MVP
============================================================================
역할: 진행률 모니터링 대시보드 API

엔드포인트:
  - GET /dashboard/summary      전체 진행 요약
  - GET /dashboard/by-reader    리더별 진행률
  - GET /dashboard/by-group     그룹별 진행률
  - GET /dashboard/by-session   세션별 진행률

인증:
  모든 엔드포인트는 관리자 권한 필요 (require_admin)

진행률 계산 기준:
  - "완료" 정의: patient_decision 제출 필수 + lesion_marks (require_lesion_marking=true일 때)
  - 세션 상태: pending → in_progress → completed
  - 전체 진행률: (완료 세션 수 / 전체 할당 세션 수) * 100
============================================================================
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.models.database import get_db, Reader
from app.models.schemas import (
    DashboardSummaryResponse,
    ReaderProgressResponse,
    GroupProgressResponse,
    SessionStatsResponse
)
from app.services.dashboard_service import DashboardService
from app.core.dependencies import require_admin


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# =============================================================================
# 전체 요약
# =============================================================================

@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> DashboardSummaryResponse:
    """
    전체 진행 요약

    Returns:
        DashboardSummaryResponse: 대시보드 요약 데이터
            - total_readers: 전체 활성 리더 수
            - readers_started: 1개 이상 세션 시작한 리더 수
            - readers_completed: 모든 세션 완료한 리더 수
            - total_sessions: 전체 할당된 세션 수
            - completed_sessions: 완료된 세션 수
            - in_progress_sessions: 진행중 세션 수
            - pending_sessions: 대기중 세션 수
            - overall_progress_percent: 전체 진행률 (%)
            - study_config_locked: 연구 설정 잠금 상태
    """
    service = DashboardService(db)
    summary = await service.get_summary()

    return DashboardSummaryResponse(**summary)


# =============================================================================
# 리더별 진행률
# =============================================================================

@router.get("/by-reader", response_model=List[ReaderProgressResponse])
async def get_progress_by_reader(
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> List[ReaderProgressResponse]:
    """
    리더별 진행 현황

    Returns:
        List[ReaderProgressResponse]: 리더별 진행 데이터
            - reader_id, reader_code, name, group
            - sessions: 세션별 진행 상세 목록
            - total_progress_percent: 전체 진행률
            - avg_reading_time_sec: 평균 판독 시간
            - last_accessed_at: 마지막 접속 시간
            - status: idle | active | completed
    """
    service = DashboardService(db)
    readers = await service.get_progress_by_reader()

    return [ReaderProgressResponse(**r) for r in readers]


# =============================================================================
# 그룹별 진행률
# =============================================================================

@router.get("/by-group", response_model=List[GroupProgressResponse])
async def get_progress_by_group(
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> List[GroupProgressResponse]:
    """
    그룹별 진행 현황

    Returns:
        List[GroupProgressResponse]: 그룹별 진행 데이터
            - group: 그룹 번호 (1 또는 2)
            - total_readers: 그룹 내 전체 리더 수
            - readers_started: 시작한 리더 수
            - readers_completed: 완료한 리더 수
            - total_sessions: 전체 세션 수
            - completed_sessions: 완료 세션 수
            - progress_percent: 진행률 (%)
    """
    service = DashboardService(db)
    groups = await service.get_progress_by_group()

    return [GroupProgressResponse(**g) for g in groups]


# =============================================================================
# 세션별 진행률
# =============================================================================

@router.get("/by-session", response_model=List[SessionStatsResponse])
async def get_progress_by_session(
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> List[SessionStatsResponse]:
    """
    세션 코드별 통계 (S1, S2)

    Returns:
        List[SessionStatsResponse]: 세션별 통계 데이터
            - session_code: S1 또는 S2
            - total_assigned: 전체 할당 수
            - completed: 완료 수
            - in_progress: 진행중 수
            - pending: 대기중 수
            - completion_rate: 완료율 (%)
    """
    service = DashboardService(db)
    sessions = await service.get_progress_by_session()

    return [SessionStatsResponse(**s) for s in sessions]
