"""
============================================================================
Cache Service - Reader Study MVP
============================================================================
역할: LRU 캐시 관리 (슬라이스 이미지, NIfTI 볼륨)

캐시 종류:
  - slice_cache: 렌더링된 JPEG 슬라이스 캐시
    키: (case_id, series, z, wl)
    값: JPEG bytes
    크기: 최대 500개

  - volume_cache: 로드된 NIfTI 볼륨/spacing 캐시
    키: (case_id, series)
    값: (numpy.ndarray, spacing)
    크기: 최대 10개

사용 예시:
  from app.services.cache_service import slice_cache, volume_cache

  # 캐시 조회
  cached = slice_cache.get(("case_0001", "baseline", 50, "liver"))

  # 캐시 저장
  slice_cache[("case_0001", "baseline", 50, "liver")] = jpeg_bytes
============================================================================
"""

from cachetools import LRUCache
from app.config import settings
import numpy as np
from typing import Tuple, Optional, List

# =============================================================================
# 캐시 인스턴스
# =============================================================================

# 슬라이스 이미지 캐시: (case_id, series, z, wl) -> JPEG bytes
# 평균 슬라이스 크기 ~100KB, 500개 = ~50MB
slice_cache: LRUCache[Tuple[str, str, int, str], bytes] = LRUCache(
    maxsize=settings.SLICE_CACHE_SIZE
)

# NIfTI 볼륨 캐시: (case_id, series) -> (numpy.ndarray, spacing)
# 평균 볼륨 크기 ~50MB, 10개 = ~500MB
volume_cache: LRUCache[Tuple[str, str], Tuple[np.ndarray, List[float]]] = LRUCache(
    maxsize=settings.VOLUME_CACHE_SIZE
)

# AI 확률맵 캐시: (case_id,) -> numpy.ndarray
ai_prob_cache: LRUCache[str, np.ndarray] = LRUCache(maxsize=settings.VOLUME_CACHE_SIZE)


# =============================================================================
# 캐시 유틸리티 함수
# =============================================================================

def get_cached_slice(
    case_id: str, series: str, z: int, wl: str
) -> Optional[bytes]:
    """캐시된 슬라이스 조회"""
    key = (case_id, series, z, wl)
    return slice_cache.get(key)


def set_cached_slice(
    case_id: str, series: str, z: int, wl: str, data: bytes
) -> None:
    """슬라이스 캐시 저장"""
    key = (case_id, series, z, wl)
    slice_cache[key] = data


def get_cached_volume(
    case_id: str, series: str
) -> Optional[Tuple[np.ndarray, List[float]]]:
    """캐시된 볼륨/spacing 조회"""
    key = (case_id, series)
    return volume_cache.get(key)


def set_cached_volume(
    case_id: str, series: str, data: np.ndarray, spacing: List[float]
) -> None:
    """볼륨/spacing 캐시 저장"""
    key = (case_id, series)
    volume_cache[key] = (data, spacing)


def get_cached_ai_prob(case_id: str) -> Optional[np.ndarray]:
    """캐시된 AI 확률맵 조회"""
    return ai_prob_cache.get(case_id)


def set_cached_ai_prob(case_id: str, data: np.ndarray) -> None:
    """AI 확률맵 캐시 저장"""
    ai_prob_cache[case_id] = data


def clear_all_caches() -> None:
    """모든 캐시 초기화"""
    slice_cache.clear()
    volume_cache.clear()
    ai_prob_cache.clear()


def get_cache_stats() -> dict:
    """캐시 통계 조회"""
    return {
        "slice_cache": {
            "size": len(slice_cache),
            "maxsize": slice_cache.maxsize
        },
        "volume_cache": {
            "size": len(volume_cache),
            "maxsize": volume_cache.maxsize
        },
        "ai_prob_cache": {
            "size": len(ai_prob_cache),
            "maxsize": ai_prob_cache.maxsize
        }
    }
