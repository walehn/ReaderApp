/**
 * ============================================================================
 * useSession Hook - Reader Study Frontend
 * ============================================================================
 * 역할: 세션 상태 관리 (설정, 현재 케이스, 진행 상황)
 *
 * 반환값:
 *   - config: 세션 설정
 *   - currentCaseIndex: 현재 케이스 인덱스
 *   - currentCaseId: 현재 케이스 ID
 *   - progress: 진행률 (0-100)
 *   - isAided: AIDED 모드 여부
 *   - nextCase: 다음 케이스로 이동
 *   - isComplete: 세션 완료 여부
 *
 * 사용 예시:
 *   const { config, currentCaseId, isAided, nextCase } = useSession('R01', 'S1')
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

export function useSession(readerId, sessionId) {
  const [config, setConfig] = useState(null)
  const [currentCaseIndex, setCurrentCaseIndex] = useState(0)
  const [completedCases, setCompletedCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 세션 설정 로드
  useEffect(() => {
    if (!readerId || !sessionId) {
      setLoading(false)
      return
    }

    const loadSession = async () => {
      try {
        setLoading(true)
        setError(null)
        const sessionConfig = await api.getSessionConfig(readerId, sessionId)
        setConfig(sessionConfig)

        // 진행 상황도 로드
        try {
          const progress = await api.getSessionProgress(readerId, sessionId)
          setCurrentCaseIndex(progress.current_case_index)
          setCompletedCases(progress.completed_cases)
        } catch {
          // 진행 상황 없으면 처음부터
          setCurrentCaseIndex(0)
          setCompletedCases([])
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [readerId, sessionId])

  // 현재 케이스 ID
  const currentCaseId = config?.case_ids?.[currentCaseIndex] || null

  // AIDED 모드 여부
  const isAided = config?.mode === 'AIDED'

  // 진행률 계산
  const progress = config
    ? Math.round((completedCases.length / config.case_ids.length) * 100)
    : 0

  // 세션 완료 여부
  const isComplete = config
    ? completedCases.length >= config.case_ids.length
    : false

  // 다음 케이스로 이동
  const nextCase = useCallback(() => {
    if (!config) return

    // 현재 케이스를 완료 목록에 추가
    if (currentCaseId && !completedCases.includes(currentCaseId)) {
      setCompletedCases(prev => [...prev, currentCaseId])
    }

    // 다음 인덱스로 이동
    if (currentCaseIndex < config.case_ids.length - 1) {
      setCurrentCaseIndex(prev => prev + 1)
    }
  }, [config, currentCaseIndex, currentCaseId, completedCases])

  // 특정 케이스로 이동 (선택적)
  const goToCase = useCallback((caseId) => {
    if (!config) return
    const index = config.case_ids.indexOf(caseId)
    if (index !== -1) {
      setCurrentCaseIndex(index)
    }
  }, [config])

  return {
    config,
    readerId,
    sessionId,
    currentCaseIndex,
    currentCaseId,
    totalCases: config?.case_ids?.length || 0,
    completedCases,
    progress,
    isAided,
    isComplete,
    maxLesions: config?.k_max || 3,
    aiThreshold: config?.ai_threshold || 0.30,
    loading,
    error,
    nextCase,
    goToCase,
  }
}

export default useSession
