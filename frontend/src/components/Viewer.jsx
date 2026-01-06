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
 *   - 하이브리드 렌더링: WebGL(NiiVue) 또는 서버 사이드(PNG) 자동 선택
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
 * 렌더링 모드:
 *   - WebGL (NiiVue): WebGL2 지원 시 자동 선택, 슬라이스 변경 ~1-5ms
 *   - Server (PNG): WebGL 미지원 시 폴백, 슬라이스 변경 ~70-150ms
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

import { useState, useCallback, useMemo, useEffect } from 'react'
import SliceCanvas from './SliceCanvas'
import NiiVueCanvas from './NiiVueCanvas'
import { api } from '../services/api'
import { checkNiiVueSupport } from '../utils/webgl'

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
}) {
  const [showOverlay, setShowOverlay] = useState(false)

  // 동시 스크롤 모드 상태 (기본값: ON)
  const [syncScroll, setSyncScroll] = useState(true)

  // Baseline/Followup 개별 슬라이스 상태
  const [baselineSlice, setBaselineSlice] = useState(currentSlice)
  const [followupSlice, setFollowupSlice] = useState(currentSlice)

  // 외부 currentSlice 변경 시 개별 슬라이스도 동기화
  useEffect(() => {
    if (syncScroll) {
      setBaselineSlice(currentSlice)
      setFollowupSlice(currentSlice)
    }
  }, [currentSlice, syncScroll])

  // WebGL/NiiVue 지원 여부 확인 (한 번만 체크)
  const webglSupport = useMemo(() => checkNiiVueSupport(), [])
  const useWebGL = webglSupport.supported

  // 서버 렌더링용 슬라이스 URL (WebGL 미지원 시 폴백)
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

  // 마우스 휠로 슬라이스 변경 (서버 렌더링용)
  const handleWheel = useCallback((delta) => {
    if (!onSliceChange || totalSlices === 0) return
    const newSlice = currentSlice + (delta > 0 ? -1 : 1)
    onSliceChange(Math.max(0, Math.min(newSlice, totalSlices - 1)))
  }, [currentSlice, totalSlices, onSliceChange])

  // 슬라이더 변경
  const handleSliderChange = (e) => {
    if (onSliceChange) {
      onSliceChange(parseInt(e.target.value, 10))
    }
  }

  // Baseline 슬라이스 변경 핸들러
  const handleBaselineSliceChange = useCallback((slice) => {
    setBaselineSlice(slice)
    if (syncScroll) {
      setFollowupSlice(slice)
      onSliceChange?.(slice)
    }
  }, [syncScroll, onSliceChange])

  // Followup 슬라이스 변경 핸들러
  const handleFollowupSliceChange = useCallback((slice) => {
    setFollowupSlice(slice)
    if (syncScroll) {
      setBaselineSlice(slice)
      onSliceChange?.(slice)
    }
  }, [syncScroll, onSliceChange])

  // NiiVue용 병변 추가 핸들러 (복셀 좌표)
  const handleNiiVueAddLesion = useCallback((x, y, z) => {
    if (onAddLesion) {
      onAddLesion(x, y, z)
    }
  }, [onAddLesion])

  // 서버 렌더링용 병변 추가 핸들러 (캔버스 좌표)
  const handleServerAddLesion = useCallback((x, y) => {
    if (onAddLesion) {
      // 서버 렌더링에서는 z 좌표가 currentSlice
      onAddLesion(x, y, currentSlice)
    }
  }, [onAddLesion, currentSlice])

  if (!caseId) {
    return (
      <div className="flex items-center justify-center h-96 bg-medical-darker rounded-lg">
        <p className="text-gray-500">케이스를 선택해주세요</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 렌더링 모드 표시 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          렌더링: {useWebGL ? (
            <span className="text-green-400">WebGL (NiiVue)</span>
          ) : (
            <span className="text-yellow-400">Server (PNG)</span>
          )}
          {!webglSupport.supported && ' [WebGL2 미지원]'}
          {webglSupport.supported && !webglSupport.optimal && ' [최적화 제한]'}
        </span>
      </div>

      {/* 2-up 뷰어 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Baseline (좌) */}
        <div className="space-y-2">
          {useWebGL ? (
            <NiiVueCanvas
              caseId={caseId}
              series="baseline"
              currentSlice={syncScroll ? currentSlice : baselineSlice}
              onSliceChange={handleBaselineSliceChange}
              wlPreset={wlPreset}
              lesions={[]}
              isInteractive={false}
              label={`Baseline${!syncScroll ? ` (${baselineSlice + 1})` : ''}`}
            />
          ) : (
            <SliceCanvas
              imageUrl={baselineUrl}
              lesions={[]}
              currentSlice={syncScroll ? currentSlice : baselineSlice}
              onWheel={handleWheel}
              isInteractive={false}
              label={`Baseline${!syncScroll ? ` (${baselineSlice + 1})` : ''}`}
            />
          )}
        </div>

        {/* Followup (우) */}
        <div className="space-y-2">
          {useWebGL ? (
            <NiiVueCanvas
              caseId={caseId}
              series="followup"
              currentSlice={syncScroll ? currentSlice : followupSlice}
              onSliceChange={handleFollowupSliceChange}
              wlPreset={wlPreset}
              lesions={lesions}
              onAddLesion={handleNiiVueAddLesion}
              isInteractive={true}
              label={`Follow-up${!syncScroll ? ` (${followupSlice + 1})` : ''}`}
              overlayUrl={overlayUrl}
              showOverlay={showOverlay && isAided}
              aiThreshold={aiThreshold}
            />
          ) : (
            <SliceCanvas
              imageUrl={followupUrl}
              overlayUrl={overlayUrl}
              showOverlay={showOverlay && isAided}
              lesions={lesions}
              currentSlice={syncScroll ? currentSlice : followupSlice}
              onAddLesion={handleServerAddLesion}
              onWheel={handleWheel}
              isInteractive={true}
              label={`Follow-up${!syncScroll ? ` (${followupSlice + 1})` : ''}`}
            />
          )}
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
            max={Math.max(0, totalSlices - 1)}
            value={currentSlice}
            onChange={handleSliderChange}
            disabled={totalSlices === 0}
            className="flex-1 accent-primary-500 disabled:opacity-50"
          />
          <span className="text-white font-mono text-sm w-24 text-right">
            {totalSlices > 0 ? `${currentSlice + 1} / ${totalSlices}` : '로딩 중...'}
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

          {/* 동시 스크롤 토글 */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">동시 스크롤:</span>
            <button
              onClick={() => setSyncScroll(!syncScroll)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                syncScroll
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {syncScroll ? 'ON' : 'OFF'}
            </button>
          </div>

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
