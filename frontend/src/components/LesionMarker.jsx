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
 * 사용 예시:
 *   <LesionMarker
 *     lesions={lesions}
 *     onUpdateConfidence={(id, conf) => updateLesionConfidence(id, conf)}
 *     onRemove={(id) => removeLesion(id)}
 *     maxLesions={3}
 *   />
 * ============================================================================
 */

const CONFIDENCE_OPTIONS = [
  { value: 'definite', label: 'Definite', color: 'bg-red-500' },
  { value: 'probable', label: 'Probable', color: 'bg-amber-500' },
  { value: 'possible', label: 'Possible', color: 'bg-green-500' },
]

export function LesionMarker({
  lesions = [],
  onUpdateConfidence,
  onRemove,
  maxLesions = 3,
}) {
  return (
    <div className="bg-medical-dark rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-semibold">
          병변 마커
        </h3>
        <span className="text-gray-400 text-sm">
          {lesions.length} / {maxLesions}
        </span>
      </div>

      {lesions.length === 0 ? (
        <p className="text-gray-500 text-sm italic">
          Follow-up 이미지를 클릭하여 병변을 마킹하세요
        </p>
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
      <div className="mt-4 pt-3 border-t border-gray-700">
        <p className="text-gray-500 text-xs mb-2">Confidence 범례:</p>
        <div className="flex gap-3 text-xs">
          {CONFIDENCE_OPTIONS.map(opt => (
            <div key={opt.value} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded-full ${opt.color}`}></span>
              <span className="text-gray-400">{opt.label}</span>
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
    <div className="flex items-center gap-3 bg-medical-darker rounded p-2">
      {/* 번호 */}
      <div className={`w-6 h-6 rounded-full ${conf.color} flex items-center justify-center text-white text-sm font-bold`}>
        {number}
      </div>

      {/* 좌표 */}
      <div className="flex-1 text-gray-300 text-sm">
        <span className="font-mono">
          ({lesion.x}, {lesion.y})
        </span>
        <span className="text-gray-500 ml-2">
          Z: {lesion.z}
        </span>
      </div>

      {/* Confidence 선택 */}
      <select
        value={lesion.confidence}
        onChange={(e) => onUpdateConfidence(lesion.id, e.target.value)}
        className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-primary-500"
      >
        {CONFIDENCE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* 삭제 버튼 */}
      <button
        onClick={() => onRemove(lesion.id)}
        className="text-gray-500 hover:text-red-400 transition-colors p-1"
        title="병변 삭제"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default LesionMarker
