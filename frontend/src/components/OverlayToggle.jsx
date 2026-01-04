/**
 * ============================================================================
 * OverlayToggle Component - Reader Study Frontend
 * ============================================================================
 * 역할: AI 오버레이 토글 및 설정 (AIDED 모드 전용)
 *
 * Props:
 *   - showOverlay: 오버레이 표시 여부
 *   - onToggle: 토글 콜백
 *   - threshold: 현재 임계값
 *   - isAided: AIDED 모드 여부
 *   - aiAvailable: AI 데이터 존재 여부
 *
 * 사용 예시:
 *   <OverlayToggle
 *     showOverlay={showOverlay}
 *     onToggle={() => setShowOverlay(!showOverlay)}
 *     threshold={0.30}
 *     isAided={true}
 *   />
 * ============================================================================
 */

export function OverlayToggle({
  showOverlay,
  onToggle,
  threshold = 0.30,
  isAided = false,
  aiAvailable = false,
}) {
  // AIDED 모드가 아니면 표시하지 않음
  if (!isAided) {
    return (
      <div className="bg-medical-dark rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span className="text-sm">UNAIDED 모드 - AI 비활성화</span>
        </div>
      </div>
    )
  }

  // AI 데이터가 없으면 안내 메시지
  if (!aiAvailable) {
    return (
      <div className="bg-medical-dark rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm">이 케이스에는 AI 데이터가 없습니다</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-medical-dark rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* AI 아이콘 */}
          <div className={`p-2 rounded-lg ${showOverlay ? 'bg-primary-600' : 'bg-gray-700'}`}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <div>
            <p className="text-white font-semibold">AI 오버레이</p>
            <p className="text-gray-400 text-xs">
              Threshold: {(threshold * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        {/* 토글 스위치 */}
        <button
          onClick={onToggle}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            showOverlay ? 'bg-primary-600' : 'bg-gray-600'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
              showOverlay ? 'translate-x-7' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* 활성화 시 안내 */}
      {showOverlay && (
        <p className="mt-3 text-xs text-primary-400 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          AI 검출 영역이 빨간색으로 표시됩니다
        </p>
      )}
    </div>
  )
}

export default OverlayToggle
