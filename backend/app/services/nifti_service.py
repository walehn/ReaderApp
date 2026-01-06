"""
============================================================================
NIfTI Service - Reader Study MVP
============================================================================
역할: NIfTI 파일 로딩 및 슬라이스 렌더링

주요 기능:
  - load_volume(): NIfTI 볼륨 로드 (캐시 활용)
  - get_case_metadata(): 케이스 메타데이터 조회
  - render_slice(): 특정 Z 슬라이스를 PNG로 렌더링
  - render_overlay(): AI 확률맵 오버레이 렌더링

케이스 ID 형식:
  - Legacy: "case_0001" (cases 폴더)
  - Dataset: "pos_enriched_001_10667525" (dataset/positive)
  - Dataset: "neg_008_11155933" (dataset/negative)

Window/Level 프리셋:
  - liver: WW=150, WL=50 (간 조직 최적화)
  - soft:  WW=400, WL=40 (연부 조직)

사용 예시:
  from app.services.nifti_service import NIfTIService

  service = NIfTIService()
  meta = await service.get_case_metadata("case_0001")
  meta = await service.get_case_metadata("pos_enriched_001_10667525")
  png = await service.render_slice("case_0001", "followup", 50, "liver")
============================================================================
"""

import nibabel as nib
import numpy as np
from PIL import Image
from io import BytesIO
from pathlib import Path
from typing import Optional, Tuple
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.config import settings
from app.models.schemas import CaseMeta
from app.services.cache_service import (
    get_cached_volume, set_cached_volume,
    get_cached_slice, set_cached_slice,
    get_cached_ai_prob, set_cached_ai_prob
)

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
        self.wl_presets = settings.WL_PRESETS
        self.jpeg_quality = settings.JPEG_QUALITY

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
            for file_path in self.positive_dir.iterdir():
                if file_path.name.startswith(base_id) and series in file_path.name:
                    # _0000.nii.gz 파일 제외 (nnU-Net 포맷)
                    if "_0000.nii.gz" not in file_path.name:
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
            case_id: 케이스 ID

        Returns:
            파일 경로 또는 None
        """
        # Legacy 케이스
        if case_id.startswith("case_"):
            filepath = self.cases_dir / case_id / "ai_prob.nii.gz"
            if filepath.exists():
                return filepath
            return None

        # Dataset positive
        if case_id.startswith("pos_"):
            base_id = case_id[4:]
            ai_dir = self.ai_label_dir / "positive"
            if ai_dir.exists():
                for file_path in ai_dir.iterdir():
                    if base_id in file_path.name:
                        return file_path
            return None

        # Dataset negative
        if case_id.startswith("neg_"):
            ai_dir = self.ai_label_dir / "negative"
            if ai_dir.exists():
                for file_path in ai_dir.iterdir():
                    if case_id in file_path.name:
                        return file_path
            return None

        return None

    # =========================================================================
    # 볼륨 로딩
    # =========================================================================

    def _load_nifti_sync(self, filepath: Path) -> Tuple[np.ndarray, list]:
        """NIfTI 파일 동기 로드"""
        img = nib.load(str(filepath))
        data = img.get_fdata().astype(np.float32)
        spacing = list(img.header.get_zooms()[:3])
        return data, spacing

    async def load_volume(
        self, case_id: str, series: str
    ) -> Tuple[np.ndarray, list]:
        """
        NIfTI 볼륨 로드 (캐시 우선)

        Args:
            case_id: 케이스 ID (예: "case_0001", "pos_enriched_001_...", "neg_008_...")
            series: 시리즈 종류 ("baseline" | "followup")

        Returns:
            (volume_data, spacing) 튜플
        """
        # 캐시 확인
        cached = get_cached_volume(case_id, series)
        if cached is not None:
            return cached

        # 파일 경로 매핑
        filepath = self._get_volume_filepath(case_id, series)
        if filepath is None or not filepath.exists():
            raise FileNotFoundError(f"NIfTI file not found for case: {case_id}, series: {series}")

        # 비동기로 파일 로드
        loop = asyncio.get_event_loop()
        data, spacing = await loop.run_in_executor(
            _executor, self._load_nifti_sync, filepath
        )

        # 캐시 저장
        set_cached_volume(case_id, series, data, spacing)

        return data, spacing

    async def load_ai_prob(self, case_id: str) -> Optional[np.ndarray]:
        """AI 확률맵 로드"""
        # 캐시 확인
        cached = get_cached_ai_prob(case_id)
        if cached is not None:
            return cached

        # 파일 경로 매핑
        filepath = self._get_ai_prob_filepath(case_id)
        if filepath is None or not filepath.exists():
            return None

        loop = asyncio.get_event_loop()
        data, _ = await loop.run_in_executor(
            _executor, self._load_nifti_sync, filepath
        )

        set_cached_ai_prob(case_id, data)
        return data

    # =========================================================================
    # 메타데이터
    # =========================================================================

    async def get_case_metadata(self, case_id: str) -> CaseMeta:
        """
        케이스 메타데이터 조회

        Args:
            case_id: 케이스 ID (예: "case_0001", "pos_enriched_001_...", "neg_008_...")

        Returns:
            CaseMeta: shape, slices, spacing, ai_available
        """
        # 파일 경로 확인
        filepath = self._get_volume_filepath(case_id, "followup")
        if filepath is None:
            raise FileNotFoundError(f"Case not found: {case_id}")

        # followup 볼륨 기준으로 메타데이터 추출
        data, spacing = await self.load_volume(case_id, "followup")

        # AI 확률맵 존재 여부
        ai_prob_path = self._get_ai_prob_filepath(case_id)
        ai_available = ai_prob_path is not None and ai_prob_path.exists()

        return CaseMeta(
            case_id=case_id,
            shape=list(data.shape),
            slices=data.shape[2],  # Z축
            spacing=spacing,
            ai_available=ai_available
        )

    # =========================================================================
    # 슬라이스 렌더링
    # =========================================================================

    def _apply_window_level(
        self, data: np.ndarray, wl_preset: str
    ) -> np.ndarray:
        """Window/Level 적용"""
        preset = self.wl_presets[wl_preset]
        ww = preset["ww"]
        wl = preset["wl"]

        # Window/Level 공식
        lower = wl - ww / 2
        upper = wl + ww / 2

        # 클리핑 및 정규화
        windowed = np.clip(data, lower, upper)
        normalized = ((windowed - lower) / (upper - lower) * 255).astype(np.uint8)

        return normalized

    def _to_image(self, array_2d: np.ndarray, format: str = "png") -> bytes:
        """
        2D numpy 배열을 이미지 bytes로 변환

        Args:
            array_2d: 2D numpy 배열
            format: 'png' (무손실) 또는 'jpeg' (손실)

        Returns:
            이미지 bytes
        """
        # Y축 반전 (의료 영상 관례)
        array_2d = np.flipud(array_2d)

        img = Image.fromarray(array_2d, mode="L")
        buffer = BytesIO()

        if format.lower() == "png":
            img.save(buffer, format="PNG", compress_level=6)
        else:
            # JPEG: 설정된 품질 사용 (기본값: 85)
            img.save(buffer, format="JPEG", quality=self.jpeg_quality)

        return buffer.getvalue()

    async def render_slice(
        self, case_id: str, series: str, z: int, wl: str, format: str = "png"
    ) -> tuple[bytes, str]:
        """
        슬라이스를 이미지로 렌더링

        Args:
            case_id: 케이스 ID
            series: "baseline" | "followup"
            z: Z 슬라이스 인덱스
            wl: Window/Level 프리셋 ("liver" | "soft")
            format: "png" (무손실, 권장) 또는 "jpeg" (손실)

        Returns:
            (이미지 bytes, media_type) 튜플
        """
        # 캐시 키에 format 포함
        cache_key = f"{format}"
        cached = get_cached_slice(case_id, series, z, f"{wl}_{format}")
        if cached is not None:
            media_type = "image/png" if format == "png" else "image/jpeg"
            return cached, media_type

        # 볼륨 로드
        volume, _ = await self.load_volume(case_id, series)

        # Z 인덱스 검증
        if z < 0 or z >= volume.shape[2]:
            raise ValueError(f"Invalid slice index: {z} (max: {volume.shape[2] - 1})")

        # 슬라이스 추출 및 렌더링
        slice_data = volume[:, :, z].T  # Transpose for proper orientation
        windowed = self._apply_window_level(slice_data, wl)
        image_bytes = self._to_image(windowed, format)

        # 캐시 저장
        set_cached_slice(case_id, series, z, f"{wl}_{format}", image_bytes)

        media_type = "image/png" if format == "png" else "image/jpeg"
        return image_bytes, media_type

    # =========================================================================
    # AI 오버레이 렌더링
    # =========================================================================

    async def render_overlay(
        self,
        case_id: str,
        z: int,
        threshold: float = 0.30,
        alpha: float = 0.4
    ) -> Optional[bytes]:
        """
        AI 확률맵 오버레이 렌더링

        Args:
            case_id: 케이스 ID
            z: Z 슬라이스 인덱스
            threshold: 확률 임계값 (기본 0.30)
            alpha: 오버레이 투명도 (기본 0.4)

        Returns:
            PNG bytes (투명도 포함) 또는 None (AI 없음)
        """
        ai_prob = await self.load_ai_prob(case_id)
        if ai_prob is None:
            return None

        if z < 0 or z >= ai_prob.shape[2]:
            raise ValueError(f"Invalid slice index: {z}")

        # 확률맵 슬라이스
        prob_slice = ai_prob[:, :, z].T
        prob_slice = np.flipud(prob_slice)

        # 임계값 적용
        mask = prob_slice >= threshold

        # RGBA 이미지 생성 (빨간색 오버레이)
        h, w = prob_slice.shape
        overlay = np.zeros((h, w, 4), dtype=np.uint8)
        overlay[mask, 0] = 255  # Red
        overlay[mask, 3] = int(alpha * 255)  # Alpha

        # PNG로 변환 (투명도 유지)
        img = Image.fromarray(overlay, mode="RGBA")
        buffer = BytesIO()
        img.save(buffer, format="PNG")

        return buffer.getvalue()


# 싱글톤 인스턴스
nifti_service = NIfTIService()
