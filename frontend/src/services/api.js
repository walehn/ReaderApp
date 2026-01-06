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

  /**
   * 공개 연구 설정 조회 (인증 불필요)
   * ViewerPage에서 세션/블록 수를 조회하여 케이스 할당에 사용
   * @returns {Promise<{total_sessions, total_blocks, study_name}>}
   */
  getPublicStudyConfig: async () => {
    return fetchApi('/study-config/public')
  },

  /**
   * 케이스 할당 조회
   * 세션/블록별로 할당된 케이스 목록 반환
   * @param {number} numSessions - 총 세션 수
   * @param {number} numBlocks - 세션당 블록 수
   * @returns {Promise<{sessions: {S1: {block_a: [], block_b: []}, ...}}>}
   */
  getCaseAllocation: async (numSessions = 4, numBlocks = 2) => {
    return fetchApi(`/case/allocate?num_sessions=${numSessions}&num_blocks=${numBlocks}`)
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

  /**
   * 비밀번호 변경
   * @param {string} token - JWT 토큰
   * @param {string} currentPassword - 현재 비밀번호
   * @param {string} newPassword - 새 비밀번호
   * @returns {Promise<{message}>}
   */
  changePassword: async (token, currentPassword, newPassword) => {
    return fetchApiWithAuth('/auth/change-password', token, {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    })
  },
}

// =============================================================================
// 세션 API (Phase 4, 인증 필요)
// =============================================================================

// =============================================================================
// 관리자 API (Phase 5)
// =============================================================================

export const adminApi = {
  /**
   * 리더 목록 조회
   * @param {string} token - JWT 토큰
   * @param {boolean} includeInactive - 비활성 리더 포함 여부
   * @returns {Promise<Reader[]>}
   */
  getReaders: async (token, includeInactive = false) => {
    return fetchApiWithAuth(`/readers?include_inactive=${includeInactive}`, token)
  },

  /**
   * 리더 상세 조회
   * @param {string} token - JWT 토큰
   * @param {number} readerId - 리더 ID
   * @returns {Promise<ReaderDetail>}
   */
  getReader: async (token, readerId) => {
    return fetchApiWithAuth(`/readers/${readerId}`, token)
  },

  /**
   * 리더 생성
   * @param {string} token - JWT 토큰
   * @param {Object} data - 리더 정보
   * @returns {Promise<Reader>}
   */
  createReader: async (token, data) => {
    return fetchApiWithAuth('/readers', token, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * 리더 수정
   * @param {string} token - JWT 토큰
   * @param {number} readerId - 리더 ID
   * @param {Object} data - 수정 정보
   * @returns {Promise<Reader>}
   */
  updateReader: async (token, readerId, data) => {
    return fetchApiWithAuth(`/readers/${readerId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  /**
   * 리더 비활성화
   * @param {string} token - JWT 토큰
   * @param {number} readerId - 리더 ID
   * @returns {Promise<{message}>}
   */
  deactivateReader: async (token, readerId) => {
    return fetchApiWithAuth(`/readers/${readerId}`, token, {
      method: 'DELETE',
    })
  },

  /**
   * 리더/관리자 비밀번호 변경 (관리자 전용)
   * @param {string} token - JWT 토큰
   * @param {number} readerId - 리더 ID
   * @param {string} newPassword - 새 비밀번호
   * @returns {Promise<Reader>}
   */
  updateReaderPassword: async (token, readerId, newPassword) => {
    return fetchApiWithAuth(`/readers/${readerId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ password: newPassword }),
    })
  },

  /**
   * 세션 할당
   * @param {string} token - JWT 토큰
   * @param {number} readerId - 리더 ID
   * @param {string} sessionCode - 세션 코드 (S1 또는 S2)
   * @returns {Promise<Session>}
   */
  assignSession: async (token, readerId, sessionCode) => {
    return fetchApiWithAuth('/sessions/assign', token, {
      method: 'POST',
      body: JSON.stringify({
        reader_id: readerId,
        session_code: sessionCode,
      }),
    })
  },

  /**
   * 세션 초기화
   * @param {string} token - JWT 토큰
   * @param {number} sessionId - 세션 ID
   * @returns {Promise<{message}>}
   */
  resetSession: async (token, sessionId) => {
    return fetchApiWithAuth(`/sessions/${sessionId}/reset`, token, {
      method: 'POST',
    })
  },

  /**
   * 세션 할당 취소 (삭제)
   * @param {string} token - JWT 토큰
   * @param {number} sessionId - 세션 ID
   * @returns {Promise<{message}>}
   */
  deleteSession: async (token, sessionId) => {
    return fetchApiWithAuth(`/sessions/${sessionId}`, token, {
      method: 'DELETE',
    })
  },

  /**
   * 감사 로그 조회
   * @param {string} token - JWT 토큰
   * @param {Object} filters - 필터 옵션
   * @returns {Promise<AuditLog[]>}
   */
  getAuditLogs: async (token, { action, readerId, limit = 100, offset = 0 } = {}) => {
    let url = `/admin/audit-logs?limit=${limit}&offset=${offset}`
    if (action) url += `&action=${encodeURIComponent(action)}`
    if (readerId) url += `&reader_id=${readerId}`
    return fetchApiWithAuth(url, token)
  },

  /**
   * 결과 데이터 내보내기 URL
   * @param {string} format - 'csv' 또는 'json'
   * @returns {string}
   */
  getExportUrl: (format = 'csv') => {
    return `${API_BASE}/admin/export?format=${format}`
  },
}

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

// =============================================================================
// 연구 설정 API (StudyConfig)
// =============================================================================

export const studyConfigApi = {
  /**
   * 현재 연구 설정 조회
   * @param {string} token - JWT 토큰
   * @returns {Promise<StudyConfigResponse>}
   */
  getConfig: async (token) => {
    return fetchApiWithAuth('/study-config', token)
  },

  /**
   * 연구 설정 수정
   * @param {string} token - JWT 토큰
   * @param {Object} data - 수정할 설정 데이터
   * @returns {Promise<StudyConfigResponse>}
   */
  updateConfig: async (token, data) => {
    return fetchApiWithAuth('/study-config', token, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  /**
   * 연구 설정 수동 잠금
   * @param {string} token - JWT 토큰
   * @returns {Promise<{message: string}>}
   */
  lockConfig: async (token) => {
    return fetchApiWithAuth('/study-config/lock', token, {
      method: 'POST',
    })
  },
}

// =============================================================================
// 대시보드 API (Dashboard)
// =============================================================================

export const dashboardApi = {
  /**
   * 전체 진행 요약
   * @param {string} token - JWT 토큰
   * @returns {Promise<DashboardSummaryResponse>}
   */
  getSummary: async (token) => {
    return fetchApiWithAuth('/dashboard/summary', token)
  },

  /**
   * 리더별 진행률
   * @param {string} token - JWT 토큰
   * @returns {Promise<ReaderProgressResponse[]>}
   */
  getByReader: async (token) => {
    return fetchApiWithAuth('/dashboard/by-reader', token)
  },

  /**
   * 그룹별 진행률
   * @param {string} token - JWT 토큰
   * @returns {Promise<GroupProgressResponse[]>}
   */
  getByGroup: async (token) => {
    return fetchApiWithAuth('/dashboard/by-group', token)
  },

  /**
   * 세션별 진행률
   * @param {string} token - JWT 토큰
   * @returns {Promise<SessionStatsResponse[]>}
   */
  getBySession: async (token) => {
    return fetchApiWithAuth('/dashboard/by-session', token)
  },
}

export default api
