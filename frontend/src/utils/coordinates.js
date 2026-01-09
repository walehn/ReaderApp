/**
 * ============================================================================
 * Coordinate Conversion Utility
 * ============================================================================
 * 역할: 캔버스 픽셀 좌표 ↔ NIfTI 복셀 좌표 변환
 *
 * 좌표 시스템:
 *   - 캔버스 좌표: (0, 0) ~ (canvasWidth, canvasHeight) 픽셀
 *   - 복셀 좌표: (0, 0, 0) ~ (dimX-1, dimY-1, dimZ-1) 복셀 인덱스
 *
 * 사용 예시:
 *   import { canvasToVoxel, voxelToCanvas } from '../utils/coordinates'
 *
 *   // 캔버스 클릭 → 복셀 좌표
 *   const voxel = canvasToVoxel(nv, canvasX, canvasY, currentSlice)
 *
 *   // 복셀 좌표 → 캔버스 위치 (병변 마커 표시용)
 *   const canvas = voxelToCanvas(nv, voxelX, voxelY, voxelZ)
 * ============================================================================
 */

/**
 * NiiVue 인스턴스에서 볼륨 차원 정보 추출
 * @param {Niivue} nv - NiiVue 인스턴스
 * @returns {object} 볼륨 차원 정보
 */
export function getVolumeDimensions(nv) {
  if (!nv || !nv.volumes || nv.volumes.length === 0) {
    return null
  }

  const vol = nv.volumes[0]
  return {
    dimX: vol.dims[1],
    dimY: vol.dims[2],
    dimZ: vol.dims[3],
    spacingX: vol.pixDims ? vol.pixDims[1] : 1,
    spacingY: vol.pixDims ? vol.pixDims[2] : 1,
    spacingZ: vol.pixDims ? vol.pixDims[3] : 1
  }
}

/**
 * 캔버스 픽셀 좌표를 복셀 좌표로 변환
 * @param {Niivue} nv - NiiVue 인스턴스
 * @param {number} canvasX - 캔버스 X 좌표 (픽셀)
 * @param {number} canvasY - 캔버스 Y 좌표 (픽셀)
 * @param {number} currentSlice - 현재 Z 슬라이스 인덱스
 * @returns {object} 복셀 좌표 {x, y, z}
 */
export function canvasToVoxel(nv, canvasX, canvasY, currentSlice) {
  if (!nv || !nv.canvas) {
    console.warn('NiiVue instance or canvas not available')
    return { x: 0, y: 0, z: currentSlice }
  }

  const dims = getVolumeDimensions(nv)
  if (!dims) {
    console.warn('Volume dimensions not available')
    return { x: 0, y: 0, z: currentSlice }
  }

  // 캔버스 크기
  const canvasWidth = nv.canvas.width
  const canvasHeight = nv.canvas.height

  // 캔버스 좌표를 정규화된 분수로 변환 (0-1)
  const fracX = canvasX / canvasWidth
  const fracY = canvasY / canvasHeight

  // 복셀 좌표로 변환 (Y축 반전 필요 - 의료 영상 규약)
  const voxelX = Math.round(fracX * (dims.dimX - 1))
  const voxelY = Math.round((1 - fracY) * (dims.dimY - 1))

  return {
    x: Math.max(0, Math.min(voxelX, dims.dimX - 1)),
    y: Math.max(0, Math.min(voxelY, dims.dimY - 1)),
    z: currentSlice
  }
}

/**
 * 복셀 좌표를 캔버스 픽셀 좌표로 변환
 * @param {Niivue} nv - NiiVue 인스턴스
 * @param {number} voxelX - 복셀 X 좌표
 * @param {number} voxelY - 복셀 Y 좌표
 * @param {number} voxelZ - 복셀 Z 좌표 (슬라이스)
 * @returns {object} 캔버스 좌표 {x, y, visible}
 */
export function voxelToCanvas(nv, voxelX, voxelY, voxelZ) {
  if (!nv || !nv.canvas) {
    return { x: 0, y: 0, visible: false }
  }

  const dims = getVolumeDimensions(nv)
  if (!dims) {
    return { x: 0, y: 0, visible: false }
  }

  // 캔버스 크기
  const canvasWidth = nv.canvas.width
  const canvasHeight = nv.canvas.height

  // 복셀 좌표를 정규화 (0-1)
  const fracX = voxelX / (dims.dimX - 1)
  const fracY = voxelY / (dims.dimY - 1)

  // 캔버스 좌표로 변환 (Y축 반전)
  const canvasX = Math.round(fracX * canvasWidth)
  const canvasY = Math.round((1 - fracY) * canvasHeight)

  return {
    x: canvasX,
    y: canvasY,
    visible: true
  }
}

/**
 * NiiVue의 위치 변경 이벤트에서 현재 슬라이스 추출
 * @param {object} locationData - NiiVue onLocationChange 이벤트 데이터
 * @returns {number} 현재 Z 슬라이스 인덱스
 */
export function extractSliceFromLocation(locationData) {
  if (!locationData || !locationData.vox) {
    return 0
  }

  // vox[2]가 Z축 슬라이스 인덱스
  return Math.round(locationData.vox[2])
}

/**
 * 병변 배열에서 현재 슬라이스의 병변만 필터링
 * @param {Array} lesions - 전체 병변 배열
 * @param {number} currentSlice - 현재 슬라이스 인덱스
 * @param {number} tolerance - 슬라이스 허용 오차 (기본 0)
 * @returns {Array} 현재 슬라이스의 병변 배열
 */
export function filterLesionsBySlice(lesions, currentSlice, tolerance = 0) {
  if (!lesions || lesions.length === 0) {
    return []
  }

  return lesions.filter(lesion => {
    const diff = Math.abs(lesion.z - currentSlice)
    return diff <= tolerance
  })
}

export default {
  getVolumeDimensions,
  canvasToVoxel,
  voxelToCanvas,
  extractSliceFromLocation,
  filterLesionsBySlice
}
