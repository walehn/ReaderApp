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

파일 명명 패턴:
  - positive: enriched_{num}_{patient_id}_{date}_{baseline|followup}.nii.gz
  - negative: neg_{num}_{patient_id}_{date}_{baseline|followup}.nii.gz

케이스 ID 형식:
  - positive: "pos_enriched_001_10667525"
  - negative: "neg_008_11155933"

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

        # 파일 패턴 정규식
        # positive: enriched_001_10667525_20240909_baseline.nii.gz
        # negative: neg_008_11155933_20240625_baseline.nii.gz
        self.positive_pattern = re.compile(
            r'^(enriched_\d+_\d+)_\d+_(baseline|followup)\.nii\.gz$'
        )
        self.negative_pattern = re.compile(
            r'^(neg_\d+_\d+)_\d+_(baseline|followup)\.nii\.gz$'
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

    def allocate_cases_to_session(
        self,
        num_sessions: int,
        num_blocks: int = 2,
        shuffle: bool = True
    ) -> Dict:
        """
        세션/블록별 케이스 자동 할당

        Args:
            num_sessions: 총 세션 수
            num_blocks: 블록 수 (기본 2)
            shuffle: 랜덤 셔플 여부

        Returns:
            {
                "total_cases": N,
                "cases_per_session": M,
                "cases_per_block": K,
                "sessions": {
                    "S1": {"block_a": [...], "block_b": [...]},
                    "S2": {"block_a": [...], "block_b": [...]},
                    ...
                }
            }
        """
        all_case_ids = self.get_all_case_ids(shuffle=shuffle)
        total_cases = len(all_case_ids)

        # 세션당 케이스 수 계산 (균등 분배)
        cases_per_session = total_cases // num_sessions
        cases_per_block = cases_per_session // num_blocks

        # 나머지 케이스는 버림 (균등 분배를 위해)
        usable_cases = cases_per_session * num_sessions

        result = {
            "total_cases": total_cases,
            "usable_cases": usable_cases,
            "cases_per_session": cases_per_session,
            "cases_per_block": cases_per_block,
            "sessions": {}
        }

        idx = 0
        for session_num in range(1, num_sessions + 1):
            session_code = f"S{session_num}"
            blocks = {}

            for block_idx in range(num_blocks):
                block_name = chr(ord('A') + block_idx)  # 'A', 'B', 'C', ...
                block_key = f"block_{block_name.lower()}"

                start = idx
                end = idx + cases_per_block
                blocks[block_key] = all_case_ids[start:end]
                idx = end

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

        Args:
            num_sessions: 총 세션 수
            num_blocks: 블록 수

        Returns:
            {
                "total_cases": N,
                "cases_per_session": M,
                "cases_per_block": K,
                "unused_cases": R
            }
        """
        count = self.get_total_case_count()
        total = count["total"]

        cases_per_session = total // num_sessions
        cases_per_block = cases_per_session // num_blocks
        usable = cases_per_session * num_sessions
        unused = total - usable

        return {
            "total_cases": total,
            "positive_cases": count["positive"],
            "negative_cases": count["negative"],
            "num_sessions": num_sessions,
            "num_blocks": num_blocks,
            "cases_per_session": cases_per_session,
            "cases_per_block": cases_per_block,
            "unused_cases": unused
        }


# 싱글톤 인스턴스
case_discovery_service = CaseDiscoveryService()
