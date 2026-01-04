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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
