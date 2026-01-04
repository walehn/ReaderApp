/**
 * ============================================================================
 * Viewer Component - Reader Study Frontend
 * ============================================================================
 * 역할: 2-up 동기화 뷰어 (Baseline + Followup)
 *
 * 기능:
 *   - 좌: Baseline 이미지 (참조용)
 *   - 우: Followup 이미지 (병변 마킹 가능)
 *   - 동기화된 Z-slice 스크롤
 *   - Window/Level 프리셋 토글
 *   - AI 오버레이 (AIDED 모드)
 *
 * Props:
 *   - caseId: 현재 케이스 ID
 *   - readerId: Reader ID
 *   - sessionId: Session ID
 *   - isAided: AIDED 모드 여부
 *   - aiThreshold: AI 임계값
 *   - lesions: 병변 배열
 *   - onAddLesion: 병변 추가 콜백
 *   - currentSlice: 현재 슬라이스
 *   - totalSlices: 전체 슬라이스 수
 *   - onSliceChange: 슬라이스 변경 콜백
 *   - wlPreset: W/L 프리셋
 *   - onToggleWL: W/L 토글 콜백
 *   - aiAvailable: AI 데이터 존재 여부
 *
 * 사용 예시:
 *   <Viewer
 *     caseId="case_0001"
 *     readerId="R01"
 *     sessionId="S1"
 *     isAided={true}
 *   />
 * ============================================================================
 */

import { useState, useCallback } from 'react'
import SliceCanvas from './SliceCanvas'
import { api } from '../services/api'

export function Viewer({
  caseId,
  readerId,
  sessionId,
  isAided = false,
  aiThreshold = 0.30,
  lesions = [],
  onAddLesion,
  currentSlice = 0,
  totalSlices = 0,
  onSliceChange,
  wlPreset = 'liver',
  onToggleWL,
  aiAvailable = false,
}) {
  const [showOverlay, setShowOverlay] = useState(false)

  // 슬라이스 URL 생성
  const baselineUrl = caseId
    ? api.getSliceUrl(caseId, 'baseline', currentSlice, wlPreset)
    : null
  const followupUrl = caseId
    ? api.getSliceUrl(caseId, 'followup', currentSlice, wlPreset)
    : null

  // 오버레이 URL (AIDED 모드 + AI 데이터 있을 때만)
  const overlayUrl = (caseId && isAided && aiAvailable)
    ? api.getOverlayUrl(caseId, currentSlice, readerId, sessionId, aiThreshold)
    : null

  // 마우스 휠로 슬라이스 변경
  const handleWheel = useCallback((delta) => {
    if (!onSliceChange) return
    const newSlice = currentSlice + (delta > 0 ? -1 : 1)
    onSliceChange(Math.max(0, Math.min(newSlice, totalSlices - 1)))
  }, [currentSlice, totalSlices, onSliceChange])

  // 슬라이더 변경
  const handleSliderChange = (e) => {
    if (onSliceChange) {
      onSliceChange(parseInt(e.target.value, 10))
    }
  }

  if (!caseId) {
    return (
      <div className="flex items-center justify-center h-96 bg-medical-darker rounded-lg">
        <p className="text-gray-500">케이스를 선택해주세요</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 2-up 뷰어 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Baseline (좌) */}
        <div className="space-y-2">
          <SliceCanvas
            imageUrl={baselineUrl}
            lesions={[]} // Baseline에는 병변 표시 안함
            currentSlice={currentSlice}
            onWheel={handleWheel}
            isInteractive={false}
            label="Baseline"
          />
        </div>

        {/* Followup (우) */}
        <div className="space-y-2">
          <SliceCanvas
            imageUrl={followupUrl}
            overlayUrl={overlayUrl}
            showOverlay={showOverlay && isAided}
            lesions={lesions}
            currentSlice={currentSlice}
            onAddLesion={onAddLesion}
            onWheel={handleWheel}
            isInteractive={true}
            label="Follow-up"
          />
        </div>
      </div>

      {/* 컨트롤 바 */}
      <div className="bg-medical-dark rounded-lg p-4 space-y-3">
        {/* 슬라이스 슬라이더 */}
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm w-20">Slice</span>
          <input
            type="range"
            min={0}
            max={totalSlices - 1}
            value={currentSlice}
            onChange={handleSliderChange}
            className="flex-1 accent-primary-500"
          />
          <span className="text-white font-mono text-sm w-24 text-right">
            {currentSlice + 1} / {totalSlices}
          </span>
        </div>

        {/* 추가 컨트롤 */}
        <div className="flex items-center justify-between">
          {/* W/L 토글 */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">W/L:</span>
            <button
              onClick={onToggleWL}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                wlPreset === 'liver'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Liver
            </button>
            <button
              onClick={onToggleWL}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                wlPreset === 'soft'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Soft
            </button>
          </div>

          {/* AI 오버레이 토글 (AIDED 모드만) */}
          {isAided && aiAvailable && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">AI Overlay:</span>
              <button
                onClick={() => setShowOverlay(!showOverlay)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  showOverlay
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {showOverlay ? 'ON' : 'OFF'}
              </button>
            </div>
          )}

          {/* 마우스 휠 안내 */}
          <span className="text-gray-500 text-xs">
            마우스 휠로 슬라이스 이동
          </span>
        </div>
      </div>
    </div>
  )
}

export default Viewer
