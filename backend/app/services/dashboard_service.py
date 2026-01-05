"""
============================================================================
Dashboard Service - Reader Study MVP
============================================================================
역할: 진행률 모니터링 및 대시보드 데이터 제공

주요 기능:
  - get_summary(): 전체 진행 요약
  - get_progress_by_reader(): 리더별 진행률
  - get_progress_by_group(): 그룹별 진행률
  - get_progress_by_session(): 세션별 진행률

진행률 계산 기준:
  - "완료" 정의: patient_decision 제출 (필수) + lesion_marks (require_lesion_marking=true일 때)
  - 세션 상태: pending → in_progress → completed
  - 전체 진행률: (완료 세션 수 / 전체 할당 세션 수) * 100

사용 예시:
  from app.services.dashboard_service import DashboardService

  service = DashboardService(db)
  summary = await service.get_summary()
  readers = await service.get_progress_by_reader()
============================================================================
"""

import json
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import (
    Reader, StudySession, SessionProgress, StudyResult, StudyConfig
)
from app.services.study_config_service import StudyConfigService


class DashboardService:
    """
    대시보드 데이터 서비스

    진행률 계산 및 통계 데이터 제공
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.config_service = StudyConfigService(db)

    # =========================================================================
    # 전체 요약
    # =========================================================================

    async def get_summary(self) -> dict:
        """
        전체 진행 요약

        Returns:
            dict: 대시보드 요약 데이터
        """
        config = await self.config_service.get_or_create_config()

        # 리더 통계
        readers_result = await self.db.execute(
            select(Reader).where(
                and_(Reader.is_active == True, Reader.role == "reader")
            )
        )
        all_readers = readers_result.scalars().all()
        total_readers = len(all_readers)

        # 세션 통계
        sessions_result = await self.db.execute(
            select(StudySession).options(selectinload(StudySession.progress))
        )
        all_sessions = sessions_result.scalars().all()

        total_sessions = len(all_sessions)
        completed_sessions = sum(1 for s in all_sessions if s.status == "completed")
        in_progress_sessions = sum(1 for s in all_sessions if s.status == "in_progress")
        pending_sessions = total_sessions - completed_sessions - in_progress_sessions

        # 리더별 시작/완료 현황
        reader_session_map = {}
        for session in all_sessions:
            if session.reader_id not in reader_session_map:
                reader_session_map[session.reader_id] = {
                    "started": False,
                    "all_completed": True,
                    "session_count": 0
                }

            reader_session_map[session.reader_id]["session_count"] += 1

            if session.status in ("in_progress", "completed"):
                reader_session_map[session.reader_id]["started"] = True

            if session.status != "completed":
                reader_session_map[session.reader_id]["all_completed"] = False

        readers_started = sum(
            1 for data in reader_session_map.values() if data["started"]
        )
        readers_completed = sum(
            1 for data in reader_session_map.values()
            if data["all_completed"] and data["session_count"] > 0
        )

        # 전체 진행률
        overall_progress = (
            (completed_sessions / total_sessions * 100)
            if total_sessions > 0 else 0.0
        )

        return {
            "total_readers": total_readers,
            "readers_started": readers_started,
            "readers_completed": readers_completed,
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "in_progress_sessions": in_progress_sessions,
            "pending_sessions": pending_sessions,
            "overall_progress_percent": round(overall_progress, 1),
            "study_config_locked": config.is_locked
        }

    # =========================================================================
    # 리더별 진행률
    # =========================================================================

    async def get_progress_by_reader(self) -> List[dict]:
        """
        리더별 진행 현황

        Returns:
            list: 리더별 진행 데이터
        """
        # 리더 조회 (활성화된 reader만)
        readers_result = await self.db.execute(
            select(Reader)
            .options(selectinload(Reader.sessions))
            .where(and_(Reader.is_active == True, Reader.role == "reader"))
            .order_by(Reader.reader_code)
        )
        readers = readers_result.scalars().all()

        result = []
        for reader in readers:
            # 세션별 진행 상세
            sessions_data = []
            last_accessed = None
            total_completed_cases = 0
            total_cases = 0

            for session in reader.sessions:
                progress = await self._get_session_progress(session.id)
                session_data = self._build_session_detail(session, progress)
                sessions_data.append(session_data)

                total_cases += session_data["total_cases"]
                total_completed_cases += session_data["completed_cases"]

                if progress and progress.last_accessed_at:
                    if last_accessed is None or progress.last_accessed_at > last_accessed:
                        last_accessed = progress.last_accessed_at

            # 평균 판독 시간
            avg_time = await self._get_avg_reading_time(reader.id)

            # 상태 판단
            if not sessions_data:
                status = "idle"
            elif all(s["status"] == "completed" for s in sessions_data):
                status = "completed"
            elif any(s["status"] in ("in_progress", "completed") for s in sessions_data):
                status = "active"
            else:
                status = "idle"

            # 전체 진행률
            total_progress = (
                (total_completed_cases / total_cases * 100)
                if total_cases > 0 else 0.0
            )

            result.append({
                "reader_id": reader.id,
                "reader_code": reader.reader_code,
                "name": reader.name,
                "group": reader.group,
                "sessions": sessions_data,
                "total_progress_percent": round(total_progress, 1),
                "avg_reading_time_sec": avg_time,
                "last_accessed_at": last_accessed,
                "status": status
            })

        return result

    # =========================================================================
    # 그룹별 진행률
    # =========================================================================

    async def get_progress_by_group(self) -> List[dict]:
        """
        그룹별 진행 현황

        Returns:
            list: 그룹별 진행 데이터
        """
        result = []

        for group in [1, 2]:
            # 그룹 리더 조회
            readers_result = await self.db.execute(
                select(Reader).where(
                    and_(
                        Reader.is_active == True,
                        Reader.role == "reader",
                        Reader.group == group
                    )
                )
            )
            readers = readers_result.scalars().all()
            reader_ids = [r.id for r in readers]

            if not reader_ids:
                result.append({
                    "group": group,
                    "total_readers": 0,
                    "readers_started": 0,
                    "readers_completed": 0,
                    "total_sessions": 0,
                    "completed_sessions": 0,
                    "progress_percent": 0.0
                })
                continue

            # 세션 통계
            sessions_result = await self.db.execute(
                select(StudySession).where(StudySession.reader_id.in_(reader_ids))
            )
            sessions = sessions_result.scalars().all()

            total_sessions = len(sessions)
            completed_sessions = sum(1 for s in sessions if s.status == "completed")

            # 리더별 시작/완료 현황
            reader_session_map = {}
            for session in sessions:
                if session.reader_id not in reader_session_map:
                    reader_session_map[session.reader_id] = {
                        "started": False,
                        "all_completed": True,
                        "count": 0
                    }

                reader_session_map[session.reader_id]["count"] += 1

                if session.status in ("in_progress", "completed"):
                    reader_session_map[session.reader_id]["started"] = True

                if session.status != "completed":
                    reader_session_map[session.reader_id]["all_completed"] = False

            readers_started = sum(
                1 for data in reader_session_map.values() if data["started"]
            )
            readers_completed = sum(
                1 for data in reader_session_map.values()
                if data["all_completed"] and data["count"] > 0
            )

            progress_percent = (
                (completed_sessions / total_sessions * 100)
                if total_sessions > 0 else 0.0
            )

            result.append({
                "group": group,
                "total_readers": len(readers),
                "readers_started": readers_started,
                "readers_completed": readers_completed,
                "total_sessions": total_sessions,
                "completed_sessions": completed_sessions,
                "progress_percent": round(progress_percent, 1)
            })

        return result

    # =========================================================================
    # 세션별 진행률
    # =========================================================================

    async def get_progress_by_session(self) -> List[dict]:
        """
        세션 코드별 통계 (S1, S2)

        Returns:
            list: 세션별 진행 데이터
        """
        result = []

        for session_code in ["S1", "S2"]:
            sessions_result = await self.db.execute(
                select(StudySession).where(StudySession.session_code == session_code)
            )
            sessions = sessions_result.scalars().all()

            total_assigned = len(sessions)
            completed = sum(1 for s in sessions if s.status == "completed")
            in_progress = sum(1 for s in sessions if s.status == "in_progress")
            pending = total_assigned - completed - in_progress

            completion_rate = (
                (completed / total_assigned * 100)
                if total_assigned > 0 else 0.0
            )

            result.append({
                "session_code": session_code,
                "total_assigned": total_assigned,
                "completed": completed,
                "in_progress": in_progress,
                "pending": pending,
                "completion_rate": round(completion_rate, 1)
            })

        return result

    # =========================================================================
    # 유틸리티 메서드
    # =========================================================================

    async def _get_session_progress(self, session_id: int) -> Optional[SessionProgress]:
        """세션 진행 상태 조회"""
        result = await self.db.execute(
            select(SessionProgress).where(SessionProgress.session_id == session_id)
        )
        return result.scalar_one_or_none()

    def _build_session_detail(
        self,
        session: StudySession,
        progress: Optional[SessionProgress]
    ) -> dict:
        """세션 진행 상세 데이터 구성"""
        # 케이스 수 계산
        block_a_cases = json.loads(session.case_order_block_a or "[]")
        block_b_cases = json.loads(session.case_order_block_b or "[]")
        total_cases = len(block_a_cases) + len(block_b_cases)

        if progress:
            completed_cases = len(json.loads(progress.completed_cases or "[]"))
            current_block = progress.current_block
            current_case_index = progress.current_case_index
            started_at = progress.started_at
            completed_at = progress.completed_at
        else:
            completed_cases = 0
            current_block = None
            current_case_index = None
            started_at = None
            completed_at = None

        progress_percent = (
            (completed_cases / total_cases * 100)
            if total_cases > 0 else 0.0
        )

        return {
            "session_id": session.id,
            "session_code": session.session_code,
            "status": session.status,
            "block_a_mode": session.block_a_mode,
            "block_b_mode": session.block_b_mode,
            "current_block": current_block,
            "current_case_index": current_case_index,
            "total_cases": total_cases,
            "completed_cases": completed_cases,
            "progress_percent": round(progress_percent, 1),
            "started_at": started_at,
            "completed_at": completed_at
        }

    async def _get_avg_reading_time(self, reader_id: int) -> Optional[float]:
        """리더의 평균 판독 시간 계산"""
        result = await self.db.execute(
            select(func.avg(StudyResult.time_spent_sec))
            .where(StudyResult.reader_id == str(reader_id))
        )
        avg_time = result.scalar_one_or_none()
        return round(avg_time, 1) if avg_time else None
