/**
 * ============================================================================
 * API Service - Reader Study Frontend (Phase 4)
 * ============================================================================
 * 역할: 백엔드 API 호출 모듈
 *
 * 주요 함수:
 *   인증:
 *   - authApi.login(email, password) - 로그인
 *   - authApi.logout(token) - 로그아웃
 *   - authApi.getMe(token) - 현재 사용자 정보
 *
 *   세션 (인증 필요):
 *   - sessionsApi.getMySessions(token) - 내 세션 목록
 *   - sessionsApi.enterSession(token, sessionId, cases) - 세션 진입
 *   - sessionsApi.getCurrentCase(token, sessionId) - 현재 케이스
 *   - sessionsApi.advanceCase(token, sessionId, caseId) - 다음 케이스
 *
 *   레거시:
 *   - api.getCaseMeta(caseId) - 케이스 메타데이터
 *   - api.submitResult(data) - 결과 제출
 *
 * 사용 예시:
 *   import { api, authApi, sessionsApi } from './services/api'
 *   const user = await authApi.login('email', 'password')
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

// =============================================================================
// 인증 API (Phase 4)
// =============================================================================

/**
 * 인증 API 호출 래퍼 (토큰 포함)
 */
async function fetchApiWithAuth(endpoint, token, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
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

export const authApi = {
  /**
   * 로그인
   * @param {string} email - 이메일
   * @param {string} password - 비밀번호
   * @returns {Promise<{access_token, token_type, reader}>}
   */
  login: async (email, password) => {
    return fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  /**
   * 로그아웃
   * @param {string} token - JWT 토큰
   * @returns {Promise<{message}>}
   */
  logout: async (token) => {
    return fetchApiWithAuth('/auth/logout', token, {
      method: 'POST',
    })
  },

  /**
   * 현재 사용자 정보 조회
   * @param {string} token - JWT 토큰
   * @returns {Promise<Reader>}
   */
  getMe: async (token) => {
    return fetchApiWithAuth('/auth/me', token)
  },
}

// =============================================================================
// 세션 API (Phase 4, 인증 필요)
// =============================================================================

export const sessionsApi = {
  /**
   * 내 세션 목록 조회
   * @param {string} token - JWT 토큰
   * @returns {Promise<SessionSummary[]>}
   */
  getMySessions: async (token) => {
    return fetchApiWithAuth('/sessions/my', token)
  },

  /**
   * 세션 진입
   * @param {string} token - JWT 토큰
   * @param {number} sessionId - 세션 ID
   * @param {string[]} blockACases - Block A 케이스 목록
   * @param {string[]} blockBCases - Block B 케이스 목록
   * @returns {Promise<SessionEnterResponse>}
   */
  enterSession: async (token, sessionId, blockACases, blockBCases) => {
    return fetchApiWithAuth(`/sessions/${sessionId}/enter`, token, {
      method: 'POST',
      body: JSON.stringify({
        block_a_cases: blockACases,
        block_b_cases: blockBCases,
      }),
    })
  },

  /**
   * 현재 케이스 정보 조회
   * @param {string} token - JWT 토큰
   * @param {number} sessionId - 세션 ID
   * @returns {Promise<CurrentCaseResponse>}
   */
  getCurrentCase: async (token, sessionId) => {
    return fetchApiWithAuth(`/sessions/${sessionId}/current`, token)
  },

  /**
   * 다음 케이스로 이동
   * @param {string} token - JWT 토큰
   * @param {number} sessionId - 세션 ID
   * @param {string} completedCaseId - 완료된 케이스 ID
   * @returns {Promise<CurrentCaseResponse>}
   */
  advanceCase: async (token, sessionId, completedCaseId) => {
    return fetchApiWithAuth(`/sessions/${sessionId}/advance`, token, {
      method: 'POST',
      body: JSON.stringify({ completed_case_id: completedCaseId }),
    })
  },
}

export default api
