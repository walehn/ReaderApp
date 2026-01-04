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

export function ProgressBar({
  current = 0,
  total = 0,
  completedCount = 0,
  mode = 'UNAIDED',
  sessionInfo = '',
}) {
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0

  return (
    <div className="bg-medical-dark rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        {/* 세션 정보 */}
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold">{sessionInfo}</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              mode === 'AIDED'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {mode}
          </span>
        </div>

        {/* 케이스 카운터 */}
        <div className="text-gray-300">
          <span className="text-white font-bold text-lg">{current}</span>
          <span className="text-gray-500"> / {total}</span>
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 완료 상태 */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>완료: {completedCount}건</span>
        <span>{progress}% 진행</span>
      </div>
    </div>
  )
}

export default ProgressBar
