/**
 * ============================================================================
 * IntroPage - Reader Study Frontend (Phase 4)
 * ============================================================================
 * 역할: 연구 소개 및 로그인 진입 페이지
 *
 * 표시 내용:
 *   - 연구 제목 및 설명
 *   - 로그인 버튼
 *   - 기관 정보
 *
 * 디자인:
 *   - 글래스모피즘 카드
 *   - 그라데이션 배경
 *   - 애니메이션 효과
 *   - AIDED/UNAIDED 아이콘
 *
 * 라우트: /
 * ============================================================================
 */

import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// 아이콘 컴포넌트
const LogoIcon = ({ className = "w-14 h-14" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const UnaidedIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const AidedIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M19 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2" fill="currentColor" stroke="none" />
  </svg>
)

const ArrowRightIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ShieldIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CTScanIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
  </svg>
)

export default function IntroPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-mesh relative overflow-hidden">
      {/* 배경 그라데이션 효과 */}
      <div className="absolute inset-0 bg-gradient-radial from-blue-500/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* 로고/아이콘 */}
        <div className="relative mb-8 animate-fade-in-up">
          <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-blue-500/30">
            <LogoIcon className="w-16 h-16 text-white" />
          </div>
          {/* 장식 요소 */}
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <CTScanIcon className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* 제목 */}
        <div className="text-center mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-cyan-200 mb-4">
            Reader Study
          </h1>
          <h2 className="text-xl md:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-medium">
            간 전이 병변 검출 연구
          </h2>
        </div>

        {/* 설명 카드 */}
        <div className="glass-card max-w-2xl rounded-2xl p-8 mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-gray-300 text-center leading-relaxed mb-8 text-lg">
            본 연구는 CT 영상에서 간 전이 병변을 검출하는 AI 보조 진단 시스템의
            효과를 평가하기 위한 Reader Study입니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* UNAIDED 모드 */}
            <div className="group relative p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <UnaidedIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-blue-400 font-semibold text-lg">UNAIDED 모드</h3>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">
                  AI 보조 없이 독립적으로 병변을 검출하여 기준선 성능을 측정합니다.
                </p>
              </div>
            </div>

            {/* AIDED 모드 */}
            <div className="group relative p-5 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <AidedIcon className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="text-amber-400 font-semibold text-lg">AIDED 모드</h3>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">
                  AI 확률맵을 참고하여 병변을 검출하고 AI 보조 효과를 평가합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 로그인 버튼 */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="group relative inline-flex items-center gap-3 px-8 py-4 btn-primary text-white font-semibold rounded-xl shadow-lg overflow-hidden"
            >
              <span>대시보드로 이동</span>
              <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="group relative inline-flex items-center gap-3 px-8 py-4 btn-primary text-white font-semibold rounded-xl shadow-lg overflow-hidden"
            >
              <span>로그인하여 시작하기</span>
              <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        {/* 푸터 */}
        <footer className="mt-16 text-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mb-2">
            <ShieldIcon className="w-4 h-4 text-emerald-500" />
            <span>IRB Approved Research Protocol</span>
          </div>
          <p className="text-gray-600 text-xs">© 2024 Reader Study MVP</p>
        </footer>
      </div>
    </div>
  )
}
