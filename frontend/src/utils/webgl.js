/**
 * ============================================================================
 * WebGL Support Detection Utility
 * ============================================================================
 * 역할: WebGL2 및 NiiVue 지원 여부 감지
 *
 * 주요 기능:
 *   - checkWebGL2Support(): WebGL2 컨텍스트 지원 여부
 *   - checkNiiVueSupport(): NiiVue 최적 성능 지원 여부
 *   - checkSharedArrayBuffer(): SharedArrayBuffer 지원 여부
 *
 * 사용 예시:
 *   import { checkWebGL2Support, checkNiiVueSupport } from '../utils/webgl'
 *
 *   const supported = checkWebGL2Support()
 *   if (supported) {
 *     // WebGL 렌더링 사용
 *   } else {
 *     // 서버 사이드 렌더링 폴백
 *   }
 * ============================================================================
 */

/**
 * WebGL2 지원 여부 확인
 * @returns {boolean} WebGL2 지원 여부
 */
export function checkWebGL2Support() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    return !!gl
  } catch (e) {
    return false
  }
}

/**
 * WebGL (1.0) 지원 여부 확인 (폴백용)
 * @returns {boolean} WebGL 지원 여부
 */
export function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    return !!gl
  } catch (e) {
    return false
  }
}

/**
 * SharedArrayBuffer 지원 여부 확인
 * Cross-Origin Isolation이 필요함 (COOP/COEP 헤더)
 * @returns {boolean} SharedArrayBuffer 지원 여부
 */
export function checkSharedArrayBufferSupport() {
  try {
    return typeof SharedArrayBuffer !== 'undefined'
  } catch (e) {
    return false
  }
}

/**
 * NiiVue 최적 성능 지원 여부 확인
 * WebGL2 + SharedArrayBuffer가 모두 지원되어야 최적
 * @returns {object} 지원 상태 객체
 */
export function checkNiiVueSupport() {
  const webgl2 = checkWebGL2Support()
  const webgl = checkWebGLSupport()
  const sharedArrayBuffer = checkSharedArrayBufferSupport()
  const crossOriginIsolated = typeof window !== 'undefined' && window.crossOriginIsolated

  return {
    webgl2,
    webgl,
    sharedArrayBuffer,
    crossOriginIsolated,
    // WebGL2가 있으면 NiiVue 사용 가능
    supported: webgl2,
    // SharedArrayBuffer까지 있으면 최적 성능
    optimal: webgl2 && sharedArrayBuffer
  }
}

/**
 * 렌더링 모드 자동 선택
 * @returns {'webgl' | 'server'} 권장 렌더링 모드
 */
export function getRecommendedRenderMode() {
  const support = checkNiiVueSupport()
  return support.supported ? 'webgl' : 'server'
}

export default {
  checkWebGL2Support,
  checkWebGLSupport,
  checkSharedArrayBufferSupport,
  checkNiiVueSupport,
  getRecommendedRenderMode
}
