/**
 * ============================================================================
 * ProgressBar Component - Reader Study Frontend
 * ============================================================================
 * 역할: 세션 진행 상황 표시
 *
 * Props:
 *   - current: 현재 케이스 번호 (1부터 시작)
 *   - total: 전체 케이스 수
 *   - completedCount: 완료된 케이스 수
 *   - mode: 세션 모드 (UNAIDED/AIDED)
 *   - sessionInfo: 세션 정보 문자열
 *
 * 디자인:
 *   - 글래스모피즘 카드
 *   - 그라데이션 프로그레스 바
 *   - 모드별 아이콘
 *
 * 사용 예시:
 *   <ProgressBar
 *     current={2}
 *     total={10}
 *     completedCount={1}
 *     mode="UNAIDED"
 *     sessionInfo="R01 - S1"
 *   />
 * ============================================================================
 */

// 아이콘 컴포넌트
const SessionIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const AidedIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M19 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2" fill="currentColor" stroke="none" />
  </svg>
)

const UnaidedIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function ProgressBar({
  current = 0,
  total = 0,
  completedCount = 0,
  mode = 'UNAIDED',
  sessionInfo = '',
}) {
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const isAided = mode === 'AIDED'

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        {/* 세션 정보 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <SessionIcon className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <span className="text-white font-semibold">{sessionInfo}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`status-badge ${isAided ? 'mode-aided' : 'mode-unaided'}`}>
                {isAided ? (
                  <AidedIcon className="w-3.5 h-3.5" />
                ) : (
                  <UnaidedIcon className="w-3.5 h-3.5" />
                )}
                {mode}
              </span>
            </div>
          </div>
        </div>

        {/* 케이스 카운터 */}
        <div className="text-right">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              {current}
            </span>
            <span className="text-gray-500 text-lg">/ {total}</span>
          </div>
          <p className="text-xs text-gray-500">케이스</p>
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500 progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 완료 상태 */}
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-1.5 text-gray-500">
          <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>완료: <span className="text-emerald-400 font-medium">{completedCount}</span>건</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-gray-400 font-medium">{progress}%</span>
        </div>
      </div>
    </div>
  )
}

export default ProgressBar
