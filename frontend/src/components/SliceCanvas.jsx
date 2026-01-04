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
}) {
  const canvasRef = useRef(null)
  const [image, setImage] = useState(null)
  const [overlay, setOverlay] = useState(null)
  const [imageLoading, setImageLoading] = useState(false)

  // 이미지 로드
  useEffect(() => {
    if (!imageUrl) return

    setImageLoading(true)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setImage(img)
      setImageLoading(false)
    }
    img.onerror = () => {
      setImageLoading(false)
      console.error('Failed to load image:', imageUrl)
    }
    img.src = imageUrl
  }, [imageUrl])

  // 오버레이 로드
  useEffect(() => {
    if (!overlayUrl || !showOverlay) {
      setOverlay(null)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setOverlay(img)
    img.onerror = () => setOverlay(null)
    img.src = overlayUrl
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
    if (!isInteractive || !onAddLesion) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_SIZE / rect.width
    const scaleY = CANVAS_SIZE / rect.height

    const x = Math.round((e.clientX - rect.left) * scaleX)
    const y = Math.round((e.clientY - rect.top) * scaleY)

    onAddLesion(x, y)
  }, [isInteractive, onAddLesion])

  // 마우스 휠 핸들러
  const handleWheel = useCallback((e) => {
    if (!onWheel) return
    e.preventDefault()
    onWheel(e.deltaY)
  }, [onWheel])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        onClick={handleClick}
        onWheel={handleWheel}
        className={`bg-black ${isInteractive ? 'cursor-crosshair' : 'cursor-default'}`}
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
