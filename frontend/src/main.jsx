/**
 * ============================================================================
 * React Application Entry Point
 * ============================================================================
 * 역할: React 애플리케이션 초기화 및 DOM 마운트
 * ============================================================================
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ★ 메모리 최적화: StrictMode 비활성화
// React.StrictMode는 개발 모드에서 의도적으로 마운트→언마운트→재마운트 사이클을 실행
// NiiVue처럼 비용이 큰 WebGL 인스턴스에는 문제가 될 수 있음
// 프로덕션 빌드에서는 StrictMode가 자동으로 비활성화됨
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />,
)
