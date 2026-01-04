/**
 * ============================================================================
 * Reader Study MVP - Main Application
 * ============================================================================
 * 역할: Reader Study 웹 애플리케이션 메인 컴포넌트
 *
 * 주요 기능:
 *   - 세션 로딩 및 관리
 *   - 2-up 뷰어 렌더링
 *   - 병변 마킹
 *   - 결과 제출
 *   - 진행 상황 표시
 *
 * URL 파라미터:
 *   ?reader=R01&session=S1
 *
 * 사용법:
 *   npm run dev
 *   브라우저에서 http://localhost:5173?reader=R01&session=S1 접속
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from './hooks/useSession'
import { useCase } from './hooks/useCase'
import { useTimer } from './hooks/useTimer'
import { api } from './services/api'

import Viewer from './components/Viewer'
import LesionMarker from './components/LesionMarker'
import InputPanel from './components/InputPanel'
import ProgressBar from './components/ProgressBar'

function App() {
  // URL 파라미터에서 reader_id, session_id 추출
  const urlParams = new URLSearchParams(window.location.search)
  const readerId = urlParams.get('reader') || ''
  const sessionId = urlParams.get('session') || ''

  // 세션 관리
  const session = useSession(readerId, sessionId)

  // 케이스 관리
  const caseData = useCase(session.currentCaseId, session.maxLesions)

  // 타이머
  const timer = useTimer()

  // 환자 수준 판정
  const [patientDecision, setPatientDecision] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // 케이스 변경 시 초기화
  useEffect(() => {
    if (session.currentCaseId) {
      setPatientDecision(null)
      setSubmitError(null)
      timer.reset()
      timer.start()
    }
  }, [session.currentCaseId])

  // 결과 제출
  const handleSubmit = useCallback(async () => {
    if (patientDecision === null) {
      setSubmitError('환자 수준 판정을 선택해주세요')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const timeSpent = timer.stop()

    try {
      const data = {
        reader_id: readerId,
        session_id: sessionId,
        mode: session.config?.mode,
        case_id: session.currentCaseId,
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
      session.nextCase()

    } catch (err) {
      setSubmitError(err.message)
      timer.start() // 에러 시 타이머 재시작
    } finally {
      setIsSubmitting(false)
    }
  }, [patientDecision, readerId, sessionId, session, caseData.lesions, timer])

  // 세션 로딩 상태
  if (session.loading) {
    return (
      <div className="min-h-screen bg-medical-darker flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white">세션 로딩 중...</p>
        </div>
      </div>
    )
  }

  // 세션 에러 또는 파라미터 없음
  if (!readerId || !sessionId || session.error) {
    return (
      <div className="min-h-screen bg-medical-darker flex items-center justify-center">
        <div className="bg-medical-dark p-8 rounded-lg max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Reader Study MVP</h1>
          {session.error ? (
            <p className="text-red-400 mb-4">{session.error}</p>
          ) : (
            <p className="text-gray-400 mb-4">세션 정보가 필요합니다</p>
          )}
          <p className="text-gray-500 text-sm">
            URL 파라미터로 reader와 session을 지정해주세요:
            <br />
            <code className="text-primary-400">?reader=R01&session=S1</code>
          </p>
        </div>
      </div>
    )
  }

  // 세션 완료
  if (session.isComplete) {
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
            {session.totalCases}개 케이스를 모두 완료했습니다.
          </p>
          <p className="text-gray-500 text-sm">
            Session: {readerId} - {sessionId} ({session.config?.mode})
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-medical-darker p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* 헤더 및 진행 상황 */}
        <ProgressBar
          current={session.currentCaseIndex + 1}
          total={session.totalCases}
          completedCount={session.completedCases.length}
          mode={session.config?.mode}
          sessionInfo={`${readerId} - ${sessionId}`}
        />

        {/* 케이스 ID 표시 */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">
            {session.currentCaseId}
          </h2>
        </div>

        {/* 메인 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* 뷰어 영역 (3/4) */}
          <div className="lg:col-span-3">
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
                caseId={session.currentCaseId}
                readerId={readerId}
                sessionId={sessionId}
                isAided={session.isAided}
                aiThreshold={session.aiThreshold}
                lesions={caseData.lesions}
                onAddLesion={caseData.addLesion}
                currentSlice={caseData.currentSlice}
                totalSlices={caseData.totalSlices}
                onSliceChange={caseData.setSlice}
                wlPreset={caseData.wlPreset}
                onToggleWL={caseData.toggleWL}
                aiAvailable={caseData.aiAvailable}
              />
            )}
          </div>

          {/* 사이드바 (1/4) */}
          <div className="space-y-4">
            {/* 병변 마커 */}
            <LesionMarker
              lesions={caseData.lesions}
              onUpdateConfidence={caseData.updateLesionConfidence}
              onRemove={caseData.removeLesion}
              maxLesions={session.maxLesions}
            />

            {/* 입력 패널 */}
            <InputPanel
              patientDecision={patientDecision}
              onDecisionChange={setPatientDecision}
              lesionCount={caseData.lesions.length}
              onSubmit={handleSubmit}
              onClearLesions={caseData.clearLesions}
              isSubmitting={isSubmitting}
              timeElapsed={timer.formattedTime}
            />

            {/* 에러 메시지 */}
            {submitError && (
              <div className="bg-red-900/30 border border-red-600 rounded-lg p-3">
                <p className="text-red-400 text-sm">{submitError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
