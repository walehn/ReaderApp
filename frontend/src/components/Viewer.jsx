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
 *   - AI 오버레이 (AIDED 모드, NiiVue에서 직접 렌더링)
 *
 * 렌더링:
 *   - NiiVue (WebGL) 기반 클라이언트 사이드 렌더링
 *   - AI 오버레이: Liver mask(녹색) + Metastasis(빨간색)
 *
 * 디자인:
 *   - 글래스모피즘 카드
 *   - 그라데이션 버튼
 *   - 커스텀 슬라이더
 *
 * 사용 예시:
 *   <Viewer
 *     caseId="pos_enriched_001_10667525"
 *     readerId="R01"
 *     sessionId="S1"
 *     isAided={true}
 *   />
 * ============================================================================
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import NiiVueCanvas from './NiiVueCanvas'
import { api } from '../services/api'

// =============================================================================
// 아이콘 컴포넌트
// =============================================================================

const SyncIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4v5h5M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20.49 9A9 9 0 005.64 5.64L4 7M4 17l1.64 1.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const AiIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4z" />
    <path d="M5 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
  </svg>
)

const WindowIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
)

const DragIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2v20M2 12h20" strokeLinecap="round" />
    <path d="M8 8l4-4 4 4M8 16l4 4 4-4M4 8l-2 4 2 4M20 8l2 4-2 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const KeyboardIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" strokeLinecap="round" />
  </svg>
)

// =============================================================================
// 메인 컴포넌트
// =============================================================================

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
  wlPreset = 'soft',
  onToggleWL,
  aiAvailable = false,
  customWL = { center: 40, width: 400 },
  onWLChange,
  wlMode = 'preset',
  // Z축 방향 반전 (affine matrix 기반 자동 감지, baseline/followup 각각)
  zFlippedBaseline = false,
  zFlippedFollowup = false,
}) {
  // AIDED 모드일 때 AI Overlay 기본 ON
  const [showOverlay, setShowOverlay] = useState(isAided)

  // W/L 드래그 모드 활성화 상태
  const [wlDragEnabled, setWlDragEnabled] = useState(false)

  // 동시 스크롤 모드 상태 (기본값: OFF)
  const [syncScroll, setSyncScroll] = useState(false)

  // Baseline/Followup 개별 슬라이스 상태
  const [baselineSlice, setBaselineSlice] = useState(currentSlice)
  const [followupSlice, setFollowupSlice] = useState(currentSlice)

  // ★ delta 기반 동기화용 ref (마지막 슬라이스 값 추적)
  const lastBaselineRef = useRef(0)
  const lastFollowupRef = useRef(0)

  // 키보드 단축키: 화살표(슬라이스 이동), L(동시 스크롤 토글)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      // L 키: 동시 스크롤 토글
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        setSyncScroll(prev => !prev)
        return
      }

      // 화살표 키: 슬라이스 이동
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return

      e.preventDefault()
      const delta = e.key === 'ArrowUp' ? 1 : -1
      const clamp = (val) => Math.max(0, Math.min(val, totalSlices - 1))

      if (syncScroll) {
        setBaselineSlice(prev => clamp(prev + delta))
        setFollowupSlice(prev => {
          const newVal = clamp(prev + delta)
          onSliceChange?.(newVal)
          return newVal
        })
      } else {
        setFollowupSlice(prev => {
          const newVal = clamp(prev + delta)
          onSliceChange?.(newVal)
          return newVal
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [syncScroll, totalSlices, onSliceChange])

  // caseId 변경 시 슬라이스 초기화 (다음 케이스로 넘어갈 때 1번 슬라이스에서 시작)
  useEffect(() => {
    setBaselineSlice(0)
    setFollowupSlice(0)
    // ★ ref도 함께 초기화 (delta 계산용)
    lastBaselineRef.current = 0
    lastFollowupRef.current = 0
  }, [caseId])

  // Baseline 슬라이스 변경 핸들러
  // ★ delta 기반 동기화: 각자 위치 유지, 변경량만 동시 적용
  const handleBaselineSliceChange = useCallback((newSlice) => {
    const delta = newSlice - lastBaselineRef.current
    lastBaselineRef.current = newSlice
    setBaselineSlice(newSlice)

    // 동시 스크롤 ON이고 실제 변경이 있을 때만 followup도 이동
    if (syncScroll && delta !== 0) {
      const newFollowup = Math.max(0, Math.min(lastFollowupRef.current + delta, totalSlices - 1))
      lastFollowupRef.current = newFollowup
      setFollowupSlice(newFollowup)
    }
  }, [syncScroll, totalSlices])

  // Followup 슬라이스 변경 핸들러
  // ★ delta 기반 동기화: 각자 위치 유지, 변경량만 동시 적용
  const handleFollowupSliceChange = useCallback((newSlice) => {
    const delta = newSlice - lastFollowupRef.current
    lastFollowupRef.current = newSlice
    setFollowupSlice(newSlice)

    // 동시 스크롤 ON이고 실제 변경이 있을 때만 baseline도 이동
    if (syncScroll && delta !== 0) {
      const newBaseline = Math.max(0, Math.min(lastBaselineRef.current + delta, totalSlices - 1))
      lastBaselineRef.current = newBaseline
      setBaselineSlice(newBaseline)
    }
    onSliceChange?.(newSlice)
  }, [syncScroll, totalSlices, onSliceChange])

  // NiiVue용 병변 추가 핸들러
  const handleNiiVueAddLesion = useCallback((x, y, z) => {
    if (onAddLesion) {
      onAddLesion(x, y, z)
    }
  }, [onAddLesion])

  if (!caseId) {
    return (
      <div className="flex items-center justify-center h-96 glass-card rounded-2xl">
        <p className="text-gray-500">케이스를 선택해주세요</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 2-up 뷰어 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Baseline (좌) */}
        <div className="space-y-3">
          <div className="glass-card rounded-xl overflow-hidden">
            <NiiVueCanvas
              key="niivue-baseline"
              caseId={caseId}
              series="baseline"
              currentSlice={baselineSlice}
              onSliceChange={handleBaselineSliceChange}
              wlPreset={wlPreset}
              customWL={customWL}
              wlMode={wlMode}
              lesions={[]}
              isInteractive={false}
              wlDragEnabled={wlDragEnabled}
              onWLChange={onWLChange}
              label="Baseline"
              zFlipped={zFlippedBaseline}
            />
          </div>
          {/* Baseline 슬라이더 */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex-1 relative">
              <input
                type="range"
                min={0}
                max={Math.max(0, totalSlices - 1)}
                value={baselineSlice}
                onChange={(e) => handleBaselineSliceChange(parseInt(e.target.value, 10))}
                disabled={totalSlices === 0}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer disabled:opacity-50
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
                  [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-blue-500/50
                  [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
              />
            </div>
            <span className="text-gray-400 font-mono text-xs w-16 text-right tabular-nums">
              {totalSlices > 0 ? `${baselineSlice + 1}/${totalSlices}` : '-'}
            </span>
          </div>
        </div>

        {/* Followup (우) */}
        <div className="space-y-3">
          <div className="glass-card rounded-xl overflow-hidden">
            <NiiVueCanvas
              key="niivue-followup"
              caseId={caseId}
              series="followup"
              currentSlice={followupSlice}
              onSliceChange={handleFollowupSliceChange}
              wlPreset={wlPreset}
              customWL={customWL}
              wlMode={wlMode}
              lesions={lesions}
              onAddLesion={handleNiiVueAddLesion}
              isInteractive={true}
              wlDragEnabled={wlDragEnabled}
              onWLChange={onWLChange}
              label="Follow-up"
              readerId={readerId}
              sessionId={sessionId}
              showOverlay={showOverlay && isAided && aiAvailable}
              aiThreshold={aiThreshold}
              zFlipped={zFlippedFollowup}
            />
          </div>
          {/* Followup 슬라이더 */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex-1 relative">
              <input
                type="range"
                min={0}
                max={Math.max(0, totalSlices - 1)}
                value={followupSlice}
                onChange={(e) => handleFollowupSliceChange(parseInt(e.target.value, 10))}
                disabled={totalSlices === 0}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer disabled:opacity-50
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500
                  [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-emerald-500/50
                  [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
              />
            </div>
            <span className="text-gray-400 font-mono text-xs w-16 text-right tabular-nums">
              {totalSlices > 0 ? `${followupSlice + 1}/${totalSlices}` : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* 컨트롤 바 */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* W/L 컨트롤 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-gray-400">
              <WindowIcon className="w-4 h-4" />
              <span className="text-sm font-medium">W/L</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleWL}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  wlPreset === 'liver' && wlMode === 'preset'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
                }`}
              >
                Liver
              </button>
              <button
                onClick={onToggleWL}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  wlPreset === 'soft' && wlMode === 'preset'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
                }`}
              >
                Soft
              </button>
              <button
                onClick={() => setWlDragEnabled(!wlDragEnabled)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-1.5 ${
                  wlDragEnabled
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
                }`}
                title="마우스 드래그로 W/L 조정"
              >
                <DragIcon className="w-3.5 h-3.5" />
                드래그
              </button>
            </div>
            <div className={`px-3 py-1.5 rounded-lg text-xs font-mono ${
              wlMode === 'custom'
                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                : 'bg-white/5 text-gray-500 border border-white/5'
            }`}>
              C:{Math.round(customWL.center)} W:{Math.round(customWL.width)}
            </div>
          </div>

          {/* AI 오버레이 토글 */}
          {isAided && aiAvailable && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-gray-400">
                <AiIcon className="w-4 h-4" />
                <span className="text-sm font-medium">AI Overlay</span>
              </div>
              <button
                onClick={() => setShowOverlay(!showOverlay)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                  showOverlay
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/25'
                    : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
                }`}
              >
                {showOverlay ? 'ON' : 'OFF'}
              </button>
            </div>
          )}

          {/* 동시 스크롤 토글 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-gray-400">
              <SyncIcon className="w-4 h-4" />
              <span className="text-sm font-medium">동시 스크롤</span>
            </div>
            <button
              onClick={() => setSyncScroll(!syncScroll)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                syncScroll
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
              }`}
            >
              {syncScroll ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* 단축키 안내 */}
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <KeyboardIcon className="w-4 h-4" />
            <span>↑↓ 슬라이스 | L 동시 스크롤</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Viewer
