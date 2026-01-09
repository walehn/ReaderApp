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
// 옵션 1: 해부학적 간 + AI 타겟팅 (의료 전문 느낌)
const LiverCTIcon = ({ className = "w-14 h-14" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    {/* 간 실루엣 - 해부학적으로 정확한 간 형태 */}
    <path
      d="M19.5 8.5c.5 1.5.5 3 0 4.5-.8 2.5-2.5 4.5-5 5.5-2 .8-4.5 1-7 0-2-.8-3.5-2.5-4-5-.3-1.5-.2-3 .5-4.5.8-2 2.5-3.5 4.5-4.5 1.5-.8 3.2-1 5-.5 2 .5 3.8 1.5 5 3 .5.5.8 1 1 1.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* 간 내부 혈관 구조 (간문맥 암시) */}
    <path
      d="M10 11c1.5-1 3-1.5 4.5-1M9 13.5c2 .5 4 .5 5.5-.5"
      stroke="currentColor"
      strokeWidth="1"
      strokeOpacity="0.4"
      strokeLinecap="round"
    />
    {/* AI 타겟팅 마커 - 병변 검출 표시 */}
    <circle cx="14" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1" />
    <circle cx="14" cy="12" r="1" fill="currentColor" />
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

const UserIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const ClipboardIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" strokeLinecap="round" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
)

const MailIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const LockIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
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
        <div className="relative mb-dynamic-lg animate-fade-in-up">
          <div className="w-dynamic-logo rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-blue-500/30">
            <LiverCTIcon className="w-[60%] h-[60%] text-white" />
          </div>
          {/* 장식 요소 */}
          <div className="absolute -top-2 -right-2 w-dynamic-icon-md rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <CTScanIcon className="w-[50%] h-[50%] text-white" />
          </div>
        </div>

        {/* 제목 */}
        <div className="text-center mb-dynamic-lg animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-dynamic-hero font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-cyan-200 mb-dynamic">
            HepaMARS: Reader Study
          </h1>
          <h2 className="text-dynamic-title text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-medium max-w-dynamic-card mx-auto">
            AI-Assisted Detection of Newly Developed Hepatic Metastases
          </h2>
        </div>

        {/* 설명 카드 */}
        <div className="glass-card max-w-dynamic-card rounded-2xl p-dynamic-lg mb-dynamic-lg animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <p className="text-gray-300 text-center text-dynamic-subtitle mb-dynamic-lg">
            This reader study evaluates the impact of AI assistance on radiologist performance
            in detecting newly developed hepatic metastases on follow-up CT compared to baseline CT.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-dynamic-lg">
            {/* UNAIDED 모드 */}
            <div className="group relative p-dynamic rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300" />
              <div className="relative">
                <div className="flex items-center gap-dynamic mb-dynamic">
                  <div className="w-dynamic-icon-lg rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <UnaidedIcon className="w-[60%] h-[60%] text-blue-400" />
                  </div>
                  <h3 className="text-blue-400 font-semibold text-dynamic-subtitle">UNAIDED</h3>
                </div>
                <p className="text-gray-400 text-dynamic-body">
                  Detect lesions independently without AI assistance to establish baseline performance.
                </p>
              </div>
            </div>

            {/* AIDED 모드 */}
            <div className="group relative p-dynamic rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300" />
              <div className="relative">
                <div className="flex items-center gap-dynamic mb-dynamic">
                  <div className="w-dynamic-icon-lg rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <AidedIcon className="w-[60%] h-[60%] text-amber-400" />
                  </div>
                  <h3 className="text-amber-400 font-semibold text-dynamic-subtitle">AIDED</h3>
                </div>
                <p className="text-gray-400 text-dynamic-body">
                  Detect lesions with AI-generated segmentation labels to evaluate the impact of AI assistance.
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
              className="group relative inline-flex items-center gap-dynamic btn-primary btn-dynamic text-white font-semibold rounded-xl shadow-lg overflow-hidden"
            >
              <span>Go to Dashboard</span>
              <ArrowRightIcon className="w-dynamic-icon-sm group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <Link
              to="/login"
              className="group relative inline-flex items-center gap-dynamic btn-primary btn-dynamic text-white font-semibold rounded-xl shadow-lg overflow-hidden"
            >
              <span>Sign In to Start</span>
              <ArrowRightIcon className="w-dynamic-icon-sm group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        {/* Study Information 섹션 */}
        <div className="glass-card max-w-dynamic-card rounded-2xl p-dynamic-lg mt-12 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
          <h3 className="text-dynamic-subtitle font-semibold text-white mb-dynamic text-center">Study Information</h3>

          <div className="space-y-5">
            {/* Principal Investigator */}
            <div className="flex items-start gap-dynamic">
              <div className="w-dynamic-icon-lg rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <UserIcon className="w-[60%] h-[60%] text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-dynamic-sm uppercase tracking-wider mb-1">Principal Investigator</p>
                <p className="text-white font-medium text-dynamic-body">Hokun Kim, MD, PhD</p>
                <p className="text-gray-400 text-dynamic-sm leading-relaxed">
                  Department of Radiology, Seoul St. Mary's Hospital,<br />
                  College of Medicine, The Catholic University of Korea
                </p>
              </div>
            </div>

            {/* IRB Approval */}
            <div className="flex items-start gap-dynamic">
              <div className="w-dynamic-icon-lg rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ClipboardIcon className="w-[60%] h-[60%] text-emerald-400" />
              </div>
              <div>
                <p className="text-gray-400 text-dynamic-sm uppercase tracking-wider mb-1">IRB Approval</p>
                <p className="text-white font-medium text-dynamic-body">KC22RISI0425</p>
              </div>
            </div>

            {/* Contact */}
            <div className="flex items-start gap-dynamic">
              <div className="w-dynamic-icon-lg rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MailIcon className="w-[60%] h-[60%] text-amber-400" />
              </div>
              <div>
                <p className="text-gray-400 text-dynamic-sm uppercase tracking-wider mb-1">Contact</p>
                <p className="text-gray-300 text-dynamic-sm">
                  <a href="mailto:walehn@catholic.ac.kr" className="hover:text-blue-400 transition-colors">walehn@catholic.ac.kr</a>
                  <span className="mx-2 text-gray-600">|</span>
                  <a href="mailto:walehn@gmail.com" className="hover:text-blue-400 transition-colors">walehn@gmail.com</a>
                </p>
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="flex items-start gap-dynamic">
              <div className="w-dynamic-icon-lg rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <LockIcon className="w-[60%] h-[60%] text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-dynamic-sm uppercase tracking-wider mb-1">Privacy Notice</p>
                <p className="text-gray-400 text-dynamic-sm leading-relaxed">
                  All patient data is fully anonymized and de-identified.<br />
                  This study complies with institutional data security protocols.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Funding 섹션 */}
        <div className="flex items-center gap-dynamic mt-6 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="bg-white rounded-lg p-dynamic shadow-lg">
            <img
              src="/guerbet.png"
              alt="Guerbet Logo"
              className="h-dynamic-logo-img w-auto"
            />
          </div>
          <div className="text-left">
            <p className="text-gray-500 text-dynamic-sm uppercase tracking-wider">Supported by</p>
            <p className="text-gray-300 font-medium text-dynamic-body">Guerbet Korea</p>
          </div>
        </div>

        {/* 푸터 */}
        <footer className="mt-6 text-center animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
          <p className="text-gray-500 text-dynamic-sm">
            Created by Hokun Kim · Powered by Claude Code
          </p>
          <p className="text-gray-600 text-dynamic-xs mt-1">
            Last updated: January 9, 2026
          </p>
        </footer>
      </div>
    </div>
  )
}
