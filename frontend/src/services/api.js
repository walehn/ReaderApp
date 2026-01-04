/**
 * ============================================================================
 * API Service - Reader Study Frontend
 * ============================================================================
 * 역할: 백엔드 API 호출 모듈
 *
 * 주요 함수:
 *   - getCaseMeta(caseId) - 케이스 메타데이터 조회
 *   - getSliceUrl(...) - 슬라이스 이미지 URL 생성
 *   - getOverlayUrl(...) - AI 오버레이 URL 생성
 *   - submitResult(data) - 결과 제출
 *   - getSessionConfig(readerId, sessionId) - 세션 설정
 *
 * 사용 예시:
 *   import { api } from './services/api'
 *   const meta = await api.getCaseMeta('case_0001')
 * ============================================================================
 */

const API_BASE = '/api'

/**
 * API 호출 래퍼 함수
 * @param {string} endpoint - API 엔드포인트
 * @param {RequestInit} options - fetch 옵션
 * @returns {Promise<any>} - 응답 데이터
 */
async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || `API Error: ${response.status}`)
  }

  return response.json()
}

export const api = {
  /**
   * 케이스 메타데이터 조회
   * @param {string} caseId - 케이스 ID
   * @returns {Promise<{case_id, shape, slices, spacing, ai_available}>}
   */
  getCaseMeta: async (caseId) => {
    return fetchApi(`/case/meta?case_id=${encodeURIComponent(caseId)}`)
  },

  /**
   * 슬라이스 이미지 URL 생성
   * @param {string} caseId - 케이스 ID
   * @param {string} series - 'baseline' | 'followup'
   * @param {number} z - 슬라이스 인덱스
   * @param {string} wl - 'liver' | 'soft'
   * @param {string} format - 'png' (무손실) | 'jpeg' (손실)
   * @returns {string} - 이미지 URL
   */
  getSliceUrl: (caseId, series, z, wl = 'liver', format = 'png') => {
    const params = new URLSearchParams({
      case_id: caseId,
      series: series,
      z: z.toString(),
      wl: wl,
      format: format,
    })
    return `${API_BASE}/render/slice?${params}`
  },

  /**
   * AI 오버레이 URL 생성 (AIDED 모드 전용)
   * @param {string} caseId - 케이스 ID
   * @param {number} z - 슬라이스 인덱스
   * @param {string} readerId - Reader ID
   * @param {string} sessionId - Session ID
   * @param {number} threshold - 확률 임계값 (기본 0.30)
   * @param {number} alpha - 투명도 (기본 0.4)
   * @returns {string} - 오버레이 URL
   */
  getOverlayUrl: (caseId, z, readerId, sessionId, threshold = 0.30, alpha = 0.4) => {
    const params = new URLSearchParams({
      case_id: caseId,
      z: z.toString(),
      threshold: threshold.toString(),
      alpha: alpha.toString(),
      reader_id: readerId,
      session_id: sessionId,
    })
    return `${API_BASE}/render/overlay?${params}`
  },

  /**
   * 결과 제출
   * @param {Object} data - 제출 데이터
   * @returns {Promise<{success, message, result_id}>}
   */
  submitResult: async (data) => {
    return fetchApi('/study/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * 세션 설정 조회
   * @param {string} readerId - Reader ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<SessionConfig>}
   */
  getSessionConfig: async (readerId, sessionId) => {
    return fetchApi(`/study/session?reader_id=${encodeURIComponent(readerId)}&session_id=${encodeURIComponent(sessionId)}`)
  },

  /**
   * 세션 진행 상황 조회
   * @param {string} readerId - Reader ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<SessionState>}
   */
  getSessionProgress: async (readerId, sessionId) => {
    return fetchApi(`/study/progress?reader_id=${encodeURIComponent(readerId)}&session_id=${encodeURIComponent(sessionId)}`)
  },
}

export default api
