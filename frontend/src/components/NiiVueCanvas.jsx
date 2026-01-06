/**
 * ============================================================================
 * NiiVueCanvas Component - Reader Study
 * ============================================================================
 * 역할: NiiVue WebGL 기반 NIfTI 이미지 렌더링
 *
 * 기능:
 *   - NIfTI 볼륨 WebGL 렌더링 (NiiVue)
 *   - 슬라이스 네비게이션 (마우스 휠, 키보드)
 *   - Window/Level 프리셋 적용
 *   - 병변 마커 오버레이 렌더링
 *   - 클릭으로 병변 추가 (복셀 좌표)
 *   - 2-up 동기화 지원
 *
 * Props:
 *   - caseId: 케이스 ID
 *   - series: 'baseline' | 'followup'
 *   - currentSlice: 현재 Z 슬라이스 (외부 제어)
 *   - onSliceChange: 슬라이스 변경 콜백
 *   - wlPreset: Window/Level 프리셋 ('liver' | 'soft')
 *   - lesions: 병변 배열 [{x, y, z, confidence}, ...]
 *   - onAddLesion: 병변 추가 콜백 (복셀 좌표)
 *   - isInteractive: 클릭 상호작용 여부
 *   - label: 캔버스 라벨 ('Baseline' | 'Follow-up')
 *
 * 사용 예시:
 *   <NiiVueCanvas
 *     caseId="pos_enriched_001_10667525"
 *     series="followup"
 *     currentSlice={50}
 *     onSliceChange={setSlice}
 *     wlPreset="liver"
 *     lesions={lesions}
 *     onAddLesion={handleAddLesion}
 *     isInteractive={true}
 *     label="Follow-up"
 *   />
 * ============================================================================
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Niivue, SLICE_TYPE } from '@niivue/niivue'
import { canvasToVoxel, voxelToCanvas, filterLesionsBySlice } from '../utils/coordinates'

// Window/Level 프리셋 (백엔드와 동일)
const WL_PRESETS = {
  liver: { center: 50, width: 150 },
  soft: { center: 40, width: 400 }
}

// API 기본 URL
const API_BASE = 'http://localhost:8000'

export function NiiVueCanvas({
  caseId,
  series,
  currentSlice = 0,
  onSliceChange,
  wlPreset = 'liver',
  lesions = [],
  onAddLesion,
  isInteractive = false,
  label = '',
  overlayUrl = null,
  showOverlay = false,
  aiThreshold = 0.30
}) {
  const canvasRef = useRef(null)
  const nvRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [volumeLoaded, setVolumeLoaded] = useState(false)
  const [maxSlice, setMaxSlice] = useState(0)

  // NIfTI 볼륨 URL 생성
  const volumeUrl = useMemo(() => {
    if (!caseId || !series) return null
    return `${API_BASE}/nifti/volume?case_id=${caseId}&series=${series}`
  }, [caseId, series])

  // NiiVue 초기화 및 볼륨 로드
  useEffect(() => {
    if (!canvasRef.current || !volumeUrl) return

    let mounted = true
    setLoading(true)
    setError(null)

    const initNiiVue = async () => {
      try {
        // 기존 인스턴스 정리
        if (nvRef.current) {
          nvRef.current = null
        }

        // NiiVue 인스턴스 생성
        const nv = new Niivue({
          backColor: [0, 0, 0, 1],           // 검은 배경
          crosshairColor: [1, 0.5, 0, 1],    // 주황색 십자선
          crosshairWidth: 0,                  // 십자선 숨김
          show3Dcrosshair: false,
          isRadiologicalConvention: true,    // 방사선 규약
          dragMode: 0,                        // 드래그 비활성화
          multiplanarForceRender: false
        })

        // 캔버스 연결
        await nv.attachToCanvas(canvasRef.current)

        // 볼륨 로드
        await nv.loadVolumes([{ url: volumeUrl }])

        if (!mounted) return

        // 볼륨 정보 추출
        if (nv.volumes && nv.volumes.length > 0) {
          const vol = nv.volumes[0]
          const numSlices = vol.dims[3]
          setMaxSlice(numSlices - 1)

          // Window/Level 적용
          const preset = WL_PRESETS[wlPreset]
          vol.cal_min = preset.center - preset.width / 2
          vol.cal_max = preset.center + preset.width / 2
          nv.updateGLVolume()

          // Axial 뷰로 설정
          nv.setSliceType(SLICE_TYPE.AXIAL)

          // 초기 슬라이스 설정
          if (currentSlice > 0 && currentSlice < numSlices) {
            nv.scene.crosshairPos[2] = currentSlice / (numSlices - 1)
            nv.drawScene()
          }
        }

        nvRef.current = nv
        setVolumeLoaded(true)
        setLoading(false)

        // 슬라이스 변경 콜백 설정
        nv.onLocationChange = (data) => {
          if (data && data.vox && onSliceChange) {
            const slice = Math.round(data.vox[2])
            onSliceChange(slice)
          }
        }

      } catch (err) {
        console.error('NiiVue initialization error:', err)
        if (mounted) {
          setError(err.message || 'Failed to load NIfTI volume')
          setLoading(false)
        }
      }
    }

    initNiiVue()

    return () => {
      mounted = false
      if (nvRef.current) {
        nvRef.current = null
      }
    }
  }, [volumeUrl])

  // Window/Level 프리셋 변경
  useEffect(() => {
    const nv = nvRef.current
    if (!nv || !volumeLoaded || !nv.volumes || nv.volumes.length === 0) return

    const vol = nv.volumes[0]
    const preset = WL_PRESETS[wlPreset]
    vol.cal_min = preset.center - preset.width / 2
    vol.cal_max = preset.center + preset.width / 2
    nv.updateGLVolume()
  }, [wlPreset, volumeLoaded])

  // 외부에서 슬라이스 변경 시 동기화
  useEffect(() => {
    const nv = nvRef.current
    if (!nv || !volumeLoaded || maxSlice === 0) return

    // 현재 NiiVue 슬라이스와 다를 때만 업데이트
    const currentNvSlice = Math.round(nv.scene.crosshairPos[2] * maxSlice)
    if (currentNvSlice !== currentSlice) {
      nv.scene.crosshairPos[2] = currentSlice / maxSlice
      nv.drawScene()
    }
  }, [currentSlice, volumeLoaded, maxSlice])

  // 마우스 휠 핸들러
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (!onSliceChange || maxSlice === 0) return

    const delta = e.deltaY > 0 ? -1 : 1
    const newSlice = Math.max(0, Math.min(currentSlice + delta, maxSlice))
    onSliceChange(newSlice)
  }, [currentSlice, maxSlice, onSliceChange])

  // 캔버스 클릭 핸들러 (병변 추가)
  const handleClick = useCallback((e) => {
    if (!isInteractive || !onAddLesion || !nvRef.current) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    // 캔버스 좌표를 복셀 좌표로 변환
    const voxel = canvasToVoxel(nvRef.current, canvasX, canvasY, currentSlice)
    onAddLesion(voxel.x, voxel.y, voxel.z)
  }, [isInteractive, onAddLesion, currentSlice])

  // 현재 슬라이스의 병변 필터링
  const currentLesions = useMemo(() => {
    return filterLesionsBySlice(lesions, currentSlice)
  }, [lesions, currentSlice])

  // 병변 마커 오버레이 렌더링
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current
    const mainCanvas = canvasRef.current
    if (!overlayCanvas || !mainCanvas || !nvRef.current) return

    // 오버레이 캔버스 크기 동기화
    overlayCanvas.width = mainCanvas.clientWidth
    overlayCanvas.height = mainCanvas.clientHeight

    const ctx = overlayCanvas.getContext('2d')
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

    // 라벨 그리기
    if (label) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(5, 5, 90, 25)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText(label, 10, 22)
    }

    // 병변 마커 그리기
    currentLesions.forEach((lesion, index) => {
      const canvasPos = voxelToCanvas(nvRef.current, lesion.x, lesion.y, lesion.z)
      if (!canvasPos.visible) return

      // 스케일링 (캔버스 크기에 맞춤)
      const scaleX = overlayCanvas.width / mainCanvas.width
      const scaleY = overlayCanvas.height / mainCanvas.height
      const x = canvasPos.x * scaleX
      const y = canvasPos.y * scaleY

      // 색상 (confidence별)
      const colors = {
        definite: '#ef4444',
        probable: '#f59e0b',
        possible: '#22c55e'
      }
      const color = colors[lesion.confidence] || '#f59e0b'

      // 원 그리기
      ctx.beginPath()
      ctx.arc(x, y, 15, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.stroke()

      // 십자선
      ctx.beginPath()
      ctx.moveTo(x - 8, y)
      ctx.lineTo(x + 8, y)
      ctx.moveTo(x, y - 8)
      ctx.lineTo(x, y + 8)
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()

      // 번호
      ctx.fillStyle = color
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText((index + 1).toString(), x + 18, y - 10)
    })
  }, [currentLesions, label, volumeLoaded])

  return (
    <div className="relative" style={{ aspectRatio: '1/1', width: '100%' }}>
      {/* NiiVue 캔버스 */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onClick={handleClick}
        className={`w-full h-full bg-black ${isInteractive ? 'cursor-crosshair' : 'cursor-default'}`}
        style={{ display: 'block' }}
      />

      {/* 병변 마커 오버레이 캔버스 */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* 로딩 인디케이터 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
            <span>Loading...</span>
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
          <div className="text-red-500 text-center p-4">
            <p className="font-bold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* 슬라이스 정보 표시 */}
      {volumeLoaded && (
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
          {currentSlice + 1} / {maxSlice + 1}
        </div>
      )}
    </div>
  )
}

export default NiiVueCanvas
