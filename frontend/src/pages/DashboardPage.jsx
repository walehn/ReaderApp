/**
 * ============================================================================
 * DashboardPage - Reader Study Frontend (Phase 4)
 * ============================================================================
 * 역할: 세션 목록 및 진행 상황 대시보드
 *
 * 표시 내용:
 *   - 사용자 정보 및 진행 통계
 *   - 세션 카드 (진행률, 상태, 블록 정보)
 *   - 세션 진입 버튼
 *
 * 디자인:
 *   - 글래스모피즘 카드
 *   - 아이콘 시스템 (Reader/Session/Block/AIDED/UNAIDED)
 *   - 애니메이션 효과
 *
 * 라우트: /dashboard (인증 필요)
 * ============================================================================
 */

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { sessionsApi, api } from '../services/api'

// =============================================================================
// 아이콘 컴포넌트
// =============================================================================

// Reader 아이콘 (사용자 + 의료 십자)
const ReaderIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="8" r="4" />
    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    <path d="M18 8h2M19 7v2" strokeLinecap="round" />
  </svg>
)

// Session 아이콘 (클립보드 + 체크)
const SessionIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// Block 아이콘 (큐브)
const BlockIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.27 6.96L12 12.01l8.73-5.05" />
    <path d="M12 22.08V12" />
  </svg>
)

// AIDED 아이콘 (눈 + AI 스파클)
const AidedIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M19 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2" fill="currentColor" stroke="none" />
  </svg>
)

// UNAIDED 아이콘 (눈만)
const UnaidedIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

// 진행 중 아이콘
const PlayIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
)

// 완료 아이콘
const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// 대기 아이콘
const ClockIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" />
  </svg>
)

// 케이스 아이콘
const CaseIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </svg>
)

// 화살표 아이콘
const ArrowRightIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// =============================================================================
// 유틸리티 함수
// =============================================================================

/**
 * ISO 날짜 문자열을 한국 시간(KST)으로 변환
 * 서버가 UTC 시간을 timezone 정보 없이 반환하므로 'Z'를 추가하여 UTC로 해석
 */
function formatKST(isoString) {
  if (!isoString) return '-'
  // 서버에서 받은 시간에 'Z'가 없으면 추가 (UTC임을 명시)
  const utcString = isoString.endsWith('Z') ? isoString : isoString + 'Z'
  const date = new Date(utcString)
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

// =============================================================================
// 메인 컴포넌트
// =============================================================================

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

  // 통계 계산
  const stats = {
    total: sessions.length,
    completed: sessions.filter(s => s.status === 'completed').length,
    inProgress: sessions.filter(s => s.status === 'in_progress').length,
    pending: sessions.filter(s => s.status !== 'completed' && s.status !== 'in_progress').length,
    overallProgress: sessions.length > 0
      ? sessions.reduce((acc, s) => acc + s.progress_percent, 0) / sessions.length
      : 0
  }

  // 상태별 설정
  const getStatusConfig = (status) => {
    switch (status) {
      case 'completed':
        return {
          class: 'status-completed',
          label: '완료',
          icon: <CheckIcon className="w-3.5 h-3.5" />
        }
      case 'in_progress':
        return {
          class: 'status-in-progress',
          label: '진행 중',
          icon: <PlayIcon className="w-3.5 h-3.5" />
        }
      default:
        return {
          class: 'status-pending',
          label: '대기 중',
          icon: <ClockIcon className="w-3.5 h-3.5" />
        }
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] bg-mesh">
      {/* 상단 그라데이션 오버레이 */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      {/* 헤더 */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-dynamic-lg py-dynamic">
          <div className="flex items-center justify-between">
            {/* 로고 및 제목 */}
            <div className="flex items-center gap-dynamic">
              <div className="w-dynamic-icon-lg h-dynamic-icon-lg rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/25 animate-pulse-glow">
                <SessionIcon className="w-[60%] h-[60%] text-white" />
              </div>
              <div>
                <h1 className="text-dynamic-title font-bold text-white tracking-tight">
                  {studyConfig?.study_name || 'Reader Study'}
                </h1>
                <p className="text-dynamic-xs text-gray-500">Dashboard</p>
              </div>
            </div>

            {/* 사용자 정보 및 액션 */}
            <div className="flex items-center gap-4">
              {/* 사용자 프로필 */}
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <ReaderIcon className="w-5 h-5 text-white" />
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold text-sm">{user?.name}</p>
                  <p className="text-xs text-gray-500">
                    {user?.reader_code}
                    {user?.group && ` · ${studyConfig?.group_names?.[`group_${user.group}`] || `Group ${user.group}`}`}
                  </p>
                </div>
              </div>

              {/* 관리자 버튼 */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-105 transition-all duration-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  관리자
                </Link>
              )}

              {/* 로그아웃 */}
              <button
                onClick={handleLogout}
                className="px-4 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-300"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="relative z-10 max-w-7xl mx-auto px-dynamic-lg py-dynamic-lg">
        {/* 환영 섹션 + 통계 */}
        <div className="mb-dynamic-lg animate-fade-in-up">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-dynamic-lg">
            {/* 환영 메시지 */}
            <div>
              <h2 className="text-dynamic-title font-bold text-white mb-dynamic">
                안녕하세요, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">{user?.name}</span>님
              </h2>
              <p className="text-gray-400 text-dynamic-body">
                아래에서 세션을 선택하여 Reader Study를 진행하세요.
              </p>
            </div>

            {/* 진행 통계 */}
            {!loading && sessions.length > 0 && (
              <div className="flex items-center gap-dynamic-lg">
                {/* 전체 진행률 */}
                <div className="text-center">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 transform -rotate-90">
                      <circle
                        cx="40" cy="40" r="36"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="6"
                      />
                      <circle
                        cx="40" cy="40" r="36"
                        fill="none"
                        stroke="url(#progressGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${stats.overallProgress * 2.26} 226`}
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-white">{stats.overallProgress.toFixed(0)}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">전체 진행률</p>
                </div>

                {/* 상태별 개수 */}
                <div className="flex gap-dynamic">
                  <div className="text-center px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
                    <p className="text-xs text-gray-500">완료</p>
                  </div>
                  <div className="text-center px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <p className="text-2xl font-bold text-blue-400">{stats.inProgress}</p>
                    <p className="text-xs text-gray-500">진행 중</p>
                  </div>
                  <div className="text-center px-4 py-2 rounded-xl bg-gray-500/10 border border-gray-500/20">
                    <p className="text-2xl font-bold text-gray-400">{stats.pending}</p>
                    <p className="text-xs text-gray-500">대기 중</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
              </div>
              <p className="text-gray-400">세션 목록을 불러오는 중...</p>
            </div>
          </div>
        )}

        {/* 에러 상태 */}
        {error && !loading && (
          <div className="glass-card rounded-2xl p-8 text-center border-red-500/30 animate-fade-in-up">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors border border-red-500/30"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 세션 없음 */}
        {!loading && !error && sessions.length === 0 && (
          <div className="glass-card rounded-2xl p-16 text-center animate-fade-in-up">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/5 flex items-center justify-center">
              <SessionIcon className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">할당된 세션이 없습니다</h3>
            <p className="text-gray-500">관리자에게 세션 할당을 요청하세요.</p>
          </div>
        )}

        {/* 세션 목록 */}
        {!loading && !error && sessions.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-dynamic-lg">
            {sessions.map((session, index) => {
              const statusConfig = getStatusConfig(session.status)

              return (
                <div
                  key={session.session_id}
                  className={`glass-card glass-card-hover rounded-2xl overflow-hidden animate-fade-in-up`}
                  style={{ animationDelay: `${index * 100}ms`, opacity: 0 }}
                >
                  {/* 세션 헤더 */}
                  <div className="p-dynamic-lg">
                    <div className="flex items-start justify-between mb-dynamic">
                      <div className="flex items-center gap-dynamic">
                        {/* 세션 아이콘 */}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          session.status === 'completed'
                            ? 'bg-emerald-500/20'
                            : session.status === 'in_progress'
                              ? 'bg-blue-500/20'
                              : 'bg-white/5'
                        }`}>
                          <SessionIcon className={`w-6 h-6 ${
                            session.status === 'completed'
                              ? 'text-emerald-400'
                              : session.status === 'in_progress'
                                ? 'text-blue-400'
                                : 'text-gray-500'
                          }`} />
                        </div>
                        <div>
                          <h3 className="text-dynamic-subtitle font-bold text-white">
                            {session.session_code}
                          </h3>
                          <div className="flex items-center gap-dynamic mt-1">
                            <span className={`status-badge ${statusConfig.class}`}>
                              {statusConfig.icon}
                              {statusConfig.label}
                            </span>
                            <span className="flex items-center gap-1 text-dynamic-sm text-gray-500">
                              <CaseIcon className="w-4 h-4" />
                              {session.total_cases}개 케이스
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 진행률 */}
                      <div className="text-right">
                        <div className="text-dynamic-title font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                          {session.progress_percent.toFixed(0)}%
                        </div>
                        <div className="text-dynamic-xs text-gray-500">진행률</div>
                      </div>
                    </div>

                    {/* 진행 바 */}
                    <div className="w-full bg-white/5 rounded-full h-2 mb-dynamic overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          session.status === 'completed'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-gradient-to-r from-blue-500 to-cyan-400 progress-bar'
                        }`}
                        style={{ width: `${session.progress_percent}%` }}
                      />
                    </div>

                    {/* Block 정보 */}
                    <div className="grid grid-cols-2 gap-dynamic mb-dynamic">
                      {/* Block A */}
                      <div className={`rounded-xl p-4 ${
                        session.block_a_mode === 'AIDED' ? 'mode-aided' : 'mode-unaided'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <BlockIcon className="w-4 h-4 opacity-70" />
                          <span className="text-xs font-medium opacity-70">Block A</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.block_a_mode === 'AIDED'
                            ? <AidedIcon className="w-5 h-5" />
                            : <UnaidedIcon className="w-5 h-5" />
                          }
                          <span className="font-bold">{session.block_a_mode}</span>
                        </div>
                      </div>

                      {/* Block B */}
                      <div className={`rounded-xl p-4 ${
                        session.block_b_mode === 'AIDED' ? 'mode-aided' : 'mode-unaided'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <BlockIcon className="w-4 h-4 opacity-70" />
                          <span className="text-xs font-medium opacity-70">Block B</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.block_b_mode === 'AIDED'
                            ? <AidedIcon className="w-5 h-5" />
                            : <UnaidedIcon className="w-5 h-5" />
                          }
                          <span className="font-bold">{session.block_b_mode}</span>
                        </div>
                      </div>
                    </div>

                    {/* 현재 진행 상태 */}
                    {session.current_block && (
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-3 p-3 rounded-lg bg-white/5">
                        <PlayIcon className="w-4 h-4 text-blue-400" />
                        <span>현재: Block {session.current_block}, 케이스 {(session.current_case_index || 0) + 1}</span>
                      </div>
                    )}

                    {/* 마지막 접속 */}
                    {session.last_accessed_at && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-4">
                        <ClockIcon className="w-3.5 h-3.5" />
                        마지막 접속: {formatKST(session.last_accessed_at)}
                      </div>
                    )}

                    {/* 진입 버튼 */}
                    <button
                      onClick={() => handleEnterSession(session.session_id)}
                      disabled={session.status === 'completed'}
                      className={`w-full py-3.5 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                        session.status === 'completed'
                          ? 'btn-primary'
                          : 'btn-primary'
                      }`}
                    >
                      {session.status === 'completed' ? (
                        <>
                          <CheckIcon className="w-5 h-5" />
                          완료됨
                        </>
                      ) : session.status === 'in_progress' ? (
                        <>
                          이어하기
                          <ArrowRightIcon className="w-5 h-5" />
                        </>
                      ) : (
                        <>
                          시작하기
                          <ArrowRightIcon className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 안내사항 */}
        <div className="mt-dynamic-lg glass-card rounded-2xl p-dynamic-lg animate-fade-in-up" style={{ animationDelay: '400ms', opacity: 0 }}>
          <div className="flex items-center gap-dynamic mb-dynamic-lg">
            <div className="w-dynamic-icon-md h-dynamic-icon-md rounded-xl bg-blue-500/20 flex items-center justify-center">
              <svg className="w-[60%] h-[60%] text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-dynamic-subtitle font-semibold text-white">안내사항</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-dynamic-lg text-dynamic-sm">
            {/* 세션 구조 */}
            <div className="space-y-3">
              <h4 className="text-white font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs">📋</span>
                세션 구조
              </h4>
              <ul className="space-y-2 text-gray-400 ml-8">
                <li>• 각 세션은 <span className="text-blue-400 font-medium">Block A</span>와 <span className="text-blue-400 font-medium">Block B</span>로 구성되며, 순차적으로 진행됩니다.</li>
                <li>• 각 블록은 <span className="text-amber-400 font-medium">UNAIDED</span>(비보조) 또는 <span className="text-emerald-400 font-medium">AIDED</span>(AI 보조) 모드로 진행됩니다.</li>
                <li>• 세션과 세션 사이에는 <span className="text-purple-400 font-medium">3주간의 Washout 기간</span>이 있습니다.</li>
              </ul>
            </div>

            {/* 케이스 판독 방법 */}
            <div className="space-y-3">
              <h4 className="text-white font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs">🔍</span>
                케이스 판독 방법
              </h4>
              <ul className="space-y-2 text-gray-400 ml-8">
                <li>• <span className="text-white font-medium">환자 판정</span> (필수): 새로운 전이 병변 존재 여부를 판단해주세요.</li>
                <li>• <span className="text-white font-medium">병변 마킹</span> (선택): 전이 병변이 있다고 판단되면 <span className="text-blue-400">최대 3개</span>까지 마킹할 수 있습니다.</li>
                <li>• 병변의 <span className="text-amber-400">크기나 개수에 상관없이</span> 가장 의심되는 병변부터 순서대로 마킹해주세요.</li>
                <li>• 각 병변에 대해 확신도(<span className="text-red-400">Definite</span>/<span className="text-amber-400">Probable</span>/<span className="text-emerald-400">Possible</span>)를 선택해주세요.</li>
              </ul>
            </div>

            {/* 뷰어 사용법 */}
            <div className="space-y-3">
              <h4 className="text-white font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs">🖥️</span>
                뷰어 사용법
              </h4>
              <ul className="space-y-2 text-gray-400 ml-8">
                <li>• <span className="text-white font-medium">화면 구성</span>: 좌측 Baseline, 우측 Follow-up 영상이 표시됩니다.</li>
                <li>• <span className="text-white font-medium">슬라이스 이동</span>: 마우스 휠 또는 키보드 <span className="text-blue-400">↑↓</span> 키로 이동합니다.</li>
                <li>• <span className="text-white font-medium">동시 스크롤</span>: <span className="text-blue-400">'L'</span> 키 또는 버튼으로 ON/OFF 전환</li>
                <li>• <span className="text-white font-medium">W/L 조정</span>: Liver/Soft 프리셋 선택 또는 드래그 모드로 조정</li>
                <li>• <span className="text-white font-medium">병변 마킹</span>: Follow-up 영상에서 클릭하여 마킹합니다.</li>
              </ul>
            </div>

            {/* AIDED 모드 & 진행 상태 */}
            <div className="space-y-3">
              <h4 className="text-white font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs">⚡</span>
                AIDED 모드 & 진행 상태
              </h4>
              <ul className="space-y-2 text-gray-400 ml-8">
                <li>• <span className="text-emerald-400 font-medium">AIDED 모드</span>에서는 AI 예측 오버레이가 표시됩니다.</li>
                <li>• AI 오버레이: <span className="text-green-400 font-medium">간 mask</span>는 <span className="text-green-400">녹색</span>, <span className="text-red-400 font-medium">전이 병변</span>은 <span className="text-red-400">빨간색</span>으로 표시됩니다.</li>
                <li>• AI 결과는 <span className="text-amber-400">참고용</span>이며, 최종 판단은 리더의 소견을 따릅니다.</li>
                <li>• 세션 진행 중 브라우저를 닫아도 진행 상태가 <span className="text-emerald-400">자동 저장</span>됩니다.</li>
                <li>• 완료된 세션은 다시 진행할 수 없습니다. 필요시 관리자에게 문의하세요.</li>
              </ul>
            </div>
          </div>

          {/* 주의사항 */}
          <div className="mt-8 lg:mt-10 p-dynamic rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-dynamic">
              <span className="text-amber-400 text-dynamic-subtitle">⚠️</span>
              <div className="text-gray-300 text-dynamic-sm space-y-1">
                <p><span className="text-amber-400 font-medium">주의사항</span>: 각 케이스 판독에 충분한 시간을 가지고 신중하게 판단해주세요.</p>
                <p>• 판독 소요 시간이 기록됩니다.</p>
                <p>• <span className="text-purple-400">5분간 입력이 없거나 탭을 전환</span>하면 타이머가 자동 일시정지됩니다.</p>
                <p>• 활동 재개 시 타이머가 자동으로 다시 시작됩니다.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
