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
 * 라우트: /
 * ============================================================================
 */

import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function IntroPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-darker via-medical-dark to-medical-darker">
      {/* 배경 패턴 */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDIwMjAiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTZ2LTZoNnptMC0zMHY2aC02VjRoNnptMzAgMHY2aC02VjRoNnptMCAzMHY2aC02di02aDZ6TTYgMzR2Nkgwdi02aDZ6bTAgMzB2Nkg2djZIMHYtNmg2em0wLTMwdjZIMHYtNmg2em0zMCAzMHY2aC02di02aDZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50"></div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* 로고/아이콘 */}
        <div className="w-24 h-24 mb-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl">
          <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>

        {/* 제목 */}
        <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-4">
          Reader Study
        </h1>
        <h2 className="text-xl md:text-2xl text-primary-400 text-center mb-8">
          간 전이 병변 검출 연구
        </h2>

        {/* 설명 */}
        <div className="max-w-2xl bg-medical-dark/80 backdrop-blur-sm rounded-2xl p-8 mb-8 shadow-xl border border-gray-800">
          <p className="text-gray-300 text-center leading-relaxed mb-6">
            본 연구는 CT 영상에서 간 전이 병변을 검출하는 AI 보조 진단 시스템의
            효과를 평가하기 위한 Reader Study입니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-medical-darker/50 rounded-lg p-4">
              <h3 className="text-primary-400 font-semibold mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                UNAIDED 모드
              </h3>
              <p className="text-gray-400">AI 보조 없이 독립적으로 병변 검출</p>
            </div>
            <div className="bg-medical-darker/50 rounded-lg p-4">
              <h3 className="text-primary-400 font-semibold mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AIDED 모드
              </h3>
              <p className="text-gray-400">AI 확률맵을 참고하여 병변 검출</p>
            </div>
          </div>
        </div>

        {/* 로그인 버튼 */}
        {isAuthenticated ? (
          <Link
            to="/dashboard"
            className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-xl shadow-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-200 transform hover:scale-105"
          >
            대시보드로 이동
          </Link>
        ) : (
          <Link
            to="/login"
            className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-xl shadow-lg hover:from-primary-600 hover:to-primary-700 transition-all duration-200 transform hover:scale-105"
          >
            로그인하여 시작하기
          </Link>
        )}

        {/* 푸터 */}
        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>© 2024 Reader Study MVP</p>
          <p className="mt-1">IRB Approved Research Protocol</p>
        </footer>
      </div>
    </div>
  )
}
