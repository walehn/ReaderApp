/**
 * ============================================================================
 * useTimer Hook - Reader Study Frontend
 * ============================================================================
 * 역할: 케이스별 소요 시간 측정
 *
 * 반환값:
 *   - elapsed: 현재까지 경과 시간 (초)
 *   - start: 타이머 시작
 *   - stop: 타이머 정지 (최종 시간 반환)
 *   - reset: 타이머 초기화
 *   - isRunning: 타이머 실행 중 여부
 *   - pauseReason: 일시정지 이유 ('idle' | 'tab_hidden' | null)
 *   - pauseWithReason: 이유와 함께 일시정지
 *
 * 사용 예시:
 *   const { elapsed, start, stop, reset, pauseReason, pauseWithReason } = useTimer()
 *   // 케이스 시작 시
 *   start()
 *   // 비활성 감지 시
 *   pauseWithReason('idle')
 *   // 제출 시
 *   const timeSpent = stop()
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export function useTimer() {
  const [elapsed, setElapsed] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [pauseReason, setPauseReason] = useState(null) // 'idle' | 'tab_hidden' | null
  const startTimeRef = useRef(null)
  const intervalRef = useRef(null)

  // 타이머 업데이트
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const now = Date.now()
          setElapsed((now - startTimeRef.current) / 1000)
        }
      }, 100) // 100ms 간격으로 업데이트
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning])

  // 타이머 시작
  const start = useCallback(() => {
    startTimeRef.current = Date.now()
    setElapsed(0)
    setIsRunning(true)
  }, [])

  // 타이머 정지 (최종 시간 반환)
  const stop = useCallback(() => {
    setIsRunning(false)
    setPauseReason(null)
    if (startTimeRef.current) {
      const finalElapsed = (Date.now() - startTimeRef.current) / 1000
      setElapsed(finalElapsed)
      return finalElapsed
    }
    return elapsed
  }, [elapsed])

  // 타이머 초기화
  const reset = useCallback(() => {
    setIsRunning(false)
    setElapsed(0)
    setPauseReason(null)
    startTimeRef.current = null
  }, [])

  // 일시정지 (이유 포함 - 비활성 감지용)
  const pauseWithReason = useCallback((reason = 'idle') => {
    if (isRunning) {
      setIsRunning(false)
      setPauseReason(reason)
    }
  }, [isRunning])

  // 재개 (pauseReason 초기화)
  const resume = useCallback(() => {
    if (!isRunning && startTimeRef.current) {
      // 일시정지 시간 보정
      const pausedDuration = Date.now() - (startTimeRef.current + elapsed * 1000)
      startTimeRef.current += pausedDuration
      setIsRunning(true)
      setPauseReason(null)
    }
  }, [isRunning, elapsed])

  // 포맷된 시간 문자열
  const formattedTime = useCallback(() => {
    const minutes = Math.floor(elapsed / 60)
    const seconds = Math.floor(elapsed % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [elapsed])

  return {
    elapsed,
    isRunning,
    pauseReason,
    start,
    stop,
    reset,
    pauseWithReason,
    resume,
    formattedTime: formattedTime(),
  }
}

export default useTimer
