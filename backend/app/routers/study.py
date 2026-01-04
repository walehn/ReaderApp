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
    "reader_id": "R01",
    "session_id": "S1",
    "mode": "UNAIDED",
    "case_id": "case_0001",
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

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.schemas import (
    StudySubmission,
    StudySubmissionResponse,
    SessionConfig,
    SessionState
)
from app.models.database import get_db, StudyResult, LesionMark
from app.services.session_service import session_service
from app.config import settings

router = APIRouter(prefix="/study", tags=["Study"])


@router.post("/submit", response_model=StudySubmissionResponse)
async def submit_result(
    submission: StudySubmission,
    db: AsyncSession = Depends(get_db)
) -> StudySubmissionResponse:
    """
    Reader Study 결과 제출

    Parameters:
        submission: 결과 데이터

    Returns:
        성공 여부 및 result_id
    """
    # 세션 설정 로드 및 검증
    try:
        config = session_service.load_session(
            submission.reader_id,
            submission.session_id
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Session not found: {submission.reader_id}_{submission.session_id}"
        )

    # 모드 일치 검증
    if submission.mode != config.mode:
        raise HTTPException(
            status_code=400,
            detail=f"Mode mismatch: expected {config.mode}, got {submission.mode}"
        )

    # 케이스 ID 검증
    if submission.case_id not in config.case_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Case {submission.case_id} not in session case list"
        )

    # 병변 수 검증
    if len(submission.lesions) > config.k_max:
        raise HTTPException(
            status_code=400,
            detail=f"Too many lesions: max {config.k_max}, got {len(submission.lesions)}"
        )

    # 중복 제출 확인
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

    # 결과 저장
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

    # 병변 마커 저장
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

    # 세션 진행 상황 업데이트
    session_service.update_session_progress(
        submission.reader_id,
        submission.session_id,
        submission.case_id
    )

    return StudySubmissionResponse(
        success=True,
        message=f"Result saved for {submission.case_id}",
        result_id=result.id
    )


@router.get("/session", response_model=SessionConfig)
async def get_session_config(
    reader_id: str,
    session_id: str
) -> SessionConfig:
    """
    세션 설정 조회

    Parameters:
        reader_id: Reader ID
        session_id: Session ID

    Returns:
        SessionConfig
    """
    try:
        config = session_service.load_session(reader_id, session_id)
        return config
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Session not found: {reader_id}_{session_id}"
        )


@router.get("/progress", response_model=SessionState)
async def get_session_progress(
    reader_id: str,
    session_id: str
) -> SessionState:
    """
    세션 진행 상황 조회

    Parameters:
        reader_id: Reader ID
        session_id: Session ID

    Returns:
        SessionState (현재 케이스, 완료된 케이스 목록)
    """
    try:
        state = session_service.get_session_state(reader_id, session_id)
        return state
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Session not found: {reader_id}_{session_id}"
        )
