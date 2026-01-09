/**
 * ============================================================================
 * usePreload Hook - NIfTI 파일 프리로딩
 * ============================================================================
 *
 * 역할: 다음 케이스의 NIfTI 파일을 백그라운드에서 미리 다운로드
 *
 * 전략:
 *   - fetch()로 파일 요청 → 브라우저 HTTP 캐시에 저장
 *   - NiiVue가 같은 URL 요청 시 캐시 히트 (네트워크 지연 0)
 *   - priority: 'low'로 현재 케이스 로딩 방해 안 함
 *   - 1초 딜레이 후 프리로드 시작 (현재 케이스 우선)
 *
 * 사용법:
 *   usePreload(currentCase?.next_case_id)
 *
 * 동작:
 *   - nextCaseId가 있으면 baseline, followup 파일을 미리 fetch
 *   - 이미 같은 케이스를 프리로드했으면 스킵
 *   - 케이스 변경 시 이전 프리로드 취소 (AbortController)
 *
 * ============================================================================
 */

import { useEffect, useRef } from 'react'

const API_BASE = '/api'

export function usePreload(nextCaseId) {
  const preloadedRef = useRef(null)

  useEffect(() => {
    // 다음 케이스 없거나 이미 프리로드했으면 스킵
    if (!nextCaseId || preloadedRef.current === nextCaseId) {
      return
    }

    const controller = new AbortController()

    const preload = async () => {
      const urls = [
        `${API_BASE}/nifti/volume?case_id=${nextCaseId}&series=baseline`,
        `${API_BASE}/nifti/volume?case_id=${nextCaseId}&series=followup`,
      ]

      console.log('[Preload] Starting:', nextCaseId)

      try {
        // 병렬로 두 파일 프리페치 (낮은 우선순위)
        await Promise.all(
          urls.map(url =>
            fetch(url, {
              signal: controller.signal,
              priority: 'low', // 현재 케이스 로딩 우선
            })
          )
        )
        preloadedRef.current = nextCaseId
        console.log('[Preload] Complete:', nextCaseId)
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[Preload] Failed:', err.message)
        }
      }
    }

    // 현재 케이스 로딩 완료 후 1초 딜레이
    const timerId = setTimeout(preload, 1000)

    return () => {
      clearTimeout(timerId)
      controller.abort()
    }
  }, [nextCaseId])
}
