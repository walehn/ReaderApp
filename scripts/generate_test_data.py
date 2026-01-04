#!/usr/bin/env python3
"""
============================================================================
테스트 NIfTI 데이터 생성 스크립트
============================================================================
역할: 개발/테스트용 더미 NIfTI 파일 생성

주요 기능:
  - 무작위 노이즈 기반 더미 볼륨 생성
  - 간 형태를 시뮬레이션한 구조 추가
  - AI 확률맵 (가짜 병변 위치) 생성

사용법:
  source /home/walehn/ReaderApp/ReaderApp/bin/activate
  python scripts/generate_test_data.py                # 기본 5개 케이스
  python scripts/generate_test_data.py --cases 10    # 10개 케이스
  python scripts/generate_test_data.py --size 256    # 256x256x80 볼륨

옵션:
  --cases N       생성할 케이스 수 (기본값: 5)
  --size S        볼륨 크기 (S x S x slices) (기본값: 256)
  --slices Z      Z축 슬라이스 수 (기본값: 80)
  --output DIR    출력 디렉토리 (기본값: cases/)

출력:
  cases/case_0001/baseline.nii.gz    # Baseline 볼륨
  cases/case_0001/followup.nii.gz    # Followup 볼륨
  cases/case_0001/ai_prob.nii.gz     # AI 확률맵
  ...
============================================================================
"""

import argparse
import numpy as np
import nibabel as nib
from pathlib import Path
import sys

# 프로젝트 루트 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def create_sphere_mask(shape, center, radius):
    """구형 마스크 생성"""
    x, y, z = np.ogrid[:shape[0], :shape[1], :shape[2]]
    dist = np.sqrt(
        (x - center[0])**2 +
        (y - center[1])**2 +
        (z - center[2])**2
    )
    return dist <= radius


def create_ellipsoid_mask(shape, center, radii):
    """타원체 마스크 생성"""
    x, y, z = np.ogrid[:shape[0], :shape[1], :shape[2]]
    normalized = (
        ((x - center[0]) / radii[0])**2 +
        ((y - center[1]) / radii[1])**2 +
        ((z - center[2]) / radii[2])**2
    )
    return normalized <= 1


def generate_liver_phantom(shape, seed=None):
    """
    간 팬텀 볼륨 생성

    - 배경: ~0 HU
    - 간 실질: ~60 HU
    - 혈관: ~40 HU
    """
    if seed is not None:
        np.random.seed(seed)

    volume = np.zeros(shape, dtype=np.float32)

    # 배경 노이즈
    volume += np.random.normal(0, 10, shape)

    # 간 영역 (큰 타원체)
    liver_center = (shape[0] // 2, shape[1] // 2, shape[2] // 2)
    liver_radii = (shape[0] // 3, shape[1] // 2.5, shape[2] // 3)
    liver_mask = create_ellipsoid_mask(shape, liver_center, liver_radii)

    volume[liver_mask] = 60 + np.random.normal(0, 8, shape)[liver_mask]

    # 혈관 구조 (작은 원통들)
    for _ in range(5):
        vessel_center = (
            np.random.randint(shape[0] // 4, 3 * shape[0] // 4),
            np.random.randint(shape[1] // 4, 3 * shape[1] // 4),
            np.random.randint(shape[2] // 4, 3 * shape[2] // 4)
        )
        vessel_mask = create_sphere_mask(shape, vessel_center, np.random.randint(5, 15))
        volume[vessel_mask & liver_mask] = 40

    return volume


def generate_lesion(shape, liver_mask, num_lesions=2, seed=None):
    """
    병변 생성 (Followup에만)

    - 병변: ~30-40 HU (저음영)
    """
    if seed is not None:
        np.random.seed(seed)

    lesion_mask = np.zeros(shape, dtype=bool)
    lesion_centers = []

    # 간 내부 좌표 추출
    liver_coords = np.argwhere(liver_mask)

    for _ in range(num_lesions):
        # 간 내부 무작위 위치
        idx = np.random.randint(0, len(liver_coords))
        center = tuple(liver_coords[idx])
        radius = np.random.randint(8, 20)

        lesion = create_sphere_mask(shape, center, radius)
        lesion_mask |= (lesion & liver_mask)
        lesion_centers.append((center, radius))

    return lesion_mask, lesion_centers


def generate_ai_prob_map(shape, lesion_centers, seed=None):
    """
    AI 확률맵 생성

    - 병변 위치: 높은 확률 (0.5-0.9)
    - 그 외: 낮은 확률 (0.0-0.2)
    """
    if seed is not None:
        np.random.seed(seed)

    prob_map = np.random.uniform(0, 0.1, shape).astype(np.float32)

    for center, radius in lesion_centers:
        # 병변 주변에 확률 추가
        lesion_mask = create_sphere_mask(shape, center, radius * 1.5)
        prob_map[lesion_mask] = np.random.uniform(0.5, 0.95, shape)[lesion_mask]

    # 가우시안 블러 효과 (단순화)
    prob_map = np.clip(prob_map, 0, 1)

    return prob_map


def save_nifti(data, filepath, spacing=(1.0, 1.0, 2.5)):
    """NIfTI 파일 저장"""
    affine = np.diag([spacing[0], spacing[1], spacing[2], 1.0])
    img = nib.Nifti1Image(data, affine)
    nib.save(img, str(filepath))
    print(f"  Saved: {filepath}")


def generate_case(case_dir, shape, case_num):
    """단일 케이스 생성"""
    case_dir.mkdir(parents=True, exist_ok=True)

    # 시드 설정 (재현 가능)
    base_seed = case_num * 1000

    # Baseline 생성 (병변 없음)
    baseline = generate_liver_phantom(shape, seed=base_seed)

    # 간 마스크 추출
    liver_mask = baseline > 30

    # Followup 생성 (병변 추가)
    followup = generate_liver_phantom(shape, seed=base_seed + 1)
    num_lesions = np.random.randint(1, 4)
    lesion_mask, lesion_centers = generate_lesion(
        shape, liver_mask, num_lesions, seed=base_seed + 2
    )

    # 병변을 Followup에 적용 (저음영)
    followup[lesion_mask] = 35 + np.random.normal(0, 5, shape)[lesion_mask]

    # AI 확률맵 생성
    ai_prob = generate_ai_prob_map(shape, lesion_centers, seed=base_seed + 3)

    # 저장
    save_nifti(baseline, case_dir / "baseline.nii.gz")
    save_nifti(followup, case_dir / "followup.nii.gz")
    save_nifti(ai_prob, case_dir / "ai_prob.nii.gz")


def main():
    parser = argparse.ArgumentParser(
        description="테스트 NIfTI 데이터 생성",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        "--cases", type=int, default=5,
        help="생성할 케이스 수 (기본값: 5)"
    )
    parser.add_argument(
        "--size", type=int, default=256,
        help="볼륨 크기 (S x S) (기본값: 256)"
    )
    parser.add_argument(
        "--slices", type=int, default=80,
        help="Z축 슬라이스 수 (기본값: 80)"
    )
    parser.add_argument(
        "--output", type=str, default=None,
        help="출력 디렉토리 (기본값: cases/)"
    )

    args = parser.parse_args()

    # 출력 디렉토리
    if args.output:
        output_dir = Path(args.output)
    else:
        output_dir = PROJECT_ROOT / "cases"

    output_dir.mkdir(parents=True, exist_ok=True)

    shape = (args.size, args.size, args.slices)

    print("=" * 60)
    print("테스트 NIfTI 데이터 생성")
    print("=" * 60)
    print(f"  케이스 수: {args.cases}")
    print(f"  볼륨 크기: {shape}")
    print(f"  출력 경로: {output_dir}")
    print("=" * 60)

    for i in range(1, args.cases + 1):
        case_id = f"case_{i:04d}"
        case_dir = output_dir / case_id
        print(f"\n[{i}/{args.cases}] {case_id} 생성 중...")
        generate_case(case_dir, shape, i)

    print("\n" + "=" * 60)
    print(f"완료! {args.cases}개 케이스 생성됨")
    print("=" * 60)


if __name__ == "__main__":
    main()
