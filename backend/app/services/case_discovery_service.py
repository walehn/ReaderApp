"""
============================================================================
Case Discovery Service - Reader Study
============================================================================
역할: dataset 폴더에서 유효한 NIfTI 케이스를 스캔하고 세션별 할당

주요 기능:
  - scan_dataset_cases(): dataset에서 baseline+followup 쌍이 있는 케이스 목록
  - get_total_case_count(): 전체 케이스 수
  - allocate_cases_to_session(): 세션/블록별 케이스 자동 할당
  - get_case_file_paths(): 케이스 ID로 실제 파일 경로 반환

파일 명명 패턴 (접두사 무관, 폴더 내 모든 이미지 파일 스캔):
  - positive: {any_prefix}_{date}_{baseline|followup}_0000.nii.gz (실제 CT 이미지)
    예: enriched_001_10667525_20240909_baseline_0000.nii.gz
        sequential_001_11580277_20240923_baseline_0000.nii.gz
        test_012_30773712_20230125_baseline_0000.nii.gz
  - negative: {any_prefix}_{date}_{baseline|followup}.nii.gz
    예: neg_008_11155933_20240625_baseline.nii.gz

케이스 ID 형식:
  - positive: "pos_{prefix}_{num}_{patient_id}" (예: "pos_enriched_001_10667525")
  - negative: "{prefix}_{num}_{patient_id}" (예: "neg_008_11155933")

사용 예시:
  from app.services.case_discovery_service import case_discovery_service

  cases = case_discovery_service.scan_dataset_cases()
  allocation = case_discovery_service.allocate_cases_to_session(
      num_sessions=4, num_blocks=2
  )
============================================================================
"""

import re
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from app.config import settings


@dataclass
class CaseInfo:
    """케이스 정보"""
    case_id: str
    category: str  # 'positive' | 'negative'
    baseline_path: Path
    followup_path: Path
    ai_label_path: Optional[Path] = None


class CaseDiscoveryService:
    """Dataset 폴더에서 케이스를 스캔하고 할당하는 서비스"""

    def __init__(self):
        self.dataset_dir = settings.DATASET_DIR
        self.positive_dir = settings.POSITIVE_DIR
        self.negative_dir = settings.NEGATIVE_DIR
        self.ai_label_dir = settings.AI_LABEL_DIR

        # 파일 패턴 정규식 (접두사 무관, 폴더 내 모든 이미지 파일 스캔)
        # positive: {prefix}_{num}_{patient_id}_{date}_{baseline|followup}_0000.nii.gz
        #   - enriched_001_10667525_20240909_baseline_0000.nii.gz
        #   - sequential_001_11580277_20240923_baseline_0000.nii.gz
        #   - test_012_30773712_20230125_baseline_0000.nii.gz
        # negative: {prefix}_{num}_{patient_id}_{date}_{baseline|followup}.nii.gz
        #   - neg_008_11155933_20240625_baseline.nii.gz
        self.positive_pattern = re.compile(
            r'^(.+)_\d{8}_(baseline|followup)_0000\.nii\.gz$'
        )
        self.negative_pattern = re.compile(
            r'^(.+)_\d{8}_(baseline|followup)\.nii\.gz$'
        )

    def _scan_folder(self, folder: Path, pattern: re.Pattern, prefix: str) -> Dict[str, Dict[str, Path]]:
        """
        폴더에서 케이스 파일 스캔

        Returns:
            {case_id: {'baseline': Path, 'followup': Path}}
        """
        cases = {}

        if not folder.exists():
            return cases

        for file_path in folder.iterdir():
            if not file_path.is_file():
                continue

            match = pattern.match(file_path.name)
            if match:
                # enriched_001_10667525 또는 neg_008_11155933
                base_id = match.group(1)
                series_type = match.group(2)  # baseline or followup

                # 케이스 ID 생성 (prefix 추가로 중복 방지)
                case_id = f"{prefix}_{base_id}" if prefix else base_id

                if case_id not in cases:
                    cases[case_id] = {}

                cases[case_id][series_type] = file_path

        return cases

    def scan_dataset_cases(self) -> Dict[str, List[CaseInfo]]:
        """
        Dataset 폴더에서 유효한 케이스 목록 반환

        baseline과 followup 쌍이 모두 있는 케이스만 포함

        Returns:
            {
                "positive": [CaseInfo, ...],
                "negative": [CaseInfo, ...]
            }
        """
        result = {
            "positive": [],
            "negative": []
        }

        # Positive 케이스 스캔
        pos_cases = self._scan_folder(self.positive_dir, self.positive_pattern, "pos")
        for case_id, paths in pos_cases.items():
            if 'baseline' in paths and 'followup' in paths:
                # AI 라벨 경로 확인
                ai_path = self.ai_label_dir / "positive" / f"{case_id.replace('pos_', '')}_ai_prob.nii.gz"
                if not ai_path.exists():
                    ai_path = None

                result["positive"].append(CaseInfo(
                    case_id=case_id,
                    category="positive",
                    baseline_path=paths['baseline'],
                    followup_path=paths['followup'],
                    ai_label_path=ai_path
                ))

        # Negative 케이스 스캔
        neg_cases = self._scan_folder(self.negative_dir, self.negative_pattern, "")
        for case_id, paths in neg_cases.items():
            if 'baseline' in paths and 'followup' in paths:
                # AI 라벨 경로 확인
                ai_path = self.ai_label_dir / "negative" / f"{case_id}_ai_prob.nii.gz"
                if not ai_path.exists():
                    ai_path = None

                result["negative"].append(CaseInfo(
                    case_id=case_id,
                    category="negative",
                    baseline_path=paths['baseline'],
                    followup_path=paths['followup'],
                    ai_label_path=ai_path
                ))

        return result

    def get_total_case_count(self) -> Dict[str, int]:
        """
        전체 케이스 수 반환

        Returns:
            {"positive": N, "negative": M, "total": N+M}
        """
        cases = self.scan_dataset_cases()
        pos_count = len(cases["positive"])
        neg_count = len(cases["negative"])

        return {
            "positive": pos_count,
            "negative": neg_count,
            "total": pos_count + neg_count
        }

    def get_all_case_ids(self, shuffle: bool = False) -> List[str]:
        """
        모든 케이스 ID 목록 반환

        Args:
            shuffle: True면 랜덤 셔플

        Returns:
            ["pos_enriched_001_10667525", "neg_008_11155933", ...]
        """
        cases = self.scan_dataset_cases()
        all_ids = [c.case_id for c in cases["positive"]] + \
                  [c.case_id for c in cases["negative"]]

        if shuffle:
            random.shuffle(all_ids)

        return all_ids

    def get_case_ids_by_category(self, shuffle: bool = False) -> Tuple[List[str], List[str]]:
        """
        카테고리별 케이스 ID 목록 반환

        Args:
            shuffle: True면 각 카테고리 내에서 랜덤 셔플

        Returns:
            (positive_ids, negative_ids) 튜플
        """
        cases = self.scan_dataset_cases()
        positive_ids = [c.case_id for c in cases["positive"]]
        negative_ids = [c.case_id for c in cases["negative"]]

        if shuffle:
            random.shuffle(positive_ids)
            random.shuffle(negative_ids)

        return positive_ids, negative_ids

    def allocate_cases_to_session(
        self,
        num_sessions: int,
        num_blocks: int = 2,
        shuffle: bool = True
    ) -> Dict:
        """
        세션/블록별 케이스 자동 할당 (Crossover Design)

        Crossover 연구 설계를 지원합니다:
        - 모든 세션이 전체 케이스를 포함 (세션당 total_cases개)
        - 각 블록은 전체 케이스를 블록 수로 나눈 만큼 포함
        - 모든 세션에서 동일한 블록 파트 사용 (순서만 다름)
        - 이를 통해 모든 케이스가 AIDED/UNAIDED 모두 평가됨

        예: 전체 120개 케이스 (pos 40, neg 80), 2세션, 2블록
            - 세션당 120개 케이스
            - 블록당 60개 케이스 (pos 20, neg 40)
            - S1 block_a = S2 block_a (동일한 파트, 순서만 다름)
            - S1 block_b = S2 block_b (동일한 파트, 순서만 다름)

        Args:
            num_sessions: 총 세션 수
            num_blocks: 블록 수 (기본 2)
            shuffle: 랜덤 셔플 여부 (블록 내 순서)

        Returns:
            {
                "total_cases": N,
                "cases_per_session": M,
                "cases_per_block": K,
                "positive_per_block": P,
                "negative_per_block": Q,
                "sessions": {
                    "S1": {"block_a": [...], "block_b": [...]},
                    "S2": {"block_a": [...], "block_b": [...]},
                    ...
                }
            }
        """
        # 케이스 ID 조회 (초기 셔플은 블록 파트 생성 전에 한 번만)
        positive_ids, negative_ids = self.get_case_ids_by_category(shuffle=shuffle)

        total_positive = len(positive_ids)
        total_negative = len(negative_ids)
        total_cases = total_positive + total_negative

        # 블록당 positive/negative 수 계산 (세션 수와 무관, 블록 수로만 나눔)
        pos_per_block = total_positive // num_blocks
        neg_per_block = total_negative // num_blocks
        cases_per_block = pos_per_block + neg_per_block
        cases_per_session = cases_per_block * num_blocks  # = total_cases (사용 가능한 부분)

        # 사용 가능한 케이스 수 (나머지는 버려짐)
        usable_positive = pos_per_block * num_blocks
        usable_negative = neg_per_block * num_blocks
        usable_cases = usable_positive + usable_negative

        result = {
            "total_cases": total_cases,
            "usable_cases": usable_cases,
            "cases_per_session": cases_per_session,
            "cases_per_block": cases_per_block,
            "positive_per_block": pos_per_block,
            "negative_per_block": neg_per_block,
            "ratio": f"{pos_per_block}:{neg_per_block}",
            "sessions": {}
        }

        # [핵심 1] 블록 파트를 한 번만 생성 (Crossover: 모든 세션에서 동일하게 사용)
        block_parts = []
        pos_idx, neg_idx = 0, 0
        for block_idx in range(num_blocks):
            part_positive = positive_ids[pos_idx:pos_idx + pos_per_block]
            part_negative = negative_ids[neg_idx:neg_idx + neg_per_block]
            block_parts.append(part_positive + part_negative)
            pos_idx += pos_per_block
            neg_idx += neg_per_block

        # [핵심 2] 모든 세션에 동일한 파트 할당, 블록 내 순서만 세션별로 다르게 셔플
        for session_num in range(1, num_sessions + 1):
            session_code = f"S{session_num}"
            blocks = {}

            for block_idx in range(num_blocks):
                block_name = chr(ord('A') + block_idx)  # 'A', 'B', 'C', ...
                block_key = f"block_{block_name.lower()}"

                # 동일한 케이스 파트 복사
                block_cases = block_parts[block_idx].copy()

                # 블록 내 순서만 세션별로 다르게 셔플
                if shuffle:
                    random.shuffle(block_cases)

                blocks[block_key] = block_cases

            result["sessions"][session_code] = blocks

        return result

    def get_case_file_paths(self, case_id: str) -> Optional[Dict[str, Path]]:
        """
        케이스 ID로 실제 파일 경로 반환

        Args:
            case_id: 케이스 ID (예: "pos_enriched_001_10667525", "neg_008_11155933")

        Returns:
            {
                "baseline": Path,
                "followup": Path,
                "ai_prob": Path (optional)
            }
        """
        cases = self.scan_dataset_cases()

        # positive 케이스 검색
        for case_info in cases["positive"]:
            if case_info.case_id == case_id:
                result = {
                    "baseline": case_info.baseline_path,
                    "followup": case_info.followup_path
                }
                if case_info.ai_label_path:
                    result["ai_prob"] = case_info.ai_label_path
                return result

        # negative 케이스 검색
        for case_info in cases["negative"]:
            if case_info.case_id == case_id:
                result = {
                    "baseline": case_info.baseline_path,
                    "followup": case_info.followup_path
                }
                if case_info.ai_label_path:
                    result["ai_prob"] = case_info.ai_label_path
                return result

        return None

    def get_allocation_preview(
        self,
        num_sessions: int,
        num_blocks: int = 2
    ) -> Dict:
        """
        케이스 할당 미리보기 (실제 할당 없이 숫자만 계산)

        Crossover Design을 반영하여:
        - 모든 세션이 전체 케이스를 포함 (세션당 total_cases개)
        - 각 블록은 전체 케이스를 블록 수로 나눈 만큼 포함
        - positive/negative 비율 유지

        Args:
            num_sessions: 총 세션 수
            num_blocks: 블록 수

        Returns:
            {
                "total_cases": N,
                "usable_cases": M,
                "cases_per_session": K,
                "cases_per_block": L,
                "positive_per_block": P,
                "negative_per_block": Q,
                "unused_cases": R
            }
        """
        count = self.get_total_case_count()
        total_positive = count["positive"]
        total_negative = count["negative"]
        total = count["total"]

        # Crossover Design: 세션 수와 무관하게 블록 수로만 나눔
        pos_per_block = total_positive // num_blocks
        neg_per_block = total_negative // num_blocks
        cases_per_block = pos_per_block + neg_per_block

        # 사용 가능한 케이스 (나머지는 버려짐)
        usable_positive = pos_per_block * num_blocks
        usable_negative = neg_per_block * num_blocks
        usable_cases = usable_positive + usable_negative

        # 세션당 케이스 = 블록당 케이스 * 블록 수 = 전체 사용 가능 케이스
        cases_per_session = cases_per_block * num_blocks

        unused = total - usable_cases

        return {
            "total_cases": total,
            "positive_cases": total_positive,
            "negative_cases": total_negative,
            "usable_cases": usable_cases,
            "num_sessions": num_sessions,
            "num_blocks": num_blocks,
            "cases_per_session": cases_per_session,
            "cases_per_block": cases_per_block,
            "positive_per_block": pos_per_block,
            "negative_per_block": neg_per_block,
            "ratio": f"{pos_per_block}:{neg_per_block}",
            "unused_cases": unused
        }


# 싱글톤 인스턴스
case_discovery_service = CaseDiscoveryService()
