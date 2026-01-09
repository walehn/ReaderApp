"""
============================================================================
NIfTI Service - Reader Study MVP
============================================================================
역할: NIfTI 파일 로딩 및 메타데이터 조회

주요 기능:
  - get_case_metadata(): 케이스 메타데이터 조회
  - _get_volume_filepath(): 볼륨 파일 경로 매핑
  - _get_ai_prob_filepath(): AI 레이블 파일 경로 매핑

Note:
  NiiVue 전환으로 볼륨 렌더링은 클라이언트에서 처리됩니다.
  백엔드는 /nifti/volume, /nifti/overlay로 파일을 직접 스트리밍합니다.

케이스 ID 형식:
  - Dataset: "pos_enriched_001_10667525" (dataset/positive)
  - Dataset: "neg_008_11155933" (dataset/negative)
============================================================================
"""

import nibabel as nib
import numpy as np
from pathlib import Path
from typing import Optional, Tuple
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.config import settings
from app.models.schemas import CaseMeta

# 스레드 풀 (파일 I/O용)
_executor = ThreadPoolExecutor(max_workers=4)


class NIfTIService:
    """NIfTI 파일 처리 서비스"""

    def __init__(self):
        self.cases_dir = settings.CASES_DIR
        self.dataset_dir = settings.DATASET_DIR
        self.positive_dir = settings.POSITIVE_DIR
        self.negative_dir = settings.NEGATIVE_DIR
        self.ai_label_dir = settings.AI_LABEL_DIR

    # =========================================================================
    # 파일 경로 매핑
    # =========================================================================

    def _get_volume_filepath(self, case_id: str, series: str) -> Optional[Path]:
        """
        케이스 ID와 시리즈로 NIfTI 파일 경로 반환

        Args:
            case_id: 케이스 ID
            series: "baseline" | "followup"

        Returns:
            파일 경로 또는 None
        """
        # Legacy 케이스 (cases 폴더)
        if case_id.startswith("case_"):
            filepath = self.cases_dir / case_id / f"{series}.nii.gz"
            if filepath.exists():
                return filepath
            return None

        # Dataset positive 케이스
        if case_id.startswith("pos_"):
            # pos_enriched_001_10667525 -> enriched_001_10667525
            base_id = case_id[4:]  # "pos_" 제거
            # dataset/positive/에서 매칭되는 파일 찾기
            # _0000.nii.gz 파일만 사용 (실제 CT 이미지, 마스크 파일 제외)
            for file_path in self.positive_dir.iterdir():
                if file_path.name.startswith(base_id) and series in file_path.name:
                    if "_0000.nii.gz" in file_path.name:
                        return file_path
            return None

        # Dataset negative 케이스
        if case_id.startswith("neg_"):
            # neg_008_11155933 -> neg_008_11155933
            for file_path in self.negative_dir.iterdir():
                if file_path.name.startswith(case_id) and series in file_path.name:
                    return file_path
            return None

        return None

    def _get_ai_prob_filepath(self, case_id: str) -> Optional[Path]:
        """
        케이스 ID로 AI 확률맵 파일 경로 반환

        Args:
            case_id: 케이스 ID (pos_* 또는 neg_* 형식)

        Returns:
            파일 경로 또는 None
        """
        # Dataset positive
        if case_id.startswith("pos_"):
            base_id = case_id[4:]  # "enriched_001_10667525"
            ai_dir = self.ai_label_dir / "positive"
            if ai_dir.exists():
                for file_path in ai_dir.iterdir():
                    # segmentation label 파일만 매칭 (_lesion_prob 제외)
                    if (base_id in file_path.name
                        and file_path.suffix == ".gz"
                        and "_lesion_prob" not in file_path.name):
                        return file_path
            return None

        # Dataset negative
        if case_id.startswith("neg_"):
            ai_dir = self.ai_label_dir / "negative"
            if ai_dir.exists():
                for file_path in ai_dir.iterdir():
                    # segmentation label 파일만 매칭 (_lesion_prob 제외)
                    if (case_id in file_path.name
                        and file_path.suffix == ".gz"
                        and "_lesion_prob" not in file_path.name):
                        return file_path
            return None

        return None

    # =========================================================================
    # 볼륨 로딩
    # =========================================================================

    def _detect_z_orientation(self, img: nib.Nifti1Image) -> bool:
        """
        NIfTI 이미지의 Z축 방향 감지

        NIfTI affine matrix의 Z축 방향 벡터(affine[2,2])를 분석하여
        슬라이스 순서가 Inferior→Superior인지 Superior→Inferior인지 판단합니다.

        의료 영상 표준:
          - 첫 슬라이스(index 0) = Superior (머리/상복부 쪽)
          - 마지막 슬라이스 = Inferior (발/하복부 쪽)

        Returns:
            True: 반전 필요 (현재 슬라이스 0 = Inferior/골반)
            False: 정상 (현재 슬라이스 0 = Superior/간)
        """
        affine = img.affine
        z_direction = affine[2, 2]

        # 실제 데이터 검증 결과:
        # - 대부분 케이스: affine[2,2] > 0 (양수) → 정상 (간이 먼저 나옴)
        # - 일부 케이스: affine[2,2] < 0 (음수) → 반전 필요 (골반이 먼저 나옴)
        return z_direction < 0

    def _load_nifti_sync(self, filepath: Path) -> Tuple[np.ndarray, list, bool]:
        """
        NIfTI 파일 동기 로드 (Z축 방향 정보 포함)

        Returns:
            (volume_data, spacing, z_flipped) 튜플
            - z_flipped: True면 프론트엔드에서 슬라이스 인덱스 반전 필요
        """
        img = nib.load(str(filepath))
        data = img.get_fdata().astype(np.float32)
        spacing = list(img.header.get_zooms()[:3])

        # Z축 방향 감지
        z_flipped = self._detect_z_orientation(img)

        return data, spacing, z_flipped

    async def load_volume(
        self, case_id: str, series: str
    ) -> Tuple[np.ndarray, list, bool]:
        """
        NIfTI 볼륨 로드

        Args:
            case_id: 케이스 ID (예: "pos_enriched_001_...", "neg_008_...")
            series: 시리즈 종류 ("baseline" | "followup")

        Returns:
            (volume_data, spacing, z_flipped) 튜플
            - z_flipped: Z축 반전 필요 여부 (affine matrix 기반 감지)

        Note:
            NiiVue에서는 /nifti/volume으로 파일을 직접 스트리밍합니다.
            이 함수는 메타데이터 조회용으로만 사용됩니다.
        """
        # 파일 경로 매핑
        filepath = self._get_volume_filepath(case_id, series)
        if filepath is None or not filepath.exists():
            raise FileNotFoundError(f"NIfTI file not found for case: {case_id}, series: {series}")

        # 비동기로 파일 로드
        loop = asyncio.get_event_loop()
        data, spacing, z_flipped = await loop.run_in_executor(
            _executor, self._load_nifti_sync, filepath
        )

        return data, spacing, z_flipped

    # =========================================================================
    # 메타데이터
    # =========================================================================

    async def get_case_metadata(self, case_id: str) -> CaseMeta:
        """
        케이스 메타데이터 조회

        Args:
            case_id: 케이스 ID (예: "case_0001", "pos_enriched_001_...", "neg_008_...")

        Returns:
            CaseMeta: shape, slices, spacing, ai_available, z_flipped_baseline, z_flipped_followup
        """
        # 파일 경로 확인
        filepath = self._get_volume_filepath(case_id, "followup")
        if filepath is None:
            raise FileNotFoundError(f"Case not found: {case_id}")

        # baseline과 followup 각각의 z_flipped 값 로드
        data_followup, spacing, z_flipped_followup = await self.load_volume(case_id, "followup")
        _, _, z_flipped_baseline = await self.load_volume(case_id, "baseline")

        # AI 확률맵 존재 여부
        ai_prob_path = self._get_ai_prob_filepath(case_id)
        ai_available = ai_prob_path is not None and ai_prob_path.exists()

        return CaseMeta(
            case_id=case_id,
            shape=list(data_followup.shape),
            slices=data_followup.shape[2],  # Z축
            spacing=spacing,
            ai_available=ai_available,
            z_flipped_baseline=z_flipped_baseline,
            z_flipped_followup=z_flipped_followup
        )


# 싱글톤 인스턴스
nifti_service = NIfTIService()
