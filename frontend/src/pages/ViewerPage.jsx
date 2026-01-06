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
 * 케이스 할당:
 *   - /study-config/public API에서 세션/블록 수 조회
 *   - /case/allocate API에서 세션별 케이스 목록 동적 할당
 *   - dataset 폴더의 실제 NIfTI 파일 사용
 *
 * URL 파라미터:
 *   /viewer/:sessionId
 *
 * 라우트: /viewer/:sessionId (인증 필요)
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCase } from '../hooks/useCase'
import { useTimer } from '../hooks/useTimer'
import { api, sessionsApi } from '../services/api'

import Viewer from '../components/Viewer'
import LesionMarker from '../components/LesionMarker'
import InputPanel from '../components/InputPanel'
import ProgressBar from '../components/ProgressBar'

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

  // 환자 수준 판정
  const [patientDecision, setPatientDecision] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

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
        //    URL의 sessionId는 DB 내부 ID이므로, session_code로 변환 필요
        const mySessions = await sessionsApi.getMySessions(token)
        const currentSession = mySessions.find(s => s.session_id === parseInt(sessionId))

        // session_code 결정: 기존 세션이면 DB에서, 새 세션이면 할당에서 추론
        let sessionCode
        if (currentSession) {
          // 재진입: DB에서 session_code 가져오기
          sessionCode = currentSession.session_code
        } else {
          // 새 세션: 다음 세션 번호 계산 (기존 세션 수 + 1)
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
          throw new Error(`세션 ${sessionCode}의 케이스 할당을 찾을 수 없습니다. 유효한 세션: S1-S${numSessions}`)
        }

        const blockACases = sessionCases.block_a
        const blockBCases = sessionCases.block_b

        // 5. 세션 진입 (동적 케이스 목록 사용)
        const enterResult = await sessionsApi.enterSession(
          token,
          parseInt(sessionId),
          blockACases,
          blockBCases
        )
        setSessionInfo(enterResult)

        // 5. 현재 케이스 정보
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
      // 레거시 API로 결과 제출 (기존 study/submit 사용)
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
      timer.start() // 에러 시 타이머 재시작
    } finally {
      setIsSubmitting(false)
    }
  }, [patientDecision, currentCase, sessionInfo, user, caseData, timer, sessionId, getToken])

  // 로딩 상태
  if (loading) {
    return (
      <div className="min-h-screen bg-medical-darker flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white">세션 로딩 중...</p>
        </div>
      </div>
    )
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen bg-medical-darker flex items-center justify-center">
        <div className="bg-medical-dark p-8 rounded-lg max-w-md text-center">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">오류 발생</h1>
          <p className="text-red-400 mb-4">{error}</p>
          <Link
            to="/dashboard"
            className="inline-block px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // 세션 완료
  if (currentCase?.is_session_complete) {
    return (
      <div className="min-h-screen bg-medical-darker flex items-center justify-center">
        <div className="bg-medical-dark p-8 rounded-lg max-w-md text-center">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">세션 완료!</h1>
          <p className="text-gray-400 mb-4">
            모든 케이스를 완료했습니다.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Session: {sessionInfo?.session_code}
          </p>
          <Link
            to="/dashboard"
            className="inline-block px-6 py-3 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 transition-colors"
          >
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // 현재 케이스가 없는 경우
  if (!currentCase?.case_id) {
    return (
      <div className="min-h-screen bg-medical-darker flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">케이스 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  const isAided = currentCase.mode === 'AIDED'

  return (
    <div className="min-h-screen bg-medical-darker p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            대시보드
          </Link>
          <div className="text-right">
            <span className="text-gray-400">{user?.name}</span>
            <span className="text-gray-600 mx-2">|</span>
            <span className={`font-semibold ${isAided ? 'text-yellow-400' : 'text-blue-400'}`}>
              {currentCase.mode}
            </span>
          </div>
        </div>

        {/* 진행 상황 */}
        <ProgressBar
          current={currentCase.case_index + 1}
          total={currentCase.total_cases_in_block}
          completedCount={currentCase.case_index}
          mode={currentCase.mode}
          sessionInfo={`${sessionInfo?.session_code} - Block ${currentCase.block}`}
        />

        {/* 케이스 ID 표시 - 개인정보 보호를 위해 단순 번호만 표시 */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">
            Case {String(currentCase.case_index + 1).padStart(3, '0')}
          </h2>
          <p className="text-sm text-gray-500">
            Block {currentCase.block} • 케이스 {currentCase.case_index + 1} / {currentCase.total_cases_in_block}
            {currentCase.is_last_in_block && ' (마지막)'}
          </p>
        </div>

        {/* 메인 레이아웃 - 뷰어 전체 너비 */}
        <div className="space-y-4">
          {/* 뷰어 영역 (전체 너비) */}
          <div className="w-full">
            {caseData.loading ? (
              <div className="flex items-center justify-center h-96 bg-medical-dark rounded-lg">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-gray-400">케이스 로딩 중...</p>
                </div>
              </div>
            ) : caseData.error ? (
              <div className="flex items-center justify-center h-96 bg-medical-dark rounded-lg">
                <p className="text-red-400">{caseData.error}</p>
              </div>
            ) : (
              <Viewer
                caseId={currentCase.case_id}
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
              />
            )}
          </div>

          {/* 하단 컨트롤 영역 (가운데 정렬) */}
          <div className="flex flex-col lg:flex-row justify-center items-start gap-4">
            {/* 병변 마커 */}
            <div className="w-full lg:w-auto lg:min-w-[320px]">
              <LesionMarker
                lesions={caseData.lesions}
                onUpdateConfidence={caseData.updateLesionConfidence}
                onRemove={caseData.removeLesion}
                maxLesions={sessionInfo?.k_max || 3}
              />
            </div>

            {/* 입력 패널 */}
            <div className="w-full lg:w-auto lg:min-w-[280px]">
              <InputPanel
                patientDecision={patientDecision}
                onDecisionChange={setPatientDecision}
                lesionCount={caseData.lesions.length}
                onSubmit={handleSubmit}
                onClearLesions={caseData.clearLesions}
                isSubmitting={isSubmitting}
                timeElapsed={timer.formattedTime}
              />
            </div>

            {/* 에러 메시지 */}
            {submitError && (
              <div className="w-full lg:w-auto lg:max-w-[300px]">
                <div className="bg-red-900/30 border border-red-600 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{submitError}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
