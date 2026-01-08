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
 * 디자인:
 *   - 글래스모피즘 카드
 *   - 그라데이션 버튼
 *   - 애니메이션 효과
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

// 아이콘 컴포넌트
const ClockIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" />
  </svg>
)

const CheckIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const XIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const WarningIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const SendIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TargetIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
)

const TrashIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function InputPanel({
  patientDecision,
  onDecisionChange,
  lesionCount = 0,
  onSubmit,
  onClearLesions,
  isSubmitting = false,
  timeElapsed = '0:00',
}) {
  const canSubmit = patientDecision !== null && !isSubmitting
  const showLesionWarning = patientDecision === true && lesionCount === 0

  return (
    <div className="glass-card rounded-xl p-4 h-full flex flex-col">
      {/* 시간 표시 */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2 text-gray-400">
          <ClockIcon className="w-5 h-5" />
          <span className="text-sm">소요 시간</span>
        </div>
        <span className="text-2xl font-bold text-white font-mono tabular-nums tracking-wider">
          {timeElapsed}
        </span>
      </div>

      {/* 환자 수준 판정 */}
      <div className="flex-1">
        <label className="block text-white font-semibold mb-3">
          새로운 간 전이 병변이 있습니까?
          <span className="text-red-400 ml-1">*</span>
        </label>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => onDecisionChange(true)}
            className={`relative py-4 rounded-xl font-bold text-lg transition-all duration-300 overflow-hidden ${
              patientDecision === true
                ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25 scale-[1.02]'
                : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:border-white/10'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {patientDecision === true && <CheckIcon className="w-5 h-5" />}
              <span>예 (Yes)</span>
            </div>
            {patientDecision === true && (
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => onDecisionChange(false)}
            className={`relative py-4 rounded-xl font-bold text-lg transition-all duration-300 overflow-hidden ${
              patientDecision === false
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 scale-[1.02]'
                : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:border-white/10'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {patientDecision === false && <XIcon className="w-5 h-5" />}
              <span>아니오 (No)</span>
            </div>
            {patientDecision === false && (
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-pulse" />
            )}
          </button>
        </div>

        {/* 병변 마킹 경고 */}
        {showLesionWarning && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-4 animate-fade-in-up">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <WarningIcon className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-amber-400 text-sm">
              "예"를 선택했지만 병변이 마킹되지 않았습니다
            </p>
          </div>
        )}

        {/* 병변 상태 */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 mb-4">
          <div className="flex items-center gap-2 text-gray-400">
            <TargetIcon className="w-4 h-4" />
            <span className="text-sm">마킹된 병변</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white font-bold">{lesionCount}개</span>
            {lesionCount > 0 && (
              <button
                onClick={onClearLesions}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                  text-gray-500 hover:text-red-400 hover:bg-red-500/10
                  transition-all duration-300"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                삭제
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 제출 버튼 */}
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 ${
          canSubmit
            ? 'btn-primary text-white'
            : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
        }`}
      >
        {isSubmitting ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>제출 중...</span>
          </>
        ) : (
          <>
            <SendIcon className="w-5 h-5" />
            <span>제출 및 다음 케이스</span>
          </>
        )}
      </button>

      {/* 필수 입력 안내 */}
      {patientDecision === null && (
        <p className="text-gray-600 text-xs text-center mt-3">
          * 환자 수준 판정을 선택해주세요
        </p>
      )}
    </div>
  )
}

export default InputPanel
