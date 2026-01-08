/**
 * ============================================================================
 * DashboardPage - Reader Study Frontend (Phase 4)
 * ============================================================================
 * 역할: 세션 목록 및 진행 상황 대시보드
 *
 * 표시 내용:
 *   - 사용자 정보
 *   - 세션 목록 (진행률, 상태)
 *   - 세션 진입 버튼
 *
 * 기능:
 *   - 세션 목록 조회
 *   - 세션 선택 및 진입
 *   - 로그아웃
 *
 * 라우트: /dashboard (인증 필요)
 * ============================================================================
 */

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { sessionsApi, api } from '../services/api'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout, getToken, isAdmin } = useAuth()

  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [studyConfig, setStudyConfig] = useState(null)

  // 세션 목록 및 연구 설정 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const [sessionsData, configData] = await Promise.all([
          sessionsApi.getMySessions(getToken()),
          api.getPublicStudyConfig()
        ])
        setSessions(sessionsData)
        setStudyConfig(configData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [getToken])

  // 로그아웃 처리
  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  // 세션 진입
  const handleEnterSession = (sessionId) => {
    navigate(`/viewer/${sessionId}`)
  }

  // 상태별 색상
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-600'
      case 'in_progress':
        return 'bg-primary-500'
      default:
        return 'bg-gray-600'
    }
  }

  // 상태 라벨
  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return '완료'
      case 'in_progress':
        return '진행 중'
      default:
        return '대기 중'
    }
  }

  return (
    <div className="min-h-screen bg-medical-darker">
      {/* 헤더 */}
      <header className="bg-medical-dark border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* 로고 및 제목 */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Reader Study</h1>
                <p className="text-sm text-gray-400">대시보드</p>
              </div>
            </div>

            {/* 사용자 정보 및 로그아웃 */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white font-medium">{user?.name}</p>
                <p className="text-sm text-gray-400">
                  {user?.reader_code}
                  {user?.group && ` • ${studyConfig?.group_names?.[`group_${user.group}`] || `Group ${user.group}`}`}
                </p>
              </div>
              {/* 관리자 버튼 - admin 역할인 경우에만 표시 */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-lg hover:from-yellow-600 hover:to-orange-700 transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  관리자
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 환영 메시지 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            안녕하세요, {user?.name}님
          </h2>
          <p className="text-gray-400">
            아래에서 세션을 선택하여 Reader Study를 진행하세요.
          </p>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-400">세션 목록 로딩 중...</p>
            </div>
          </div>
        )}

        {/* 에러 상태 */}
        {error && !loading && (
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 세션 없음 */}
        {!loading && !error && sessions.length === 0 && (
          <div className="bg-medical-dark rounded-xl p-12 text-center border border-gray-800">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">할당된 세션이 없습니다</h3>
            <p className="text-gray-400">관리자에게 세션 할당을 요청하세요.</p>
          </div>
        )}

        {/* 세션 목록 */}
        {!loading && !error && sessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                className="bg-medical-dark rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors"
              >
                {/* 세션 헤더 */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {session.session_code}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs font-medium text-white rounded ${getStatusColor(session.status)}`}>
                          {getStatusLabel(session.status)}
                        </span>
                        <span className="text-sm text-gray-400">
                          {session.total_cases}개 케이스
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary-400">
                        {session.progress_percent.toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-500">진행률</div>
                    </div>
                  </div>

                  {/* 진행 바 */}
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                    <div
                      className="bg-gradient-to-r from-primary-500 to-primary-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${session.progress_percent}%` }}
                    ></div>
                  </div>

                  {/* Block 정보 */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-medical-darker rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Block A</div>
                      <div className={`font-semibold ${session.block_a_mode === 'AIDED' ? 'text-yellow-400' : 'text-blue-400'}`}>
                        {session.block_a_mode}
                      </div>
                    </div>
                    <div className="bg-medical-darker rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Block B</div>
                      <div className={`font-semibold ${session.block_b_mode === 'AIDED' ? 'text-yellow-400' : 'text-blue-400'}`}>
                        {session.block_b_mode}
                      </div>
                    </div>
                  </div>

                  {/* 현재 진행 상태 */}
                  {session.current_block && (
                    <div className="text-sm text-gray-400 mb-4">
                      현재: Block {session.current_block}, 케이스 {(session.current_case_index || 0) + 1}
                    </div>
                  )}

                  {/* 마지막 접속 */}
                  {session.last_accessed_at && (
                    <div className="text-xs text-gray-500 mb-4">
                      마지막 접속: {new Date(session.last_accessed_at).toLocaleString('ko-KR')}
                    </div>
                  )}

                  {/* 진입 버튼 */}
                  <button
                    onClick={() => handleEnterSession(session.session_id)}
                    disabled={session.status === 'completed'}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                      session.status === 'completed'
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700'
                    }`}
                  >
                    {session.status === 'completed'
                      ? '완료됨'
                      : session.status === 'in_progress'
                        ? '이어하기'
                        : '시작하기'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 안내 */}
        <div className="mt-8 p-6 bg-medical-dark/50 rounded-xl border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-3">안내사항</h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>각 세션은 Block A와 Block B로 구성되며, 순차적으로 진행됩니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>세션 진행 중 브라우저를 닫아도 진행 상태가 저장됩니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>완료된 세션은 다시 진행할 수 없습니다. 필요시 관리자에게 문의하세요.</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}
