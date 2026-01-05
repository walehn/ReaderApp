"""
============================================================================
Study Session Service - Reader Study MVP (Phase 3)
============================================================================
역할: DB 기반 세션 관리 및 Crossover 디자인 지원

주요 기능:
  - get_reader_sessions(): 리더의 모든 세션 목록 조회
  - enter_session(): 세션 진입 (최초 진입 시 랜덤 순서 생성)
  - get_current_case(): 현재 케이스 정보 조회
  - submit_case(): 케이스 완료 처리 및 다음 케이스로 이동
  - get_session_summary(): 세션 요약 정보 (대시보드용)

Crossover 디자인:
  Group 1, Session 1: Block A=UNAIDED, Block B=AIDED
  Group 1, Session 2: Block A=AIDED, Block B=UNAIDED
  Group 2, Session 1: Block A=AIDED, Block B=UNAIDED
  Group 2, Session 2: Block A=UNAIDED, Block B=AIDED

케이스 순서:
  - 세션 최초 진입 시 Block별 케이스 목록을 랜덤 셔플
  - JSON 배열로 DB에 저장하여 재접속 시 동일 순서 유지

사용 예시:
  from app.services.study_session_service import StudySessionService

  service = StudySessionService(db)
  sessions = await service.get_reader_sessions(reader_id=1)
  enter_result = await service.enter_session(session_id=1)
============================================================================
"""

import json
import random
from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import Reader, StudySession, SessionProgress, AuditLog


# =============================================================================
# Block/Group 매핑 상수
# =============================================================================

# Crossover 디자인: (group, session_code) -> (block_a_mode, block_b_mode)
CROSSOVER_MAPPING = {
    (1, "S1"): ("UNAIDED", "AIDED"),
    (1, "S2"): ("AIDED", "UNAIDED"),
    (2, "S1"): ("AIDED", "UNAIDED"),
    (2, "S2"): ("UNAIDED", "AIDED"),
}


class StudySessionService:
    """
    DB 기반 세션 관리 서비스

    세션 생성, 진입, 진행 상태 관리를 담당합니다.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # =========================================================================
    # 세션 조회
    # =========================================================================

    async def get_reader_sessions(self, reader_id: int) -> List[dict]:
        """
        리더의 모든 세션 목록 조회 (대시보드용)

        Args:
            reader_id: 리더 ID

        Returns:
            세션 요약 목록
        """
        result = await self.db.execute(
            select(StudySession)
            .options(selectinload(StudySession.progress))
            .where(StudySession.reader_id == reader_id)
            .order_by(StudySession.session_code)
        )
        sessions = result.scalars().all()

        summaries = []
        for session in sessions:
            progress = session.progress
            total_cases = self._count_total_cases(session)

            if progress:
                completed_a = len(json.loads(progress.completed_cases or "[]"))
                # Block B 완료 여부는 current_block으로 판단
                if progress.current_block == "B":
                    completed_b = completed_a - self._count_block_cases(session, "A")
                    completed_b = max(0, completed_b)
                else:
                    completed_b = 0
                completed_count = completed_a
                progress_percent = (completed_count / total_cases * 100) if total_cases > 0 else 0
            else:
                completed_count = 0
                progress_percent = 0

            summaries.append({
                "session_id": session.id,
                "session_code": session.session_code,
                "status": session.status,
                "block_a_mode": session.block_a_mode,
                "block_b_mode": session.block_b_mode,
                "progress_percent": round(progress_percent, 1),
                "current_block": progress.current_block if progress else None,
                "current_case_index": progress.current_case_index if progress else None,
                "total_cases": total_cases,
                "last_accessed_at": progress.last_accessed_at if progress else None,
            })

        return summaries

    async def get_session_by_id(self, session_id: int) -> Optional[StudySession]:
        """세션 ID로 조회"""
        result = await self.db.execute(
            select(StudySession)
            .options(selectinload(StudySession.progress))
            .where(StudySession.id == session_id)
        )
        return result.scalar_one_or_none()

    # =========================================================================
    # 세션 진입
    # =========================================================================

    async def enter_session(
        self,
        session_id: int,
        reader_id: int,
        block_a_cases: List[str],
        block_b_cases: List[str]
    ) -> dict:
        """
        세션 진입

        최초 진입 시 케이스 순서를 랜덤 생성하고 DB에 저장합니다.
        재진입 시 저장된 순서를 사용합니다.

        Args:
            session_id: 세션 ID
            reader_id: 리더 ID (권한 검증용)
            block_a_cases: Block A 케이스 ID 목록 (최초 진입 시 필요)
            block_b_cases: Block B 케이스 ID 목록 (최초 진입 시 필요)

        Returns:
            세션 진입 정보
        """
        session = await self.get_session_by_id(session_id)
        if session is None:
            raise ValueError("세션을 찾을 수 없습니다")

        if session.reader_id != reader_id:
            raise PermissionError("본인의 세션만 접근할 수 있습니다")

        if session.status == "completed":
            raise ValueError("이미 완료된 세션입니다")

        is_new_session = False

        # 최초 진입: 케이스 순서 생성 및 진행 상태 초기화
        if session.case_order_block_a is None:
            is_new_session = True

            # 케이스 순서 랜덤 셔플
            shuffled_a = block_a_cases.copy()
            shuffled_b = block_b_cases.copy()
            random.shuffle(shuffled_a)
            random.shuffle(shuffled_b)

            session.case_order_block_a = json.dumps(shuffled_a)
            session.case_order_block_b = json.dumps(shuffled_b)
            session.status = "in_progress"

            # 진행 상태 생성
            new_progress = SessionProgress(
                session_id=session.id,
                current_block="A",
                current_case_index=0,
                completed_cases="[]",
                started_at=datetime.utcnow(),
                last_accessed_at=datetime.utcnow()
            )
            self.db.add(new_progress)
            await self.db.commit()
            await self.db.refresh(new_progress)

            # 진행 상태 직접 사용
            progress = new_progress
            current_block = "A"
            current_index = 0
        else:
            # 재진입: 마지막 접속 시간 업데이트
            progress = session.progress
            if progress:
                progress.last_accessed_at = datetime.utcnow()
                await self.db.commit()
                current_block = progress.current_block
                current_index = progress.current_case_index
            else:
                raise ValueError("세션 진행 상태를 찾을 수 없습니다")

        if current_block == "A":
            case_order = json.loads(session.case_order_block_a)
            current_mode = session.block_a_mode
        else:
            case_order = json.loads(session.case_order_block_b)
            current_mode = session.block_b_mode

        current_case_id = case_order[current_index] if current_index < len(case_order) else None

        return {
            "session_id": session.id,
            "session_code": session.session_code,
            "current_block": current_block,
            "current_mode": current_mode,
            "current_case_id": current_case_id,
            "current_case_index": current_index,
            "total_cases_in_block": len(case_order),
            "k_max": session.k_max,
            "ai_threshold": session.ai_threshold,
            "is_new_session": is_new_session,
        }

    # =========================================================================
    # 케이스 진행
    # =========================================================================

    async def get_current_case(self, session_id: int, reader_id: int) -> dict:
        """
        현재 케이스 정보 조회

        Args:
            session_id: 세션 ID
            reader_id: 리더 ID

        Returns:
            현재 케이스 정보
        """
        session = await self.get_session_by_id(session_id)
        if session is None:
            raise ValueError("세션을 찾을 수 없습니다")

        if session.reader_id != reader_id:
            raise PermissionError("본인의 세션만 접근할 수 있습니다")

        if session.status == "completed":
            return {
                "session_code": session.session_code,
                "is_session_complete": True,
                "block": None,
                "mode": None,
                "case_id": None,
                "case_index": None,
                "total_cases_in_block": 0,
                "is_last_in_block": True,
            }

        progress = session.progress
        if progress is None:
            raise ValueError("세션이 시작되지 않았습니다")

        current_block = progress.current_block
        current_index = progress.current_case_index

        if current_block == "A":
            case_order = json.loads(session.case_order_block_a)
            current_mode = session.block_a_mode
        else:
            case_order = json.loads(session.case_order_block_b)
            current_mode = session.block_b_mode

        total_in_block = len(case_order)
        is_last_in_block = current_index >= total_in_block - 1

        # Block A 끝나고 Block B로 넘어가야 하는지, 또는 세션 완료인지
        is_session_complete = (current_block == "B" and is_last_in_block and
                               current_index >= total_in_block)

        current_case_id = case_order[current_index] if current_index < total_in_block else None

        return {
            "session_code": session.session_code,
            "block": current_block,
            "mode": current_mode,
            "case_id": current_case_id,
            "case_index": current_index,
            "total_cases_in_block": total_in_block,
            "is_last_in_block": is_last_in_block,
            "is_session_complete": is_session_complete,
        }

    async def advance_to_next_case(
        self,
        session_id: int,
        reader_id: int,
        completed_case_id: str
    ) -> dict:
        """
        다음 케이스로 이동

        현재 케이스를 완료 처리하고 다음 케이스로 이동합니다.
        Block A 완료 시 Block B로 전환합니다.
        Block B 완료 시 세션을 완료 처리합니다.

        Args:
            session_id: 세션 ID
            reader_id: 리더 ID
            completed_case_id: 완료된 케이스 ID

        Returns:
            다음 케이스 정보 또는 완료 상태
        """
        session = await self.get_session_by_id(session_id)
        if session is None:
            raise ValueError("세션을 찾을 수 없습니다")

        if session.reader_id != reader_id:
            raise PermissionError("본인의 세션만 접근할 수 있습니다")

        if session.status == "completed":
            raise ValueError("이미 완료된 세션입니다")

        progress = session.progress
        if progress is None:
            raise ValueError("세션이 시작되지 않았습니다")

        # 완료된 케이스 기록
        completed_cases = json.loads(progress.completed_cases)
        if completed_case_id not in completed_cases:
            completed_cases.append(completed_case_id)
            progress.completed_cases = json.dumps(completed_cases)

        current_block = progress.current_block
        current_index = progress.current_case_index

        if current_block == "A":
            case_order = json.loads(session.case_order_block_a)
        else:
            case_order = json.loads(session.case_order_block_b)

        total_in_block = len(case_order)

        # 다음 케이스로 이동
        next_index = current_index + 1

        if next_index >= total_in_block:
            # 현재 블록 완료
            if current_block == "A":
                # Block B로 전환
                progress.current_block = "B"
                progress.current_case_index = 0
                block_transition = "A_TO_B"
            else:
                # 세션 완료
                session.status = "completed"
                progress.completed_at = datetime.utcnow()
                block_transition = "COMPLETED"
        else:
            # 같은 블록 내 다음 케이스
            progress.current_case_index = next_index
            block_transition = None

        progress.last_accessed_at = datetime.utcnow()
        await self.db.commit()

        # 결과 반환
        return await self.get_current_case(session_id, reader_id)

    # =========================================================================
    # 세션 생성 (관리자용)
    # =========================================================================

    async def create_session_for_reader(
        self,
        reader_id: int,
        session_code: str,
        k_max: int = 3,
        ai_threshold: float = 0.30
    ) -> StudySession:
        """
        리더에게 세션 할당 (관리자용)

        리더의 그룹에 따라 Block/Mode 매핑을 자동 결정합니다.

        Args:
            reader_id: 리더 ID
            session_code: 세션 코드 (S1 또는 S2)
            k_max: 최대 병변 마커 수
            ai_threshold: AI 확률 임계값

        Returns:
            생성된 세션
        """
        # 리더 조회
        result = await self.db.execute(
            select(Reader).where(Reader.id == reader_id)
        )
        reader = result.scalar_one_or_none()

        if reader is None:
            raise ValueError("리더를 찾을 수 없습니다")

        if reader.group is None:
            raise ValueError("리더의 그룹이 설정되지 않았습니다")

        # Crossover 매핑에서 Block/Mode 결정
        mapping_key = (reader.group, session_code)
        if mapping_key not in CROSSOVER_MAPPING:
            raise ValueError(f"잘못된 그룹/세션 조합: {mapping_key}")

        block_a_mode, block_b_mode = CROSSOVER_MAPPING[mapping_key]

        # 중복 확인
        existing = await self.db.execute(
            select(StudySession).where(
                and_(
                    StudySession.reader_id == reader_id,
                    StudySession.session_code == session_code
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"세션 {session_code}이 이미 존재합니다")

        # 세션 생성
        session = StudySession(
            session_code=session_code,
            reader_id=reader_id,
            block_a_mode=block_a_mode,
            block_b_mode=block_b_mode,
            k_max=k_max,
            ai_threshold=ai_threshold,
            status="pending"
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)

        return session

    # =========================================================================
    # 유틸리티
    # =========================================================================

    def _count_total_cases(self, session: StudySession) -> int:
        """세션의 총 케이스 수 계산"""
        count_a = len(json.loads(session.case_order_block_a or "[]"))
        count_b = len(json.loads(session.case_order_block_b or "[]"))
        return count_a + count_b

    def _count_block_cases(self, session: StudySession, block: str) -> int:
        """특정 블록의 케이스 수 계산"""
        if block == "A":
            return len(json.loads(session.case_order_block_a or "[]"))
        else:
            return len(json.loads(session.case_order_block_b or "[]"))

    async def is_aided_mode(self, session_id: int, reader_id: int) -> bool:
        """현재 모드가 AIDED인지 확인"""
        try:
            case_info = await self.get_current_case(session_id, reader_id)
            return case_info.get("mode") == "AIDED"
        except (ValueError, PermissionError):
            return False

    async def reset_session(self, session_id: int) -> None:
        """
        세션 초기화 (관리자용)

        진행 상태를 초기화하고 케이스 순서를 재생성할 수 있도록 합니다.
        """
        session = await self.get_session_by_id(session_id)
        if session is None:
            raise ValueError("세션을 찾을 수 없습니다")

        # 케이스 순서 초기화
        session.case_order_block_a = None
        session.case_order_block_b = None
        session.status = "pending"

        # 진행 상태 삭제
        if session.progress:
            await self.db.delete(session.progress)

        await self.db.commit()
