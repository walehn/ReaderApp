/**
 * ============================================================================
 * InputPanel Component - Reader Study Frontend
 * ============================================================================
 * 역할: 환자 수준 판정 입력 및 제출
 *
 * Props:
 *   - patientDecision: 현재 판정 (true/false/null)
 *   - onDecisionChange: 판정 변경 콜백
 *   - lesionCount: 현재 병변 수
 *   - onSubmit: 제출 콜백
 *   - onClearLesions: 병변 초기화 콜백
 *   - isSubmitting: 제출 중 여부
 *   - timeElapsed: 경과 시간 문자열
 *
 * 사용 예시:
 *   <InputPanel
 *     patientDecision={decision}
 *     onDecisionChange={setDecision}
 *     lesionCount={lesions.length}
 *     onSubmit={handleSubmit}
 *   />
 * ============================================================================
 */

export function InputPanel({
  patientDecision,
  onDecisionChange,
  lesionCount = 0,
  onSubmit,
  onClearLesions,
  isSubmitting = false,
  timeElapsed = '0:00',
}) {
  // 제출 가능 여부 (환자 판정 필수)
  const canSubmit = patientDecision !== null && !isSubmitting

  // Yes 선택 시 병변이 없으면 경고
  const showLesionWarning = patientDecision === true && lesionCount === 0

  return (
    <div className="bg-medical-dark rounded-lg p-4 space-y-4">
      {/* 시간 표시 */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-400">소요 시간</span>
        <span className="text-white font-mono text-lg">{timeElapsed}</span>
      </div>

      {/* 환자 수준 판정 */}
      <div>
        <label className="block text-white font-semibold mb-2">
          새로운 간 전이 병변이 있습니까?
          <span className="text-red-400 ml-1">*</span>
        </label>

        <div className="flex gap-4">
          <button
            onClick={() => onDecisionChange(true)}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              patientDecision === true
                ? 'bg-red-600 text-white ring-2 ring-red-400'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            예 (Yes)
          </button>
          <button
            onClick={() => onDecisionChange(false)}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              patientDecision === false
                ? 'bg-green-600 text-white ring-2 ring-green-400'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            아니오 (No)
          </button>
        </div>
      </div>

      {/* 병변 마킹 경고 */}
      {showLesionWarning && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3">
          <p className="text-yellow-400 text-sm flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            "예"를 선택했지만 병변이 마킹되지 않았습니다
          </p>
        </div>
      )}

      {/* 병변 상태 */}
      <div className="flex justify-between items-center text-sm text-gray-400">
        <span>마킹된 병변: {lesionCount}개</span>
        {lesionCount > 0 && (
          <button
            onClick={onClearLesions}
            className="text-gray-500 hover:text-red-400 transition-colors underline"
          >
            모두 삭제
          </button>
        )}
      </div>

      {/* 제출 버튼 */}
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`w-full py-3 rounded-lg font-semibold text-lg transition-all ${
          canSubmit
            ? 'bg-primary-600 hover:bg-primary-700 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            제출 중...
          </span>
        ) : (
          '제출 및 다음 케이스'
        )}
      </button>

      {/* 필수 입력 안내 */}
      {patientDecision === null && (
        <p className="text-gray-500 text-xs text-center">
          * 환자 수준 판정을 선택해주세요
        </p>
      )}
    </div>
  )
}

export default InputPanel
