/**
 * ============================================================================
 * SliceCanvas Component - Reader Study Frontend
 * ============================================================================
 * 역할: 캔버스 기반 슬라이스 이미지 표시 및 병변 마커 렌더링
 *
 * Props:
 *   - imageUrl: 슬라이스 이미지 URL
 *   - overlayUrl: AI 오버레이 URL (선택)
 *   - showOverlay: 오버레이 표시 여부
 *   - lesions: 병변 마커 배열
 *   - currentSlice: 현재 슬라이스 (병변 필터링용)
 *   - onAddLesion: 병변 추가 콜백 (x, y)
 *   - onWheel: 마우스 휠 콜백
 *   - isInteractive: 클릭 가능 여부
 *   - label: 캔버스 라벨 (Baseline/Followup)
 *
 * 사용 예시:
 *   <SliceCanvas
 *     imageUrl="/api/render/slice?..."
 *     lesions={lesions}
 *     onAddLesion={(x, y) => addLesion(x, y)}
 *   />
 * ============================================================================
 */

import { useRef, useEffect, useState, useCallback } from 'react'

const CANVAS_SIZE = 512

export function SliceCanvas({
  imageUrl,
  overlayUrl = null,
  showOverlay = false,
  lesions = [],
  currentSlice = 0,
  onAddLesion = null,
  onWheel = null,
  isInteractive = false,
  label = '',
  // W/L 드래그 관련
  wlDragEnabled = false,
  onWLChange = null,
  customWL = { center: 40, width: 400 },
}) {
  const canvasRef = useRef(null)
  const [image, setImage] = useState(null)
  const [overlay, setOverlay] = useState(null)
  const [imageLoading, setImageLoading] = useState(false)

  // W/L 드래그 상태
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const startWLRef = useRef({ center: 50, width: 150 })

  // 이미지 로드
  useEffect(() => {
    if (!imageUrl) return

    let cancelled = false
    setImageLoading(true)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!cancelled) {
        setImage(img)
        setImageLoading(false)
      }
    }
    img.onerror = () => {
      if (!cancelled) {
        setImageLoading(false)
        console.error('Failed to load image:', imageUrl)
      }
    }
    img.src = imageUrl

    // cleanup: 이전 이미지 로드 중단 및 메모리 해제
    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
      img.src = ''  // 로드 중단
    }
  }, [imageUrl])

  // 오버레이 로드
  useEffect(() => {
    if (!overlayUrl || !showOverlay) {
      setOverlay(null)
      return
    }

    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!cancelled) setOverlay(img)
    }
    img.onerror = () => {
      if (!cancelled) setOverlay(null)
    }
    img.src = overlayUrl

    // cleanup: 이전 오버레이 로드 중단 및 메모리 해제
    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
      img.src = ''
    }
  }, [overlayUrl, showOverlay])

  // 캔버스 그리기
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // 배경 (검정)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // 이미지 그리기
    if (image) {
      ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
    }

    // 오버레이 그리기
    if (overlay && showOverlay) {
      ctx.drawImage(overlay, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
    }

    // 병변 마커 그리기 (현재 슬라이스만)
    const currentLesions = lesions.filter(l => l.z === currentSlice)
    currentLesions.forEach((lesion, index) => {
      drawLesionMarker(ctx, lesion, index + 1)
    })

    // 라벨 그리기
    if (label) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(5, 5, 90, 25)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText(label, 10, 22)
    }

  }, [image, overlay, showOverlay, lesions, currentSlice, label])

  // 병변 마커 그리기
  const drawLesionMarker = (ctx, lesion, number) => {
    const { x, y, confidence } = lesion

    // 색상 (confidence별)
    const colors = {
      definite: '#ef4444',   // 빨강
      probable: '#f59e0b',   // 주황
      possible: '#22c55e',   // 초록
    }
    const color = colors[confidence] || '#f59e0b'

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
    ctx.fillText(number.toString(), x + 18, y - 10)
  }

  // 클릭 이벤트 핸들러
  const handleClick = useCallback((e) => {
    // W/L 드래그 중이면 클릭 무시
    if (isDragging) return
    if (!isInteractive || !onAddLesion) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_SIZE / rect.width
    const scaleY = CANVAS_SIZE / rect.height

    const x = Math.round((e.clientX - rect.left) * scaleX)
    const y = Math.round((e.clientY - rect.top) * scaleY)

    onAddLesion(x, y)
  }, [isInteractive, onAddLesion, isDragging])

  // 마우스 휠 핸들러
  const handleWheel = useCallback((e) => {
    if (!onWheel) return
    e.preventDefault()
    onWheel(e.deltaY)
  }, [onWheel])

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

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={`bg-black ${
          wlDragEnabled
            ? 'cursor-move'
            : isInteractive
              ? 'cursor-crosshair'
              : 'cursor-default'
        }`}
        style={{ width: '100%', maxWidth: CANVAS_SIZE, aspectRatio: '1/1' }}
      />
      {imageLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white">Loading...</div>
        </div>
      )}
    </div>
  )
}

export default SliceCanvas
