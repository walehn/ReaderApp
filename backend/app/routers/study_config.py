"""
============================================================================
Study Config Router - Reader Study
============================================================================
역할: 전역 연구 설정 관리 API

엔드포인트:
  - GET  /study-config          현재 연구 설정 조회 (관리자 전용)
  - PUT  /study-config          연구 설정 수정 (Lock 전만 핵심 필드 수정 가능)
  - POST /study-config/lock     수동 설정 잠금
  - GET  /study-config/public   공개 설정 조회 (인증 불필요, 세션/블록 수만)

인증:
  - /study-config/public 제외 모든 엔드포인트는 관리자 권한 필요

Lock 정책:
  - 첫 세션 시작 시 자동 잠금 (enter_session에서 트리거)
  - 잠기는 필드: total_sessions, total_blocks, total_groups,
                crossover_mapping, k_max, require_lesion_marking
  - 수정 가능: study_name, study_description, ai_threshold

설정 범위:
  - 세션: 1-20, 블록: 1-4, 그룹: 1-10
============================================================================
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
import json

from app.models.database import get_db, Reader, AuditLog
from app.models.schemas import (
    StudyConfigResponse,
    StudyConfigPublicResponse,
    StudyConfigUpdateRequest,
    MessageResponse
)
from app.services.study_config_service import StudyConfigService
from app.core.dependencies import require_admin
from app.core.security import utc_now


router = APIRouter(prefix="/study-config", tags=["Study Config"])


# =============================================================================
# 연구 설정 조회
# =============================================================================

@router.get("", response_model=StudyConfigResponse)
async def get_study_config(
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> StudyConfigResponse:
    """
    현재 연구 설정 조회

    Returns:
        StudyConfigResponse: 현재 연구 설정
    """
    service = StudyConfigService(db)
    config_dict = await service.get_config_dict()

    return StudyConfigResponse(**config_dict)


# =============================================================================
# 연구 설정 수정
# =============================================================================

@router.put("", response_model=StudyConfigResponse)
async def update_study_config(
    request: Request,
    config_data: StudyConfigUpdateRequest,
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> StudyConfigResponse:
    """
    연구 설정 수정

    Lock 전: 모든 필드 수정 가능
    Lock 후: study_name, study_description, ai_threshold만 수정 가능

    Args:
        config_data: 수정할 설정 데이터

    Returns:
        StudyConfigResponse: 수정된 연구 설정

    Raises:
        400: Lock된 필드 수정 시도 시
    """
    service = StudyConfigService(db)

    # 범위 검증: 세션 1-20, 블록 1-4, 그룹 1-10
    if config_data.total_sessions is not None:
        if config_data.total_sessions < 1 or config_data.total_sessions > 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="세션 수는 1-20 사이여야 합니다"
            )
    if config_data.total_blocks is not None:
        if config_data.total_blocks < 1 or config_data.total_blocks > 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="블록 수는 1-4 사이여야 합니다"
            )
    if config_data.total_groups is not None:
        if config_data.total_groups < 1 or config_data.total_groups > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="그룹 수는 1-10 사이여야 합니다"
            )

    # 설정 수정
    update_data = config_data.model_dump(exclude_unset=True)
    updated_config = await service.update_config(update_data)

    # 감사 로그
    audit_log = AuditLog(
        reader_id=admin.id,
        action="CONFIG_UPDATE",
        resource_type="study_config",
        resource_id="1",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=json.dumps({
            "updated_fields": list(update_data.keys())
        })
    )
    db.add(audit_log)
    await db.commit()

    config_dict = service._config_to_dict(updated_config)
    return StudyConfigResponse(**config_dict)


# =============================================================================
# 수동 잠금
# =============================================================================

@router.post("/lock", response_model=MessageResponse)
async def lock_study_config(
    request: Request,
    admin: Reader = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    """
    연구 설정 수동 잠금

    Note:
        일반적으로 첫 세션 시작 시 자동 잠금됨.
        이 엔드포인트는 테스트/디버깅 용도로 제공.

    Returns:
        MessageResponse: 잠금 결과 메시지

    Raises:
        400: 이미 잠겨있는 경우
    """
    service = StudyConfigService(db)

    was_locked = await service.manual_lock(admin.id)

    if not was_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="설정이 이미 잠겨있습니다"
        )

    return MessageResponse(
        message="연구 설정이 잠겼습니다. 핵심 설정은 더 이상 변경할 수 없습니다."
    )


# =============================================================================
# 공개 연구 설정 조회 (인증 불필요)
# =============================================================================

@router.get("/public", response_model=StudyConfigPublicResponse)
async def get_public_study_config(
    db: AsyncSession = Depends(get_db)
) -> StudyConfigPublicResponse:
    """
    공개 연구 설정 조회 (인증 불필요)

    ViewerPage에서 세션/블록 수를 조회하여 케이스 할당에 사용.
    민감한 정보 없이 최소한의 설정만 반환.

    Returns:
        StudyConfigPublicResponse: 공개 연구 설정 (세션 수, 블록 수, 연구명)
    """
    service = StudyConfigService(db)
    config = await service.get_or_create_config()

    return StudyConfigPublicResponse(
        total_sessions=config.total_sessions,
        total_blocks=config.total_blocks,
        study_name=config.study_name
    )
