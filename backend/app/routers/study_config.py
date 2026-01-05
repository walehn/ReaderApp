"""
============================================================================
Study Config Router - Reader Study MVP
============================================================================
역할: 전역 연구 설정 관리 API

엔드포인트:
  - GET  /study-config          현재 연구 설정 조회
  - PUT  /study-config          연구 설정 수정 (Lock 전만 핵심 필드 수정 가능)
  - POST /study-config/lock     수동 설정 잠금

인증:
  모든 엔드포인트는 관리자 권한 필요 (require_admin)

Lock 정책:
  - 첫 세션 시작 시 자동 잠금 (enter_session에서 트리거)
  - 잠기는 필드: total_sessions, total_blocks, total_groups,
                crossover_mapping, k_max, require_lesion_marking
  - 수정 가능: study_name, study_description, ai_threshold

MVP 제한:
  - 세션=2, 블록=2, 그룹=2 구조만 공식 지원
============================================================================
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
import json

from app.models.database import get_db, Reader, AuditLog
from app.models.schemas import (
    StudyConfigResponse,
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

    # MVP 제한: 2x2x2 구조만 허용
    if config_data.total_sessions is not None and config_data.total_sessions != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MVP에서는 세션 수를 2로만 설정할 수 있습니다"
        )
    if config_data.total_blocks is not None and config_data.total_blocks != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MVP에서는 블록 수를 2로만 설정할 수 있습니다"
        )
    if config_data.total_groups is not None and config_data.total_groups != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MVP에서는 그룹 수를 2로만 설정할 수 있습니다"
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
