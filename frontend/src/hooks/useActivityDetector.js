/**
 * ============================================================================
 * useActivityDetector Hook - Reader Study Frontend
 * ============================================================================
 * 역할: 사용자 활동 감지 및 비활성 상태 판단
 *
 * 옵션:
 *   - idleTimeout: 비활성 판정 시간 (기본값: 300000ms = 5분)
 *
 * 반환값:
 *   - isIdle: 비활성 상태 여부 (타임아웃 경과)
 *   - isTabVisible: 브라우저 탭 활성화 여부
 *   - isActive: 종합 활성 상태 (!isIdle && isTabVisible)
 *   - resetIdleTimer: 수동으로 idle 타이머 리셋
 *
 * 감지 이벤트:
 *   - mousemove, mousedown, keydown, touchstart, scroll, wheel
 *
 * 사용 예시:
 *   const { isActive, isIdle, isTabVisible } = useActivityDetector({
 *     idleTimeout: 5 * 60 * 1000  // 5분
 *   })
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export function useActivityDetector({ idleTimeout = 5 * 60 * 1000 } = {}) {
  const [isIdle, setIsIdle] = useState(false)
  const [isTabVisible, setIsTabVisible] = useState(
    typeof document !== 'undefined' ? !document.hidden : true
  )

  const idleTimerRef = useRef(null)
  const lastActivityRef = useRef(Date.now())

  // 활동 감지 시 호출 - idle 타이머 리셋
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now()

    // 이미 idle 상태면 해제
    if (isIdle) {
      setIsIdle(false)
    }

    // 기존 타이머 클리어 후 새 타이머 설정
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }

    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true)
    }, idleTimeout)
  }, [idleTimeout, isIdle])

  // 탭 가시성 변경 처리
  const handleVisibilityChange = useCallback(() => {
    const visible = !document.hidden
    setIsTabVisible(visible)

    // 탭이 다시 활성화되면 활동으로 간주
    if (visible) {
      handleActivity()
    }
  }, [handleActivity])

  // 이벤트 리스너 등록/해제
  useEffect(() => {
    // 감지할 이벤트 목록
    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel'
    ]

    // 이벤트 핸들러 (throttle 적용)
    let throttleTimer = null
    const throttledHandler = () => {
      if (throttleTimer) return
      throttleTimer = setTimeout(() => {
        throttleTimer = null
        handleActivity()
      }, 100) // 100ms throttle
    }

    // 이벤트 리스너 등록
    events.forEach(event => {
      window.addEventListener(event, throttledHandler, { passive: true })
    })

    // 탭 가시성 리스너 등록
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 초기 타이머 시작
    handleActivity()

    // 정리
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledHandler)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      if (throttleTimer) {
        clearTimeout(throttleTimer)
      }
    }
  }, [handleActivity, handleVisibilityChange])

  // 종합 활성 상태: idle이 아니고 탭이 활성화된 경우
  const isActive = !isIdle && isTabVisible

  return {
    isIdle,
    isTabVisible,
    isActive,
    resetIdleTimer: handleActivity
  }
}

export default useActivityDetector
