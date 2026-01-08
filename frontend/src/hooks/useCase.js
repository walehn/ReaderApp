/**
 * ============================================================================
 * useCase Hook - Reader Study Frontend
 * ============================================================================
 * 역할: 개별 케이스 데이터 관리 (메타데이터, 슬라이스, 병변)
 *
 * 반환값:
 *   - meta: 케이스 메타데이터
 *   - currentSlice: 현재 Z 슬라이스
 *   - wlPreset: 현재 W/L 프리셋
 *   - lesions: 병변 마커 배열
 *   - setSlice: 슬라이스 변경
 *   - toggleWL: W/L 토글
 *   - addLesion: 병변 추가
 *   - removeLesion: 병변 제거
 *   - clearLesions: 모든 병변 제거
 *
 * 사용 예시:
 *   const { meta, currentSlice, setSlice, lesions, addLesion } = useCase('case_0001', 3)
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

// W/L 프리셋 정의
const WL_PRESETS = {
  liver: { center: 50, width: 150 },
  soft: { center: 40, width: 400 }
}

export function useCase(caseId, maxLesions = 3) {
  const [meta, setMeta] = useState(null)
  const [currentSlice, setCurrentSlice] = useState(0)
  const [wlPreset, setWlPreset] = useState('soft')
  // 커스텀 W/L 값 (드래그로 조정 시 사용)
  const [customWL, setCustomWLState] = useState({ center: 40, width: 400 })
  // W/L 모드: 'preset' (버튼) 또는 'custom' (드래그)
  const [wlMode, setWlMode] = useState('preset')
  const [lesions, setLesions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 메타데이터 로드
  useEffect(() => {
    if (!caseId) return

    const loadMeta = async () => {
      try {
        setLoading(true)
        setError(null)
        const caseMeta = await api.getCaseMeta(caseId)
        setMeta(caseMeta)
        // 첫 번째 슬라이스(인덱스 0)로 초기화
        setCurrentSlice(0)
        // 병변 초기화
        setLesions([])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadMeta()
  }, [caseId])

  // 슬라이스 변경
  const setSlice = useCallback((newSlice) => {
    if (!meta) return
    const clamped = Math.max(0, Math.min(newSlice, meta.slices - 1))
    setCurrentSlice(clamped)
  }, [meta])

  // 마우스 휠로 슬라이스 변경
  const handleWheelSlice = useCallback((delta) => {
    setSlice(currentSlice + (delta > 0 ? -1 : 1))
  }, [currentSlice, setSlice])

  // W/L 프리셋 토글
  const toggleWL = useCallback(() => {
    setWlPreset(prev => {
      const newPreset = prev === 'liver' ? 'soft' : 'liver'
      // 프리셋 선택 시 커스텀 W/L도 해당 값으로 업데이트
      setCustomWLState(WL_PRESETS[newPreset])
      setWlMode('preset')
      return newPreset
    })
  }, [])

  // 커스텀 W/L 설정 (드래그로 조정 시)
  const setCustomWL = useCallback((center, width) => {
    setCustomWLState({ center, width })
    setWlMode('custom')
  }, [])

  // 현재 유효한 W/L 값 계산
  const getCurrentWL = useCallback(() => {
    if (wlMode === 'preset') {
      return WL_PRESETS[wlPreset]
    }
    return customWL
  }, [wlMode, wlPreset, customWL])

  // 병변 추가
  // NiiVue (WebGL): addLesion(x, y, z, confidence) - 복셀 좌표
  // Server (PNG): addLesion(x, y, z) - z는 현재 슬라이스, x/y는 캔버스 픽셀
  const addLesion = useCallback((x, y, z = null, confidence = 'probable') => {
    if (lesions.length >= maxLesions) {
      console.warn(`Maximum ${maxLesions} lesions allowed`)
      return false
    }

    // z가 제공되지 않으면 currentSlice 사용 (서버 렌더링 호환)
    const sliceZ = z !== null ? z : currentSlice

    const newLesion = {
      id: Date.now(), // 임시 ID
      x,
      y,
      z: sliceZ,
      confidence,
    }

    setLesions(prev => [...prev, newLesion])
    return true
  }, [lesions.length, maxLesions, currentSlice])

  // 병변 제거
  const removeLesion = useCallback((lesionId) => {
    setLesions(prev => prev.filter(l => l.id !== lesionId))
  }, [])

  // 병변 confidence 업데이트
  const updateLesionConfidence = useCallback((lesionId, confidence) => {
    setLesions(prev => prev.map(l =>
      l.id === lesionId ? { ...l, confidence } : l
    ))
  }, [])

  // 모든 병변 제거
  const clearLesions = useCallback(() => {
    setLesions([])
  }, [])

  // 케이스 초기화 (새 케이스 시작 시)
  const resetCase = useCallback(() => {
    // 첫 번째 슬라이스(인덱스 0)로 초기화
    setCurrentSlice(0)
    setLesions([])
    setWlPreset('soft')
  }, [])

  return {
    caseId,
    meta,
    currentSlice,
    totalSlices: meta?.slices || 0,
    wlPreset,
    wlMode,
    customWL,
    getCurrentWL,
    lesions,
    aiAvailable: meta?.ai_available || false,
    loading,
    error,
    setSlice,
    handleWheelSlice,
    toggleWL,
    setCustomWL,
    addLesion,
    removeLesion,
    updateLesionConfidence,
    clearLesions,
    resetCase,
  }
}

export default useCase
