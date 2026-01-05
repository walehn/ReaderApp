"""
============================================================================
Study Config Service - Reader Study MVP
============================================================================
역할: 전역 연구 설정 관리 및 Lock 정책 구현

주요 기능:
  - get_or_create_config(): Singleton 패턴으로 설정 조회/생성
  - update_config(): 설정 수정 (Lock 검증 포함)
  - trigger_lock_if_needed(): 첫 세션 시작 시 자동 잠금
  - generate_crossover_mapping(): Crossover 매핑 생성

Lock 정책:
  - 잠기는 필드: total_sessions, total_blocks, total_groups,
                crossover_mapping, k_max, require_lesion_marking
  - 수정 가능: study_name, study_description, ai_threshold, group_names

동시성 제어:
  - SQLite: BEGIN IMMEDIATE 트랜잭션으로 원자성 보장
  - PostgreSQL: SELECT ... FOR UPDATE 지원

사용 예시:
  from app.services.study_config_service import StudyConfigService

  service = StudyConfigService(db)
  config = await service.get_or_create_config()
  was_locked = await service.trigger_lock_if_needed(reader_id=1)
============================================================================
"""

import json
from typing import Optional, List, Any
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.database import StudyConfig, AuditLog, DEFAULT_CROSSOVER_MAPPING, DEFAULT_GROUP_NAMES
from app.core.security import utc_now


# Lock 후 수정 불가 필드 목록
LOCKED_FIELDS = [
    'total_sessions',
    'total_blocks',
    'total_groups',
    'crossover_mapping',
    'k_max',
    'require_lesion_marking',
]

# Lock 후에도 수정 가능한 필드 목록
UNLOCKED_FIELDS = [
    'study_name',
    'study_description',
    'ai_threshold',
    'confidence_mode',
    'case_order_mode',
    'random_seed',
    'group_names',  # 그룹명은 표시용이므로 Lock 후에도 수정 가능
]


class StudyConfigService:
    """
    전역 연구 설정 관리 서비스

    Singleton 패턴: study_config 테이블은 항상 1행만 존재
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # =========================================================================
    # 설정 조회/생성
    # =========================================================================

    async def get_or_create_config(self) -> StudyConfig:
        """
        연구 설정 조회 (없으면 기본값으로 생성)

        Returns:
            StudyConfig: 현재 연구 설정
        """
        result = await self.db.execute(
            select(StudyConfig).where(StudyConfig.id == 1)
        )
        config = result.scalar_one_or_none()

        if config is None:
            # 기본 설정 생성
            config = StudyConfig(
                id=1,
                crossover_mapping=self._canonical_json(
                    json.loads(DEFAULT_CROSSOVER_MAPPING)
                )
            )
            self.db.add(config)
            await self.db.commit()
            await self.db.refresh(config)

        return config

    async def get_config_dict(self) -> dict:
        """
        연구 설정을 딕셔너리로 반환 (API 응답용)

        Returns:
            dict: 설정 데이터 (crossover_mapping은 파싱됨)
        """
        config = await self.get_or_create_config()
        return self._config_to_dict(config)

    # =========================================================================
    # 설정 수정
    # =========================================================================

    async def update_config(self, data: dict) -> StudyConfig:
        """
        연구 설정 수정 (Lock 검증 포함)

        Args:
            data: 수정할 필드와 값

        Returns:
            StudyConfig: 수정된 설정

        Raises:
            HTTPException: Lock된 필드 수정 시도 시 400 에러
        """
        # SQLite 동시성 제어: BEGIN IMMEDIATE
        await self.db.execute(text("BEGIN IMMEDIATE"))

        try:
            config = await self._get_config_locked()

            # Lock 검증
            if config.is_locked:
                errors = self._validate_locked_fields(data)
                if errors:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=errors[0]
                    )

            # crossover_mapping JSON 검증 및 정규화
            if 'crossover_mapping' in data and data['crossover_mapping'] is not None:
                try:
                    validated_mapping = self._validate_crossover_mapping(
                        data['crossover_mapping']
                    )
                    data['crossover_mapping'] = self._canonical_json(validated_mapping)
                except ValueError as e:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"잘못된 Crossover 매핑: {str(e)}"
                    )

            # group_names JSON 검증 및 정규화
            if 'group_names' in data and data['group_names'] is not None:
                try:
                    # 현재 crossover_mapping 로드 (검증용)
                    current_mapping = json.loads(config.crossover_mapping)
                    validated_names = self._validate_group_names(
                        data['group_names'],
                        current_mapping
                    )
                    data['group_names'] = self._canonical_json(validated_names)
                except ValueError as e:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"잘못된 그룹명: {str(e)}"
                    )

            # 필드 업데이트
            for key, value in data.items():
                if hasattr(config, key) and value is not None:
                    setattr(config, key, value)

            config.updated_at = utc_now()
            await self.db.commit()
            await self.db.refresh(config)

            return config

        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"설정 업데이트 실패: {str(e)}"
            )

    # =========================================================================
    # Lock 관리
    # =========================================================================

    async def trigger_lock_if_needed(self, reader_id: int) -> bool:
        """
        첫 세션 시작 시 설정 자동 잠금 (원자적 실행)

        Args:
            reader_id: Lock을 유발한 리더 ID

        Returns:
            bool: True면 새로 잠금, False면 이미 잠김

        Note:
            SQLite BEGIN IMMEDIATE로 동시성 제어
        """
        # SQLite 동시성 제어: BEGIN IMMEDIATE
        await self.db.execute(text("BEGIN IMMEDIATE"))

        try:
            config = await self._get_config_locked()

            if config.is_locked:
                await self.db.rollback()
                return False

            # Lock 설정
            config.is_locked = True
            config.locked_at = utc_now()
            config.locked_by = reader_id

            # 감사 로그
            audit_log = AuditLog(
                reader_id=reader_id,
                action="CONFIG_AUTO_LOCKED",
                resource_type="study_config",
                resource_id="1",
                details=json.dumps({
                    "reason": "first_session_started",
                    "locked_fields": LOCKED_FIELDS
                })
            )
            self.db.add(audit_log)

            await self.db.commit()
            return True

        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Lock 설정 실패: {str(e)}"
            )

    async def manual_lock(self, admin_id: int) -> bool:
        """
        관리자에 의한 수동 잠금

        Args:
            admin_id: 잠금을 실행한 관리자 ID

        Returns:
            bool: True면 새로 잠금, False면 이미 잠김
        """
        await self.db.execute(text("BEGIN IMMEDIATE"))

        try:
            config = await self._get_config_locked()

            if config.is_locked:
                await self.db.rollback()
                return False

            config.is_locked = True
            config.locked_at = utc_now()
            config.locked_by = admin_id

            # 감사 로그
            audit_log = AuditLog(
                reader_id=admin_id,
                action="CONFIG_MANUAL_LOCKED",
                resource_type="study_config",
                resource_id="1",
                details=json.dumps({"reason": "manual_lock_by_admin"})
            )
            self.db.add(audit_log)

            await self.db.commit()
            return True

        except Exception as e:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"수동 잠금 실패: {str(e)}"
            )

    # =========================================================================
    # Crossover 매핑
    # =========================================================================

    def generate_default_crossover_mapping(
        self,
        total_sessions: int = 2,
        total_blocks: int = 2,
        total_groups: int = 2
    ) -> dict:
        """
        기본 2x2x2 Crossover 매핑 생성

        MVP에서는 2x2x2 구조만 지원

        Returns:
            dict: Crossover 매핑 딕셔너리
        """
        if total_sessions != 2 or total_blocks != 2 or total_groups != 2:
            raise ValueError("MVP에서는 세션=2, 블록=2, 그룹=2 구조만 지원합니다")

        return {
            "group_1": {
                "S1": {"block_A": "UNAIDED", "block_B": "AIDED"},
                "S2": {"block_A": "AIDED", "block_B": "UNAIDED"}
            },
            "group_2": {
                "S1": {"block_A": "AIDED", "block_B": "UNAIDED"},
                "S2": {"block_A": "UNAIDED", "block_B": "AIDED"}
            }
        }

    def get_block_modes(self, group: int, session_code: str) -> tuple:
        """
        그룹과 세션 코드로 Block A/B 모드 조회

        Args:
            group: 리더 그룹 (1 또는 2)
            session_code: 세션 코드 (S1 또는 S2)

        Returns:
            tuple: (block_a_mode, block_b_mode)
        """
        mapping = json.loads(DEFAULT_CROSSOVER_MAPPING)
        group_key = f"group_{group}"
        session_mapping = mapping.get(group_key, {}).get(session_code, {})

        return (
            session_mapping.get("block_A", "UNAIDED"),
            session_mapping.get("block_B", "AIDED")
        )

    async def get_block_modes_from_config(
        self,
        group: int,
        session_code: str
    ) -> tuple:
        """
        DB에 저장된 설정에서 Block 모드 조회

        Args:
            group: 리더 그룹 (1 또는 2)
            session_code: 세션 코드 (S1 또는 S2)

        Returns:
            tuple: (block_a_mode, block_b_mode)
        """
        config = await self.get_or_create_config()
        mapping = json.loads(config.crossover_mapping)
        group_key = f"group_{group}"
        session_mapping = mapping.get(group_key, {}).get(session_code, {})

        return (
            session_mapping.get("block_A", "UNAIDED"),
            session_mapping.get("block_B", "AIDED")
        )

    # =========================================================================
    # 유틸리티 메서드
    # =========================================================================

    async def _get_config_locked(self) -> StudyConfig:
        """
        트랜잭션 내에서 설정 조회 (없으면 생성)

        Note:
            BEGIN IMMEDIATE 트랜잭션 내에서만 호출해야 함
        """
        result = await self.db.execute(
            select(StudyConfig).where(StudyConfig.id == 1)
        )
        config = result.scalar_one_or_none()

        if config is None:
            config = StudyConfig(
                id=1,
                crossover_mapping=self._canonical_json(
                    json.loads(DEFAULT_CROSSOVER_MAPPING)
                )
            )
            self.db.add(config)
            await self.db.flush()

        return config

    def _validate_locked_fields(self, data: dict) -> List[str]:
        """
        Lock된 필드 수정 시도 검증

        Returns:
            list: 에러 메시지 목록
        """
        errors = []
        for field in LOCKED_FIELDS:
            if field in data and data[field] is not None:
                errors.append(
                    f"'{field}'은(는) 설정이 잠긴 후 수정할 수 없습니다"
                )
        return errors

    def _validate_crossover_mapping(self, mapping: Any) -> dict:
        """
        Crossover 매핑 구조 검증

        Args:
            mapping: 검증할 매핑 데이터

        Returns:
            dict: 검증된 매핑

        Raises:
            ValueError: 구조가 올바르지 않을 때
        """
        if not isinstance(mapping, dict):
            raise ValueError("매핑은 딕셔너리여야 합니다")

        required_groups = ["group_1", "group_2"]
        required_sessions = ["S1", "S2"]
        required_blocks = ["block_A", "block_B"]
        valid_modes = ["UNAIDED", "AIDED"]

        for group in required_groups:
            if group not in mapping:
                raise ValueError(f"'{group}'이(가) 누락되었습니다")

            for session in required_sessions:
                if session not in mapping[group]:
                    raise ValueError(f"'{group}.{session}'이(가) 누락되었습니다")

                for block in required_blocks:
                    if block not in mapping[group][session]:
                        raise ValueError(
                            f"'{group}.{session}.{block}'이(가) 누락되었습니다"
                        )

                    mode = mapping[group][session][block]
                    if mode not in valid_modes:
                        raise ValueError(
                            f"'{group}.{session}.{block}'의 값 '{mode}'이(가) "
                            f"유효하지 않습니다. 허용값: {valid_modes}"
                        )

        return mapping

    def _validate_group_names(self, group_names: Any, crossover_mapping: dict) -> dict:
        """
        그룹명 검증: crossover_mapping의 그룹 키와 일치해야 함

        Args:
            group_names: 검증할 그룹명 데이터
            crossover_mapping: 현재 Crossover 매핑

        Returns:
            dict: 검증된 그룹명

        Raises:
            ValueError: 구조가 올바르지 않을 때
        """
        if not isinstance(group_names, dict):
            raise ValueError("group_names는 딕셔너리여야 합니다")

        expected_keys = set(crossover_mapping.keys())
        provided_keys = set(group_names.keys())

        if expected_keys != provided_keys:
            raise ValueError(
                f"group_names 키가 crossover_mapping 그룹과 일치해야 합니다: {expected_keys}"
            )

        for key, value in group_names.items():
            if not isinstance(value, str):
                raise ValueError(f"'{key}'의 그룹명은 문자열이어야 합니다")
            if len(value.strip()) == 0:
                raise ValueError(f"'{key}'의 그룹명은 비어있을 수 없습니다")
            if len(value) > 50:
                raise ValueError(f"'{key}'의 그룹명은 50자 이하여야 합니다")

        return group_names

    def _canonical_json(self, data: Any) -> str:
        """
        JSON을 정규화하여 문자열로 변환

        sort_keys=True로 일관된 순서 보장
        """
        return json.dumps(data, sort_keys=True, ensure_ascii=False)

    def _config_to_dict(self, config: StudyConfig) -> dict:
        """
        StudyConfig 객체를 딕셔너리로 변환

        crossover_mapping, group_names는 JSON 파싱
        """
        # group_names가 없으면 기본값 사용
        try:
            group_names = json.loads(config.group_names) if config.group_names else json.loads(DEFAULT_GROUP_NAMES)
        except (json.JSONDecodeError, AttributeError):
            group_names = json.loads(DEFAULT_GROUP_NAMES)

        return {
            "id": config.id,
            "total_sessions": config.total_sessions,
            "total_blocks": config.total_blocks,
            "total_groups": config.total_groups,
            "crossover_mapping": json.loads(config.crossover_mapping),
            "k_max": config.k_max,
            "ai_threshold": config.ai_threshold,
            "confidence_mode": config.confidence_mode,
            "require_lesion_marking": config.require_lesion_marking,
            "case_order_mode": config.case_order_mode,
            "random_seed": config.random_seed,
            "is_locked": config.is_locked,
            "locked_at": config.locked_at,
            "locked_by": config.locked_by,
            "study_name": config.study_name,
            "study_description": config.study_description,
            "group_names": group_names,
            "created_at": config.created_at,
            "updated_at": config.updated_at,
        }
