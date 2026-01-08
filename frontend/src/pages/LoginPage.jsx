/**
 * ============================================================================
 * LoginPage - Reader Study Frontend (Phase 4)
 * ============================================================================
 * 역할: 이메일/비밀번호 로그인 페이지
 *
 * 기능:
 *   - 이메일/비밀번호 입력
 *   - 로그인 처리
 *   - 에러 표시
 *   - 로그인 성공 시 대시보드로 이동
 *
 * 디자인:
 *   - 글래스모피즘 로그인 카드
 *   - 그라데이션 배경
 *   - 애니메이션 효과
 *
 * 라우트: /login
 * ============================================================================
 */

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// 아이콘 컴포넌트
const UserIcon = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
  </svg>
)

const ArrowLeftIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const MailIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 6l-10 7L2 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const LockIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" />
  </svg>
)

const AlertIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
  </svg>
)

const LoadingSpinner = ({ className = "w-5 h-5" }) => (
  <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

const HelpIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M9 9a3 3 0 114 2.83V14M12 17h.01" strokeLinecap="round" />
  </svg>
)

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, isAdmin, error, clearError } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState(null)

  // 이미 로그인되어 있으면 역할에 따라 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      navigate(isAdmin ? '/admin' : '/dashboard', { replace: true })
    }
  }, [isAuthenticated, isAdmin, navigate])

  // 에러 초기화
  useEffect(() => {
    return () => clearError()
  }, [clearError])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError(null)

    if (!email.trim()) {
      setLocalError('이메일을 입력해주세요')
      return
    }
    if (!password) {
      setLocalError('비밀번호를 입력해주세요')
      return
    }

    setIsLoading(true)
    try {
      const reader = await login(email, password)
      const redirectPath = reader.role === 'admin' ? '/admin' : '/dashboard'
      navigate(redirectPath, { replace: true })
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const displayError = localError || error

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden flex items-center justify-center px-4">
      {/* 배경 그라데이션 효과 */}
      <div className="absolute inset-0 bg-gradient-radial from-blue-500/5 via-transparent to-transparent" />
      <div className="absolute top-1/3 -right-48 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 -left-48 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        {/* 뒤로가기 링크 */}
        <Link
          to="/"
          className="group inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors animate-fade-in-up"
        >
          <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>처음으로</span>
        </Link>

        {/* 로그인 카드 */}
        <div className="glass-card rounded-2xl p-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/25">
              <UserIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
              로그인
            </h1>
            <p className="text-gray-400 mt-2">Reader Study에 로그인하세요</p>
          </div>

          {/* 에러 메시지 */}
          {displayError && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 animate-fade-in-up">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertIcon className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-red-400 text-sm">{displayError}</p>
            </div>
          )}

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                이메일
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <MailIcon className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                    hover:border-white/20 transition-all duration-300"
                  placeholder="example@hospital.com"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                비밀번호
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <LockIcon className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50
                    hover:border-white/20 transition-all duration-300"
                  placeholder="••••••••"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 btn-primary text-white font-semibold rounded-xl shadow-lg
                disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300
                flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner className="w-5 h-5" />
                  <span>로그인 중...</span>
                </>
              ) : (
                <span>로그인</span>
              )}
            </button>
          </form>

          {/* 도움말 */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <HelpIcon className="w-4 h-4" />
              <span>계정이 없으신가요? 관리자에게 문의하세요.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
