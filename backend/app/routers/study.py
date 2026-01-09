"""
============================================================================
Study Router - Reader Study MVP
============================================================================
역할: Reader Study 결과 제출 및 세션 관리 API

엔드포인트:
  POST /study/submit - 결과 제출
  GET /study/session - 세션 설정 조회
  GET /study/progress - 진행 상황 조회

결과 제출 데이터:
  {
    "reader_id": "RAD01",      <- reader_code
    "session_id": "S1",        <- session_code
    "mode": "UNAIDED",
    "case_id": "pos_enriched_001_10667525",
    "patient_new_met_present": true,
    "lesions": [
      {"x": 123, "y": 88, "z": 45, "confidence": "probable"}
    ],
    "time_spent_sec": 95.5
  }

검증 규칙:
  - patient_new_met_present 필수
  - lesions <= k_max (기본 3)
  - UNAIDED 모드에서 AI 관련 필드 거부
============================================================================
"""

import json
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.schemas import (
    StudySubmission,
    StudySubmissionResponse
)
from app.models.database import get_db, StudyResult, LesionMark, Reader, StudySession
from app.config import settings

router = APIRouter(prefix="/study", tags=["Study"])


@router.post("/submit", response_model=StudySubmissionResponse)
async def submit_result(
    submission: StudySubmission,
    db: AsyncSession = Depends(get_db)
) -> StudySubmissionResponse:
    """
    Reader Study 결과 제출 (DB 기반)

    Parameters:
        submission: 결과 데이터
          - reader_id: reader_code (예: "RAD01")
          - session_id: session_code (예: "S1")

    Returns:
        성공 여부 및 result_id
    """
    # 1. Reader 조회 (reader_code로)
    reader_result = await db.execute(
        select(Reader).where(Reader.reader_code == submission.reader_id)
    )
    reader = reader_result.scalar_one_or_none()

    if reader is None:
        raise HTTPException(
            status_code=404,
            detail=f"Reader not found: {submission.reader_id}"
        )

    # 2. Session 조회 (reader_id + session_code로)
    session_result = await db.execute(
        select(StudySession)
        .options(selectinload(StudySession.progress))
        .where(
            StudySession.reader_id == reader.id,
            StudySession.session_code == submission.session_id
        )
    )
    session = session_result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session not found: {submission.reader_id}_{submission.session_id}"
        )

    # 3. 현재 블록의 모드 확인
    progress = session.progress
    if progress is None:
        raise HTTPException(
            status_code=400,
            detail="Session has not been started"
        )

    current_block = progress.current_block
    if current_block == "A":
        expected_mode = session.block_a_mode
    else:
        expected_mode = session.block_b_mode

    # 모드 일치 검증
    if submission.mode != expected_mode:
        raise HTTPException(
            status_code=400,
            detail=f"Mode mismatch: expected {expected_mode}, got {submission.mode}"
        )

    # 4. 케이스 ID가 현재 블록에 포함되는지 검증
    if current_block == "A":
        case_order = json.loads(session.case_order_block_a) if session.case_order_block_a else []
    else:
        case_order = json.loads(session.case_order_block_b) if session.case_order_block_b else []

    if submission.case_id not in case_order:
        raise HTTPException(
            status_code=400,
            detail=f"Case {submission.case_id} not in current block case list"
        )

    # 5. 병변 수 검증
    k_max = settings.MAX_LESIONS
    if len(submission.lesions) > k_max:
        raise HTTPException(
            status_code=400,
            detail=f"Too many lesions: max {k_max}, got {len(submission.lesions)}"
        )

    # 6. 중복 제출 확인
    existing = await db.execute(
        select(StudyResult).where(
            StudyResult.reader_id == submission.reader_id,
            StudyResult.session_id == submission.session_id,
            StudyResult.case_id == submission.case_id
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Result already submitted for {submission.case_id}"
        )

    # 7. 결과 저장
    result = StudyResult(
        reader_id=submission.reader_id,
        session_id=submission.session_id,
        mode=submission.mode,
        case_id=submission.case_id,
        patient_decision=submission.patient_new_met_present,
        time_spent_sec=submission.time_spent_sec
    )
    db.add(result)
    await db.flush()  # ID 획득

    # 8. 병변 마커 저장
    for i, lesion in enumerate(submission.lesions):
        mark = LesionMark(
            result_id=result.id,
            x=lesion.x,
            y=lesion.y,
            z=lesion.z,
            confidence=lesion.confidence,
            mark_order=i + 1
        )
        db.add(mark)

    await db.commit()

    # 세션 진행 상황은 /sessions/{id}/advance API에서 처리

    return StudySubmissionResponse(
        success=True,
        message=f"Result saved for {submission.case_id}",
        result_id=result.id
    )


@router.get("/session")
async def get_session_config(
    reader_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    세션 설정 조회 (DB 기반)

    Parameters:
        reader_id: reader_code (예: "RAD01")
        session_id: session_code (예: "S1")

    Returns:
        SessionConfig 형식의 데이터
    """
    # Reader 조회
    reader_result = await db.execute(
        select(Reader).where(Reader.reader_code == reader_id)
    )
    reader = reader_result.scalar_one_or_none()

    if reader is None:
        raise HTTPException(
            status_code=404,
            detail=f"Reader not found: {reader_id}"
        )

    # Session 조회
    session_result = await db.execute(
        select(StudySession)
        .options(selectinload(StudySession.progress))
        .where(
            StudySession.reader_id == reader.id,
            StudySession.session_code == session_id
        )
    )
    session = session_result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session not found: {reader_id}_{session_id}"
        )

    # SessionConfig 형식으로 반환
    return {
        "reader_id": reader_id,
        "session_id": session_id,
        "mode": session.block_a_mode if session.progress and session.progress.current_block == "A" else session.block_b_mode,
        "case_order": json.loads(session.case_order_block_a) if session.progress and session.progress.current_block == "A" else json.loads(session.case_order_block_b) if session.case_order_block_b else []
    }


@router.get("/progress")
async def get_session_progress(
    reader_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    세션 진행 상황 조회 (DB 기반)

    Parameters:
        reader_id: reader_code (예: "RAD01")
        session_id: session_code (예: "S1")

    Returns:
        SessionState (현재 케이스, 완료된 케이스 목록)
    """
    # Reader 조회
    reader_result = await db.execute(
        select(Reader).where(Reader.reader_code == reader_id)
    )
    reader = reader_result.scalar_one_or_none()

    if reader is None:
        raise HTTPException(
            status_code=404,
            detail=f"Reader not found: {reader_id}"
        )

    # Session 조회
    session_result = await db.execute(
        select(StudySession)
        .options(selectinload(StudySession.progress))
        .where(
            StudySession.reader_id == reader.id,
            StudySession.session_code == session_id
        )
    )
    session = session_result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session not found: {reader_id}_{session_id}"
        )

    progress = session.progress
    if progress is None:
        raise HTTPException(
            status_code=400,
            detail="Session has not been started"
        )

    # 현재 블록의 케이스 목록
    if progress.current_block == "A":
        case_order = json.loads(session.case_order_block_a) if session.case_order_block_a else []
    else:
        case_order = json.loads(session.case_order_block_b) if session.case_order_block_b else []

    # 완료된 케이스 목록 (StudyResult에서 조회)
    completed_result = await db.execute(
        select(StudyResult.case_id).where(
            StudyResult.reader_id == reader_id,
            StudyResult.session_id == session_id
        )
    )
    completed_cases = [row[0] for row in completed_result.fetchall()]

    # 현재 케이스 인덱스 계산
    current_case_index = progress.current_case_index

    return {
        "current_case": case_order[current_case_index] if current_case_index < len(case_order) else None,
        "current_index": current_case_index,
        "total_cases": len(case_order),
        "completed_cases": completed_cases,
        "current_block": progress.current_block
    }
