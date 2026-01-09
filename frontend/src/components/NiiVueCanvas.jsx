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
 *   - AI 오버레이 (NIfTI 직접 로드, Liver=녹색, Metastasis=빨간색)
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
 *   - readerId: Reader ID (AI 오버레이용)
 *   - sessionId: Session ID (AI 오버레이용)
 *   - showOverlay: AI 오버레이 표시 여부
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
 *     readerId="R01"
 *     sessionId="S1"
 *     showOverlay={true}
 *   />
 * ============================================================================
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Niivue, SLICE_TYPE } from '@niivue/niivue'
import { canvasToVoxel, voxelToCanvas, filterLesionsBySlice } from '../utils/coordinates'

// Stale closure 방지를 위한 ref 패턴
// NiiVue의 onLocationChange 콜백이 초기화 시점의 함수를 캡처하는 문제 해결

/**
 * NiiVue 메모리 관리 - 인스턴스 재사용 패턴
 *
 * ★ 핵심 전략: NiiVue 인스턴스는 1회만 생성, 볼륨만 교체
 *
 * 이전 문제:
 *   - 케이스 전환 시 새 인스턴스 생성 → 메모리 누적 (172MB → 430MB → 889MB)
 *   - loadVolumes()는 this.volumes = [] 만 호출 (메모리 정리 안 됨)
 *   - loseContext() 호출해도 TypedArray(볼륨 데이터)는 GC 안 됨
 *
 * 해결책:
 *   1. 인스턴스는 컴포넌트 마운트 시 1회만 생성
 *   2. 볼륨 교체: removeVolumeByIndex() + addVolumeFromUrl() 사용
 *   3. WebGL 컨텍스트 재사용 (loseContext는 언마운트 시에만)
 *
 * 메모리 영향:
 *   - removeVolumeByIndex(i): ✅ GPU/CPU 리소스 해제
 *   - addVolumeFromUrl(opts): ✅ 기존 인스턴스에 볼륨 추가
 *   - loadVolumes([...]): ⚠️ 메모리 정리 안 됨 (사용 금지!)
 */

// Window/Level 프리셋 (백엔드와 동일)
const WL_PRESETS = {
  liver: { center: 50, width: 150 },
  soft: { center: 40, width: 400 }
}

// API 기본 URL (Docker 환경에서는 Nginx 프록시 사용)
const API_BASE = '/api'

export function NiiVueCanvas({
  caseId,
  series,
  currentSlice = 0,
  onSliceChange,
  wlPreset = 'liver',
  customWL = { center: 40, width: 400 },
  wlMode = 'preset',
  lesions = [],
  onAddLesion,
  isInteractive = false,
  label = '',
  // AI 오버레이 관련 (NIfTI 직접 로드)
  readerId = null,
  sessionId = null,
  showOverlay = false,
  aiThreshold = 0.30,
  // W/L 드래그 관련
  wlDragEnabled = false,
  onWLChange,
  // Z축 방향 반전 (affine matrix 기반 자동 감지)
  zFlipped = false
}) {
  const canvasRef = useRef(null)
  const nvRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const onSliceChangeRef = useRef(onSliceChange)  // 최신 콜백 참조용
  const lastSliceRef = useRef(null)  // 중복 호출 방지용
  const zFlippedRef = useRef(zFlipped)  // Z축 반전 상태 (콜백에서 사용)
  const maxSliceRef = useRef(0)  // 최대 슬라이스 (콜백에서 사용)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [volumeLoaded, setVolumeLoaded] = useState(false)
  const [maxSlice, setMaxSlice] = useState(0)
  const [instanceReady, setInstanceReady] = useState(false)  // NiiVue 인스턴스 준비 상태

  // W/L 드래그 상태
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const startWLRef = useRef({ center: 50, width: 150 })

  // onSliceChange 변경 시 ref 업데이트 (stale closure 방지)
  useEffect(() => {
    onSliceChangeRef.current = onSliceChange
  }, [onSliceChange])

  // zFlipped 변경 시 ref 업데이트 (onLocationChange 콜백에서 사용)
  useEffect(() => {
    zFlippedRef.current = zFlipped
  }, [zFlipped])

  // NIfTI 볼륨 URL 생성
  const volumeUrl = useMemo(() => {
    if (!caseId || !series) return null
    return `${API_BASE}/nifti/volume?case_id=${caseId}&series=${series}`
  }, [caseId, series])

  // AI Overlay NIfTI URL 생성 (NiiVue 직접 로드용)
  const aiOverlayNiftiUrl = useMemo(() => {
    if (!caseId || !showOverlay || !readerId || !sessionId) return null
    return `${API_BASE}/nifti/overlay?case_id=${caseId}&reader_id=${readerId}&session_id=${sessionId}`
  }, [caseId, showOverlay, readerId, sessionId])

  // =========================================================================
  // useEffect 1: NiiVue 인스턴스 생성 (컴포넌트 마운트 시 1회만)
  // =========================================================================
  useEffect(() => {
    if (!canvasRef.current) return

    let mounted = true

    const createInstance = async () => {
      try {
        // NiiVue 인스턴스 생성 (1회만)
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

        if (!mounted) return

        nvRef.current = nv
        setInstanceReady(true)
        console.log('[NiiVue] Instance created (once)')

        // 슬라이스 변경 콜백 설정 (ref를 통해 항상 최신 함수 호출)
        // ★ 중복 호출 방지: NiiVue가 한 번의 휠에 여러 번 호출할 수 있으므로
        //    같은 슬라이스 값이면 무시하여 delta 기반 동기화 버그 방지
        // ★ Z축 반전: zFlipped면 NiiVue 슬라이스를 논리적 슬라이스로 역변환
        nv.onLocationChange = (data) => {
          if (data && data.vox && onSliceChangeRef.current) {
            const rawSlice = Math.round(data.vox[2])

            // Z축 반전: NiiVue는 원본 인덱스 → 논리적 인덱스로 변환
            const maxS = maxSliceRef.current
            const logicalSlice = zFlippedRef.current && maxS > 0
              ? maxS - rawSlice
              : rawSlice

            // 같은 슬라이스 값이면 콜백 호출 안 함 (중복 방지)
            if (lastSliceRef.current === logicalSlice) return
            lastSliceRef.current = logicalSlice

            onSliceChangeRef.current(logicalSlice)
          }
        }
      } catch (err) {
        console.error('[NiiVue] Instance creation error:', err)
        if (mounted) {
          setError(err.message || 'Failed to create NiiVue instance')
          setLoading(false)
        }
      }
    }

    createInstance()

    // 컴포넌트 언마운트 시에만 cleanup (볼륨 제거 + WebGL 컨텍스트 해제)
    return () => {
      mounted = false
      if (nvRef.current) {
        try {
          const nv = nvRef.current

          // 1. 콜백 제거
          nv.onLocationChange = null

          // 2. 볼륨 역순 제거 (TypedArray 메모리 해제)
          // ★ 메모리 최적화: removeVolumeByIndex()로 GPU/CPU 리소스 명시적 해제
          if (nv.volumes && nv.volumes.length > 0) {
            console.log('[NiiVue] Removing', nv.volumes.length, 'volumes on unmount')
            while (nv.volumes.length > 0) {
              nv.removeVolumeByIndex(nv.volumes.length - 1)
            }
          }

          // 3. WebGL 컨텍스트 강제 손실 (GPU 리소스 반환)
          const ext = nv.gl?.getExtension('WEBGL_lose_context')
          if (ext) {
            ext.loseContext()
            console.log('[NiiVue] loseContext() called - instance destroyed')
          }
        } catch (e) {
          console.warn('[NiiVue] Cleanup error:', e)
        }
        nvRef.current = null
        setInstanceReady(false)
      }
    }
  }, [])  // 빈 의존성 - 마운트 시 1회만 실행

  // =========================================================================
  // useEffect 2: 볼륨 로드/교체 (volumeUrl 변경 시)
  // =========================================================================
  useEffect(() => {
    const nv = nvRef.current
    if (!nv || !instanceReady || !volumeUrl) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setVolumeLoaded(false)

    const loadVolume = async () => {
      try {
        // 기존 모든 볼륨 제거 (역순으로 안전하게 - GPU/CPU 리소스 해제)
        while (nv.volumes && nv.volumes.length > 0) {
          nv.removeVolumeByIndex(nv.volumes.length - 1)
        }
        console.log('[NiiVue] Old volumes removed')

        if (cancelled) return

        // 새 볼륨 추가 (기존 인스턴스에 추가)
        await nv.addVolumeFromUrl({
          url: volumeUrl,
          name: `${caseId}_${series}.nii.gz`
        })

        if (cancelled) return

        // 볼륨 정보 추출 및 설정
        if (nv.volumes && nv.volumes.length > 0) {
          const vol = nv.volumes[0]
          const numSlices = vol.dims[3]
          const newMaxSlice = numSlices - 1
          setMaxSlice(newMaxSlice)
          maxSliceRef.current = newMaxSlice  // ref도 업데이트 (콜백에서 사용)

          // Window/Level 적용
          const preset = WL_PRESETS[wlPreset]
          vol.cal_min = preset.center - preset.width / 2
          vol.cal_max = preset.center + preset.width / 2
          nv.updateGLVolume()

          // Axial 뷰로 설정
          nv.setSliceType(SLICE_TYPE.AXIAL)

          // 초기 슬라이스 설정 (항상 첫 번째 슬라이스로 시작)
          // crosshairPos[2]는 0~1 사이 비율 (0 = 첫 슬라이스, 1 = 마지막 슬라이스)
          // ★ Z축 반전: 논리적 슬라이스 → NiiVue 원본 인덱스로 변환
          if (numSlices > 1) {
            const nvSlice = zFlippedRef.current
              ? newMaxSlice - currentSlice  // 반전: 논리적 0 → NiiVue maxSlice
              : currentSlice
            nv.scene.crosshairPos[2] = nvSlice / newMaxSlice
            nv.drawScene()
          }
        }

        setVolumeLoaded(true)
        setLoading(false)
        console.log('[NiiVue] New volume loaded:', caseId, series)

      } catch (err) {
        console.error('[NiiVue] Volume load error:', err)
        if (!cancelled) {
          setError(err.message || 'Failed to load NIfTI volume')
          setLoading(false)
        }
      }
    }

    loadVolume()

    return () => {
      cancelled = true
    }
  }, [volumeUrl, instanceReady])  // volumeUrl 또는 인스턴스 준비 상태 변경 시 실행

  // Window/Level 변경 (프리셋 또는 커스텀)
  useEffect(() => {
    const nv = nvRef.current
    if (!nv || !volumeLoaded || !nv.volumes || nv.volumes.length === 0) return

    const vol = nv.volumes[0]
    // wlMode에 따라 프리셋 또는 커스텀 값 사용
    const wl = wlMode === 'preset' ? WL_PRESETS[wlPreset] : customWL
    vol.cal_min = wl.center - wl.width / 2
    vol.cal_max = wl.center + wl.width / 2
    nv.updateGLVolume()
  }, [wlPreset, customWL, wlMode, volumeLoaded])

  // 외부에서 슬라이스 변경 시 동기화
  // ★ Z축 반전: 논리적 슬라이스 → NiiVue 원본 인덱스로 변환
  useEffect(() => {
    const nv = nvRef.current
    if (!nv || !volumeLoaded || maxSlice === 0) return

    // 논리적 슬라이스를 NiiVue 원본 인덱스로 변환
    const targetNvSlice = zFlipped
      ? maxSlice - currentSlice  // 반전: 논리적 0 → NiiVue maxSlice
      : currentSlice

    // 현재 NiiVue 슬라이스와 다를 때만 업데이트
    const currentNvSlice = Math.round(nv.scene.crosshairPos[2] * maxSlice)
    if (currentNvSlice !== targetNvSlice) {
      nv.scene.crosshairPos[2] = targetNvSlice / maxSlice
      nv.drawScene()
    }
  }, [currentSlice, volumeLoaded, maxSlice, zFlipped])

  // AI Overlay NIfTI 로드 (NiiVue 오버레이 볼륨)
  // - Liver mask (label=1): 녹색
  // - Metastasis (label=2): 빨간색
  // ★ 메모리 최적화: cancelled 플래그로 케이스 전환 시 stale 요청 무시
  // ★ Race Condition 방지: 기본 볼륨이 실제로 로드되었는지 확인
  useEffect(() => {
    const nv = nvRef.current
    if (!nv || !volumeLoaded) return

    // ★ 핵심 수정: 기본 볼륨이 실제로 존재하는지 확인
    // 케이스 전환 시 volumeLoaded 상태는 이전 렌더의 값(true)을 사용할 수 있으므로
    // 실제 nv.volumes 배열을 확인하여 Race Condition 방지
    if (!nv.volumes || nv.volumes.length === 0) {
      console.log('[NiiVue] Base volume not ready, skipping overlay load')
      return
    }

    let cancelled = false  // 취소 플래그

    const loadOverlay = async () => {
      // 기존 오버레이 볼륨 제거 (인덱스 기반으로 통일 - 더 안전함)
      // ★ removeVolumeByIndex() 사용으로 일관성 확보
      while (nv.volumes && nv.volumes.length > 1) {
        try {
          nv.removeVolumeByIndex(nv.volumes.length - 1)
        } catch (e) {
          console.warn('[NiiVue] Overlay volume removal failed:', e)
          break  // 무한 루프 방지
        }
      }

      // showOverlay가 false이거나 URL이 없으면 오버레이 없이 렌더링
      if (!showOverlay || !aiOverlayNiftiUrl) {
        nv.updateGLVolume()
        return
      }

      try {
        // 1. Liver mask 오버레이 (label=1, 은은한 녹색)
        await nv.addVolumeFromUrl({
          url: aiOverlayNiftiUrl,
          name: `${caseId}_liver_mask.nii.gz`,
          colormap: 'green',
          opacity: 0.15,  // 은은하게 (CT 가독성 유지)
          cal_min: 0.5,
          cal_max: 1.5
        })

        // 취소 확인 (케이스 전환 시 이전 요청 무시)
        if (cancelled) {
          console.log('[NiiVue] Overlay load cancelled after liver mask')
          return
        }
        console.log('Liver mask overlay loaded (green, opacity=0.15)')

        // 2. Metastasis 오버레이 (label=2, 선명한 빨간색)
        await nv.addVolumeFromUrl({
          url: aiOverlayNiftiUrl,
          name: `${caseId}_metastasis.nii.gz`,
          colormap: 'red',
          opacity: 0.7,  // 강조 (병변 식별 용이)
          cal_min: 1.5,
          cal_max: 2.5
        })

        // 취소 확인
        if (cancelled) {
          console.log('[NiiVue] Overlay load cancelled after metastasis')
          return
        }
        console.log('Metastasis overlay loaded (red, opacity=0.7)')

      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load AI overlay NIfTI:', err)
        }
      }
    }

    loadOverlay()

    // cleanup: 취소 플래그 설정 (케이스 전환/언마운트 시)
    return () => {
      cancelled = true
    }
  }, [aiOverlayNiftiUrl, showOverlay, volumeLoaded, caseId])

  // 마우스 휠 핸들러
  // ★ NiiVue 내부에서 휠 이벤트를 처리하고 onLocationChange로 슬라이스 변경을 알려줌
  // ★ 여기서 중복으로 onSliceChange를 호출하면 동시 스크롤 시 2배 이동 버그 발생
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    // NiiVue가 자체적으로 휠 처리 → onLocationChange 콜백 → 부모에 슬라이스 변경 알림
    // 따라서 여기서 별도로 onSliceChange를 호출하지 않음
  }, [])

  // 캔버스 클릭 핸들러 (병변 추가)
  const handleClick = useCallback((e) => {
    // W/L 드래그 중이면 클릭 무시
    if (isDragging) return
    if (!isInteractive || !onAddLesion || !nvRef.current) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    // CSS 표시 크기에서 내부 캔버스 크기로 스케일링
    // (CSS 크기와 WebGL 렌더링 크기가 다를 수 있음 - devicePixelRatio 등)
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const canvasX = (e.clientX - rect.left) * scaleX
    const canvasY = (e.clientY - rect.top) * scaleY

    // 캔버스 좌표를 복셀 좌표로 변환
    const voxel = canvasToVoxel(nvRef.current, canvasX, canvasY, currentSlice)
    onAddLesion(voxel.x, voxel.y, voxel.z)
  }, [isInteractive, onAddLesion, currentSlice, isDragging])

  // W/L 드래그 시작
  const handleMouseDown = useCallback((e) => {
    if (!wlDragEnabled || !onWLChange) return

    // 좌클릭만 처리
    if (e.button !== 0) return

    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    startWLRef.current = { ...customWL }
  }, [wlDragEnabled, onWLChange, customWL])

  // W/L 드래그 중
  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !onWLChange) return

    const dx = e.clientX - dragStartRef.current.x  // 수평: Width 조정
    const dy = e.clientY - dragStartRef.current.y  // 수직: Level 조정

    // 감도 조정: 드래그 1픽셀당 변화량
    const widthSensitivity = 2
    const centerSensitivity = 1

    const newWidth = Math.max(1, startWLRef.current.width + dx * widthSensitivity)
    const newCenter = startWLRef.current.center - dy * centerSensitivity  // 위로 드래그 = 밝아짐

    onWLChange(newCenter, newWidth)
  }, [isDragging, onWLChange])

  // W/L 드래그 종료
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 마우스가 캔버스를 벗어났을 때도 드래그 종료
  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
    }
  }, [isDragging])

  // 현재 슬라이스의 병변 필터링
  const currentLesions = useMemo(() => {
    return filterLesionsBySlice(lesions, currentSlice)
  }, [lesions, currentSlice])

  // Note: AI Overlay는 이제 NiiVue 볼륨으로 직접 렌더링됨 (PNG 캔버스 방식 제거)

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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={`w-full h-full bg-black ${
          wlDragEnabled
            ? 'cursor-move'
            : isInteractive
              ? 'cursor-crosshair'
              : 'cursor-default'
        }`}
        style={{ display: 'block' }}
      />

      {/* AI Overlay는 NiiVue 볼륨으로 직접 렌더링됨 */}

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
