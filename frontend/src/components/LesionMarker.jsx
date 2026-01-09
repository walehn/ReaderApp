/**
 * ============================================================================
 * LesionMarker Component - Reader Study Frontend
 * ============================================================================
 * 역할: 병변 마커 목록 표시 및 confidence 편집
 *
 * Props:
 *   - lesions: 병변 마커 배열
 *   - onUpdateConfidence: confidence 업데이트 콜백
 *   - onRemove: 병변 제거 콜백
 *   - maxLesions: 최대 병변 수
 *
 * 디자인:
 *   - 글래스모피즘 카드
 *   - 컬러 코딩된 confidence 배지
 *   - 애니메이션 효과
 *
 * 사용 예시:
 *   <LesionMarker
 *     lesions={lesions}
 *     onUpdateConfidence={(id, conf) => updateLesionConfidence(id, conf)}
 *     onRemove={(id) => removeLesion(id)}
 *     maxLesions={3}
 *   />
 * ============================================================================
 */

// 아이콘 컴포넌트
const TargetIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
)

const TrashIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11v6M14 11v6" strokeLinecap="round" />
  </svg>
)

const LocationIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const CONFIDENCE_OPTIONS = [
  {
    value: 'definite',
    label: 'Definite',
    color: 'from-red-500 to-rose-600',
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30'
  },
  {
    value: 'probable',
    label: 'Probable',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30'
  },
  {
    value: 'possible',
    label: 'Possible',
    color: 'from-emerald-500 to-green-500',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30'
  },
]

export function LesionMarker({
  lesions = [],
  onUpdateConfidence,
  onRemove,
  maxLesions = 3,
}) {
  return (
    <div className="glass-card rounded-xl p-4 h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <TargetIcon className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">병변 마커</h3>
            <p className="text-xs text-gray-500">Follow-up 이미지 클릭으로 추가</p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
          <span className="text-lg font-bold text-purple-400">{lesions.length}</span>
          <span className="text-gray-500 text-sm">/ {maxLesions}</span>
        </div>
      </div>

      {lesions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <LocationIcon className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-500 text-sm">
            마킹된 병변이 없습니다
          </p>
          <p className="text-gray-600 text-xs mt-1">
            Follow-up 이미지를 클릭하여 병변을 마킹하세요
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lesions.map((lesion, index) => (
            <LesionItem
              key={lesion.id}
              lesion={lesion}
              number={index + 1}
              onUpdateConfidence={onUpdateConfidence}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      {/* 범례 */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <p className="text-gray-500 text-xs mb-3">Confidence 범례</p>
        <div className="flex gap-2 flex-wrap">
          {CONFIDENCE_OPTIONS.map(opt => (
            <div
              key={opt.value}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${opt.bgColor} border ${opt.borderColor}`}
            >
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${opt.color}`} />
              <span className={`text-xs font-medium ${opt.textColor}`}>{opt.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LesionItem({ lesion, number, onUpdateConfidence, onRemove }) {
  const conf = CONFIDENCE_OPTIONS.find(c => c.value === lesion.confidence) || CONFIDENCE_OPTIONS[1]

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all duration-300 animate-fade-in-up">
      {/* 번호 배지 */}
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${conf.color} flex items-center justify-center text-white text-sm font-bold shadow-lg`}>
        {number}
      </div>

      {/* 좌표 */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-white font-mono text-sm">
            ({lesion.x}, {lesion.y})
          </span>
          <span className="px-2 py-0.5 rounded bg-white/5 text-gray-400 text-xs font-mono">
            Z: {lesion.z}
          </span>
        </div>
      </div>

      {/* Confidence 선택 */}
      <select
        value={lesion.confidence}
        onChange={(e) => onUpdateConfidence(lesion.id, e.target.value)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-300 cursor-pointer
          ${conf.bgColor} ${conf.textColor} ${conf.borderColor}
          focus:outline-none focus:ring-2 focus:ring-blue-500/50
          appearance-none bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat
          bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")]
          pr-8`}
      >
        {CONFIDENCE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-gray-800">
            {opt.label}
          </option>
        ))}
      </select>

      {/* 삭제 버튼 */}
      <button
        onClick={() => onRemove(lesion.id)}
        className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center
          text-gray-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30
          transition-all duration-300"
        title="병변 삭제"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

export default LesionMarker
