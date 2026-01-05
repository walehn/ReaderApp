/**
 * ============================================================================
 * Reader Study MVP - Main Application (Phase 4)
 * ============================================================================
 * 역할: React Router 기반 SPA 라우팅 및 인증 관리
 *
 * 라우트:
 *   / - IntroPage (공개)
 *   /login - LoginPage (공개)
 *   /dashboard - DashboardPage (인증 필요)
 *   /viewer/:sessionId - ViewerPage (인증 필요)
 *
 * 인증:
 *   AuthProvider로 전체 앱을 감싸서 인증 상태 관리
 *   ProtectedRoute로 인증 필요 페이지 보호
 *
 * 사용법:
 *   npm run dev
 *   브라우저에서 http://localhost:5173 접속
 * ============================================================================
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// 페이지 컴포넌트
import IntroPage from './pages/IntroPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ViewerPage from './pages/ViewerPage'
import AdminPage from './pages/AdminPage'

/**
 * ProtectedRoute 컴포넌트
 * 인증되지 않은 사용자를 로그인 페이지로 리다이렉트
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  // 인증 상태 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-medical-darker flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white">인증 확인 중...</p>
        </div>
      </div>
    )
  }

  // 인증되지 않음
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

/**
 * AdminRoute 컴포넌트
 * 관리자가 아닌 사용자를 대시보드로 리다이렉트
 */
function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()

  // 인증 상태 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-medical-darker flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white">권한 확인 중...</p>
        </div>
      </div>
    )
  }

  // 인증되지 않음
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // 관리자 아님
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

/**
 * 앱 라우터
 */
function AppRouter() {
  return (
    <Routes>
      {/* 공개 라우트 */}
      <Route path="/" element={<IntroPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* 보호된 라우트 */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/viewer/:sessionId"
        element={
          <ProtectedRoute>
            <ViewerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />

      {/* 404 - 대시보드로 리다이렉트 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/**
 * 메인 App 컴포넌트
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
