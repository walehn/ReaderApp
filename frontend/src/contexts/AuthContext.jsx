/**
 * ============================================================================
 * AuthContext - Reader Study Frontend (Phase 4)
 * ============================================================================
 * 역할: JWT 토큰 기반 인증 상태 관리
 *
 * 주요 기능:
 *   - login(email, password): 로그인 및 토큰 저장
 *   - logout(): 로그아웃 및 토큰 제거
 *   - user: 현재 로그인한 사용자 정보
 *   - isAuthenticated: 로그인 여부
 *   - isAdmin: 관리자 여부
 *
 * 토큰 저장:
 *   localStorage에 'reader_study_token' 키로 저장
 *
 * 사용 예시:
 *   import { useAuth } from '../contexts/AuthContext'
 *   const { user, login, logout, isAuthenticated } = useAuth()
 * ============================================================================
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/api'

// Context 생성
const AuthContext = createContext(null)

// 토큰 저장 키
const TOKEN_KEY = 'reader_study_token'

/**
 * AuthProvider 컴포넌트
 * 앱 전체를 감싸서 인증 상태를 제공합니다.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 토큰이 있으면 사용자 정보 로드
  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const userData = await authApi.getMe(token)
        setUser(userData)
        setError(null)
      } catch (err) {
        // 토큰이 유효하지 않으면 제거
        console.error('Failed to load user:', err)
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
        setError(null)
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [token])

  /**
   * 로그인
   * @param {string} email - 이메일
   * @param {string} password - 비밀번호
   * @returns {Promise<void>}
   */
  const login = useCallback(async (email, password) => {
    setError(null)
    try {
      const response = await authApi.login(email, password)
      const { access_token, reader } = response

      // 토큰 저장
      localStorage.setItem(TOKEN_KEY, access_token)
      setToken(access_token)
      setUser(reader)

      return reader
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  /**
   * 로그아웃
   */
  const logout = useCallback(async () => {
    try {
      if (token) {
        await authApi.logout(token)
      }
    } catch {
      // 로그아웃 실패해도 로컬 상태는 정리
    } finally {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
      setError(null)
    }
  }, [token])

  /**
   * 토큰 가져오기 (API 요청용)
   */
  const getToken = useCallback(() => token, [token])

  // Context 값
  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    logout,
    getToken,
    clearError: () => setError(null),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth 훅
 * AuthContext의 값을 사용합니다.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
