/**
 * ============================================================================
 * ViewerPage - Reader Study Frontend (Phase 4)
 * ============================================================================
 * 역할: 2-up 뷰어 및 병변 마킹 페이지 (DB 기반 세션 연동)
 *
 * 주요 기능:
 *   - 세션 진입 및 케이스 로딩
 *   - 2-up 뷰어 렌더링 (Baseline/Followup) - NiiVue WebGL 또는 서버 PNG
 *   - 병변 마킹
 *   - 결과 제출 및 다음 케이스 이동
 *
 * 디자인:
 *   - 글래스모피즘 카드
 *   - 그라데이션 배경
 *   - 애니메이션 효과
 *
 * URL 파라미터:
 *   /viewer/:sessionId
 *
 * 라우트: /viewer/:sessionId (인증 필요)
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCase } from '../hooks/useCase'
import { useTimer } from '../hooks/useTimer'
import { useActivityDetector } from '../hooks/useActivityDetector'
import { usePreload } from '../hooks/usePreload'
import { api, sessionsApi } from '../services/api'

import Viewer from '../components/Viewer'
import LesionMarker from '../components/LesionMarker'
import InputPanel from '../components/InputPanel'
import ProgressBar from '../components/ProgressBar'

// =============================================================================
// 아이콘 컴포넌트
// =============================================================================

const ArrowLeftIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CheckCircleIcon = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round" />
    <path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ErrorIcon = ({ className = "w-8 h-8" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" />
  </svg>
)

const AidedIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M19 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2" fill="currentColor" stroke="none" />
  </svg>
)

const UnaidedIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const UserIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="8" r="4" />
    <path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
  </svg>
)

const CaseIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 21V9" />
  </svg>
)

// =============================================================================
// 메인 컴포넌트
// =============================================================================

export default function ViewerPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { user, getToken } = useAuth()

  // 세션 상태
  const [sessionInfo, setSessionInfo] = useState(null)
  const [currentCase, setCurrentCase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 케이스 관리 (k_max는 세션 설정에서 동적으로 가져옴)
  const caseData = useCase(currentCase?.case_id, sessionInfo?.k_max || 3)

  // 타이머
  const timer = useTimer()

  // 사용자 활동 감지 (5분 비활성 또는 탭 전환 시 타이머 일시정지)
  const { isActive, isTabVisible } = useActivityDetector({
    idleTimeout: 5 * 60 * 1000  // 5분
  })

  // 다음 케이스 프리로딩 (네트워크 지연 최소화)
  usePreload(currentCase?.next_case_id)

  // 환자 수준 판정
  const [patientDecision, setPatientDecision] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // ★ 메모리 최적화: 이전 caseId 유지 (Viewer 언마운트 방지)
  const prevCaseIdRef = useRef(null)
  if (currentCase?.case_id) {
    prevCaseIdRef.current = currentCase.case_id
  }
  const stableCaseId = currentCase?.case_id || prevCaseIdRef.current

  // 세션 진입
  useEffect(() => {
    const enterSession = async () => {
      try {
        setLoading(true)
        setError(null)

        const token = getToken()

        // 1. 연구 설정에서 세션/블록 수 조회
        const studyConfig = await api.getPublicStudyConfig()
        const numSessions = studyConfig.total_sessions
        const numBlocks = studyConfig.total_blocks

        // 2. 케이스 할당 조회 (세션별 케이스 목록)
        const allocation = await api.getCaseAllocation(numSessions, numBlocks)

        // 3. 내 세션 목록 조회하여 session_code 확보
        const mySessions = await sessionsApi.getMySessions(token)
        const currentSession = mySessions.find(s => s.session_id === parseInt(sessionId))

        // session_code 결정
        let sessionCode
        if (currentSession) {
          sessionCode = currentSession.session_code
        } else {
          const existingSessionCodes = mySessions.map(s => s.session_code)
          for (let i = 1; i <= numSessions; i++) {
            const candidateCode = `S${i}`
            if (!existingSessionCodes.includes(candidateCode)) {
              sessionCode = candidateCode
              break
            }
          }
          if (!sessionCode) {
            throw new Error('모든 세션이 이미 할당되었습니다.')
          }
        }

        // 4. session_code로 케이스 목록 조회
        const sessionCases = allocation.sessions[sessionCode]

        if (!sessionCases) {
          throw new Error(`세션 ${sessionCode}의 케이스 할당을 찾을 수 없습니다.`)
        }

        const blockACases = sessionCases.block_a
        const blockBCases = sessionCases.block_b

        // 5. 세션 진입
        const enterResult = await sessionsApi.enterSession(
          token,
          parseInt(sessionId),
          blockACases,
          blockBCases
        )
        setSessionInfo(enterResult)

        // 6. 현재 케이스 정보
        const caseInfo = await sessionsApi.getCurrentCase(token, parseInt(sessionId))
        setCurrentCase(caseInfo)

        // 세션 완료 체크
        if (caseInfo.is_session_complete) {
          setLoading(false)
          return
        }

        // 타이머 시작
        timer.reset()
        timer.start()

      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      enterSession()
    }

    return () => {
      timer.stop()
    }
  }, [sessionId, getToken])

  // 케이스 변경 시 초기화
  useEffect(() => {
    if (currentCase?.case_id) {
      setPatientDecision(null)
      setSubmitError(null)
      timer.reset()
      timer.start()
    }
  }, [currentCase?.case_id])

  // 활동 상태에 따른 타이머 자동 제어
  useEffect(() => {
    // 제출 중일 때는 타이머 제어 안함
    if (isSubmitting) return

    if (isActive && timer.pauseReason) {
      // 활동 재개 → 타이머 재개
      timer.resume()
    } else if (timer.isRunning && !isActive) {
      // 비활성 → 타이머 일시정지
      const reason = !isTabVisible ? 'tab_hidden' : 'idle'
      timer.pauseWithReason(reason)
    }
  }, [isActive, isTabVisible, timer.isRunning, timer.pauseReason, isSubmitting])

  // 결과 제출
  const handleSubmit = useCallback(async () => {
    if (patientDecision === null) {
      setSubmitError('환자 수준 판정을 선택해주세요')
      return
    }

    if (!currentCase?.case_id) {
      setSubmitError('케이스 정보가 없습니다')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const timeSpent = timer.stop()

    try {
      const data = {
        reader_id: user.reader_code,
        session_id: sessionInfo.session_code,
        mode: currentCase.mode,
        case_id: currentCase.case_id,
        patient_new_met_present: patientDecision,
        lesions: caseData.lesions.map(l => ({
          x: l.x,
          y: l.y,
          z: l.z,
          confidence: l.confidence,
        })),
        time_spent_sec: timeSpent,
      }

      await api.submitResult(data)

      // 다음 케이스로 이동
      const token = getToken()
      const nextCase = await sessionsApi.advanceCase(
        token,
        parseInt(sessionId),
        currentCase.case_id
      )
      setCurrentCase(nextCase)

      // 병변 초기화
      caseData.clearLesions()

    } catch (err) {
      setSubmitError(err.message)
      timer.start()
    } finally {
      setIsSubmitting(false)
    }
  }, [patientDecision, currentCase, sessionInfo, user, caseData, timer, sessionId, getToken])

  // 로딩 상태
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] bg-mesh flex items-center justify-center">
        <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
        <div className="relative z-10 text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
          </div>
          <p className="text-gray-400 text-lg">세션 로딩 중...</p>
        </div>
      </div>
    )
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a12] bg-mesh flex items-center justify-center">
        <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
        <div className="relative z-10 glass-card rounded-2xl p-10 max-w-md text-center animate-fade-in-up">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <ErrorIcon className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">오류 발생</h1>
          <p className="text-red-400 mb-6">{error}</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 btn-primary rounded-xl font-semibold text-white"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // 세션 완료
  if (currentCase?.is_session_complete) {
    return (
      <div className="min-h-screen bg-[#0a0a12] bg-mesh flex items-center justify-center">
        <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
        <div className="relative z-10 glass-card rounded-2xl p-10 max-w-md text-center animate-fade-in-up">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-500/20 flex items-center justify-center animate-pulse-glow">
            <CheckCircleIcon className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">세션 완료!</h1>
          <p className="text-gray-400 mb-2">
            모든 케이스를 성공적으로 완료했습니다.
          </p>
          <p className="text-gray-600 text-sm mb-8">
            Session: {sessionInfo?.session_code}
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3.5 btn-primary rounded-xl font-semibold text-white text-lg"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // 현재 케이스가 없는 경우
  if (!stableCaseId) {
    return (
      <div className="min-h-screen bg-[#0a0a12] bg-mesh flex items-center justify-center">
        <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
        <div className="relative z-10 text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
          </div>
          <p className="text-gray-400">케이스 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  const isAided = currentCase?.mode === 'AIDED'

  return (
    <div className="min-h-screen bg-[#0a0a12] bg-mesh">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      <div className="relative z-10 p-dynamic lg:p-dynamic-lg">
        <div className="max-w-[1600px] mx-auto space-y-dynamic">
          {/* 헤더 */}
          <header className="flex items-center justify-between animate-fade-in-up">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-300"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="font-medium">대시보드</span>
            </Link>

            <div className="flex items-center gap-dynamic">
              {/* 모드 배지 */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                isAided ? 'mode-aided' : 'mode-unaided'
              }`}>
                {isAided ? (
                  <AidedIcon className="w-5 h-5" />
                ) : (
                  <UnaidedIcon className="w-5 h-5" />
                )}
                <span className="font-bold text-sm">{currentCase?.mode || '로딩...'}</span>
              </div>

              {/* 사용자 정보 */}
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-medium text-sm">{user?.name}</span>
              </div>
            </div>
          </header>

          {/* 진행 상황 */}
          <div className="animate-fade-in-up" style={{ animationDelay: '100ms', opacity: 0 }}>
            <ProgressBar
              current={(currentCase?.case_index ?? 0) + 1}
              total={currentCase?.total_cases_in_block ?? 0}
              completedCount={currentCase?.case_index ?? 0}
              mode={currentCase?.mode || 'UNAIDED'}
              sessionInfo={`${sessionInfo?.session_code} - Block ${currentCase?.block || '?'}`}
            />
          </div>

          {/* 케이스 정보 */}
          <div className="text-center animate-fade-in-up" style={{ animationDelay: '150ms', opacity: 0 }}>
            <div className="inline-flex items-center gap-dynamic px-dynamic-lg py-dynamic glass-card rounded-2xl">
              <div className="w-dynamic-icon-md h-dynamic-icon-md rounded-xl bg-blue-500/20 flex items-center justify-center">
                <CaseIcon className="w-[60%] h-[60%] text-blue-400" />
              </div>
              <div className="text-left">
                <h2 className="text-dynamic-subtitle font-bold text-white">
                  Case {String((currentCase?.case_index ?? 0) + 1).padStart(3, '0')}
                </h2>
                <p className="text-dynamic-xs text-gray-500">
                  Block {currentCase?.block} • {(currentCase?.case_index ?? 0) + 1} / {currentCase?.total_cases_in_block ?? 0}
                  {currentCase?.is_last_in_block && (
                    <span className="ml-2 text-amber-400">(마지막)</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 메인 레이아웃 */}
          <div className="space-y-dynamic !mt-2 animate-fade-in-up" style={{ animationDelay: '200ms', opacity: 0 }}>
            {/* 뷰어 영역 */}
            <div className="w-full relative">
              {/* 로딩 오버레이 */}
              {caseData.loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center glass-card rounded-2xl">
                  <div className="text-center">
                    <div className="relative w-12 h-12 mx-auto mb-3">
                      <div className="absolute inset-0 rounded-full border-4 border-blue-500/20"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin"></div>
                    </div>
                    <p className="text-gray-400">케이스 로딩 중...</p>
                  </div>
                </div>
              )}

              {/* 에러 오버레이 */}
              {caseData.error && (
                <div className="absolute inset-0 z-10 flex items-center justify-center glass-card rounded-2xl">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-500/20 flex items-center justify-center">
                      <ErrorIcon className="w-6 h-6 text-red-400" />
                    </div>
                    <p className="text-red-400">{caseData.error}</p>
                  </div>
                </div>
              )}

              {/* Viewer */}
              <Viewer
                key="main-viewer"
                caseId={stableCaseId}
                readerId={user?.reader_code}
                sessionId={sessionInfo?.session_code}
                isAided={isAided}
                aiThreshold={sessionInfo?.ai_threshold || 0.30}
                lesions={caseData.lesions}
                onAddLesion={caseData.addLesion}
                currentSlice={caseData.currentSlice}
                totalSlices={caseData.totalSlices}
                onSliceChange={caseData.setSlice}
                wlPreset={caseData.wlPreset}
                onToggleWL={caseData.toggleWL}
                aiAvailable={caseData.aiAvailable}
                customWL={caseData.customWL}
                onWLChange={caseData.setCustomWL}
                wlMode={caseData.wlMode}
                zFlippedBaseline={caseData.zFlippedBaseline}
                zFlippedFollowup={caseData.zFlippedFollowup}
              />
            </div>

            {/* 하단 컨트롤 영역 */}
            <div className="flex flex-col lg:flex-row justify-center items-stretch gap-dynamic">
              {/* 병변 마커 */}
              <div className="w-full lg:w-auto lg:min-w-[360px]">
                <LesionMarker
                  lesions={caseData.lesions}
                  onUpdateConfidence={caseData.updateLesionConfidence}
                  onRemove={caseData.removeLesion}
                  maxLesions={sessionInfo?.k_max || 3}
                />
              </div>

              {/* 입력 패널 */}
              <div className="w-full lg:w-auto lg:min-w-[320px]">
                <InputPanel
                  patientDecision={patientDecision}
                  onDecisionChange={setPatientDecision}
                  lesionCount={caseData.lesions.length}
                  onSubmit={handleSubmit}
                  onClearLesions={caseData.clearLesions}
                  isSubmitting={isSubmitting}
                  timeElapsed={timer.formattedTime}
                  isPaused={!!timer.pauseReason}
                  pauseReason={timer.pauseReason}
                />
              </div>

              {/* 에러 메시지 */}
              {submitError && (
                <div className="w-full lg:w-auto lg:max-w-[300px]">
                  <div className="glass-card rounded-xl p-4 border-red-500/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <ErrorIcon className="w-4 h-4 text-red-400" />
                      </div>
                      <p className="text-red-400 text-sm">{submitError}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
