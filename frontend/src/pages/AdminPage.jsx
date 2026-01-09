/**
 * ============================================================================
 * AdminPage - Reader Study Frontend (Phase 5)
 * ============================================================================
 * 역할: 관리자 대시보드 (리더 관리, 세션 배정, 감사 로그)
 *
 * 탭:
 *   - 연구 설정: 세션/블록 구조, 입력 설정
 *   - 진행 현황: 그룹/리더별 진행률
 *   - 리더 관리: 리더 목록, 생성, 수정, 비활성화
 *   - 감사 로그: 시스템 활동 로그 조회
 *   - 데이터 내보내기: CSV/JSON 다운로드
 *
 * 디자인:
 *   - 글래스모피즘 카드
 *   - 탭 네비게이션 아이콘
 *   - 통계 카드 그라데이션
 *   - 모달 글래스 효과
 *
 * 라우트: /admin (관리자 전용)
 * ============================================================================
 */

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { adminApi, authApi, studyConfigApi, dashboardApi } from '../services/api'

// ============================================================================
// 아이콘 컴포넌트
// ============================================================================

const SettingsIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const ChartIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 16l4-4 4 4 5-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const UsersIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="9" cy="7" r="3" />
    <path d="M3 18c0-3 3-5 6-5s6 2 6 5" />
    <circle cx="17" cy="8" r="2" />
    <path d="M21 18c0-2-2-3.5-4-3.5" />
  </svg>
)

const LogIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
  </svg>
)

const DownloadIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const LockIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const UnlockIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
)

const KeyIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CloseIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const LogoutIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const DashboardIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
)

const SessionIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PlusIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
)

const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const AlertIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const AdminBadgeIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
  </svg>
)

const ReaderIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
)

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * UTC ISO 문자열을 한국 시간(KST)으로 변환
 */
function formatKST(isoString) {
  if (!isoString) return '-'
  const utcString = isoString.endsWith('Z') ? isoString : isoString + 'Z'
  const date = new Date(utcString)
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

export default function AdminPage() {
  const navigate = useNavigate()
  const { user, logout, getToken, isAdmin } = useAuth()

  const [activeTab, setActiveTab] = useState('study-config')
  const [readers, setReaders] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // 연구 설정 상태
  const [studyConfig, setStudyConfig] = useState(null)
  const [isEditingConfig, setIsEditingConfig] = useState(false)
  const [configForm, setConfigForm] = useState({})
  const [editingGroupName, setEditingGroupName] = useState(null)

  // 대시보드 상태
  const [dashboardSummary, setDashboardSummary] = useState(null)
  const [readerProgress, setReaderProgress] = useState([])
  const [groupProgress, setGroupProgress] = useState([])
  const [sessionStats, setSessionStats] = useState([])

  // 리더/관리자 생성 폼
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({
    reader_code: '',
    name: '',
    email: '',
    password: '',
    group: 1,
    role: 'reader'
  })

  // 비밀번호 변경 모달 (자기 자신)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // 비밀번호 재설정 모달 (다른 사용자)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null)
  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  // 세션 관리 모달
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessionTarget, setSessionTarget] = useState(null)
  const [sessionTargetDetails, setSessionTargetDetails] = useState(null)

  // 권한 체크
  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAdmin, navigate])

  // 데이터 로드
  useEffect(() => {
    if (activeTab === 'study-config') {
      loadStudyConfig()
    } else if (activeTab === 'dashboard') {
      loadDashboardData()
      loadStudyConfig()
    } else if (activeTab === 'readers') {
      loadReaders()
      loadStudyConfig()
    } else if (activeTab === 'logs') {
      loadAuditLogs()
    }
  }, [activeTab])

  // 연구 설정 로드
  const loadStudyConfig = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await studyConfigApi.getConfig(getToken())
      setStudyConfig(data)
      setConfigForm({
        study_name: data.study_name || '',
        study_description: data.study_description || '',
        ai_threshold: data.ai_threshold || 0.30,
        k_max: data.k_max || 3,
        require_lesion_marking: data.require_lesion_marking ?? true,
        total_sessions: data.total_sessions || 2,
        total_blocks: data.total_blocks || 2,
        total_groups: data.total_groups || 2,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 대시보드 데이터 로드
  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [summary, readers, groups, sessions] = await Promise.all([
        dashboardApi.getSummary(getToken()),
        dashboardApi.getByReader(getToken()),
        dashboardApi.getByGroup(getToken()),
        dashboardApi.getBySession(getToken()),
      ])
      setDashboardSummary(summary)
      setReaderProgress(readers)
      setGroupProgress(groups)
      setSessionStats(sessions)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 연구 설정 저장
  const handleSaveConfig = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)
      await studyConfigApi.updateConfig(getToken(), configForm)
      setSuccessMessage('연구 설정이 저장되었습니다')
      setIsEditingConfig(false)
      loadStudyConfig()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 연구 설정 잠금
  const handleLockConfig = async () => {
    if (!confirm('정말 연구 설정을 잠그시겠습니까?\n잠금 후에는 핵심 설정을 변경할 수 없습니다.')) return
    try {
      setLoading(true)
      setError(null)
      await studyConfigApi.lockConfig(getToken())
      setSuccessMessage('연구 설정이 잠겼습니다')
      loadStudyConfig()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 그룹명 저장
  const handleSaveGroupName = async (group, newName) => {
    if (!newName || newName.trim() === '') return
    try {
      const updatedNames = {
        ...(studyConfig.group_names || {}),
        [group]: newName.trim()
      }
      await studyConfigApi.updateConfig(getToken(), { group_names: updatedNames })
      setSuccessMessage('그룹명이 저장되었습니다')
      loadStudyConfig()
    } catch (err) {
      setError(err.message)
    }
  }

  const loadReaders = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await adminApi.getReaders(getToken(), true)
      setReaders(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadAuditLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await adminApi.getAuditLogs(getToken(), { limit: 100 })
      setAuditLogs(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateReader = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError(null)
      await adminApi.createReader(getToken(), createForm)
      setSuccessMessage(createForm.role === 'admin' ? '관리자가 생성되었습니다' : '리더가 생성되었습니다')
      setShowCreateForm(false)
      setCreateForm({ reader_code: '', name: '', email: '', password: '', group: 1, role: 'reader' })
      loadReaders()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다')
      return
    }
    if (passwordForm.newPassword.length < 4) {
      setError('비밀번호는 최소 4자 이상이어야 합니다')
      return
    }
    try {
      setLoading(true)
      setError(null)
      await authApi.changePassword(getToken(), passwordForm.currentPassword, passwordForm.newPassword)
      setSuccessMessage('비밀번호가 변경되었습니다')
      setShowPasswordModal(false)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다')
      return
    }
    if (resetPasswordForm.newPassword.length < 4) {
      setError('비밀번호는 최소 4자 이상이어야 합니다')
      return
    }
    try {
      setLoading(true)
      setError(null)
      await adminApi.updateReaderPassword(getToken(), resetPasswordTarget.id, resetPasswordForm.newPassword)
      setSuccessMessage(`${resetPasswordTarget.name}의 비밀번호가 재설정되었습니다`)
      setShowResetPasswordModal(false)
      setResetPasswordTarget(null)
      setResetPasswordForm({ newPassword: '', confirmPassword: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openResetPasswordModal = (reader) => {
    setResetPasswordTarget(reader)
    setShowResetPasswordModal(true)
    setError(null)
  }

  const openSessionModal = async (reader) => {
    setSessionTarget(reader)
    setShowSessionModal(true)
    setError(null)
    try {
      const details = await adminApi.getReader(getToken(), reader.id)
      setSessionTargetDetails(details)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    const confirmed = confirm(
      '⚠️ 세션 할당을 취소하시겠습니까?\n\n' +
      '이 작업은 다음 데이터를 삭제합니다:\n' +
      '• 세션 할당 정보\n' +
      '• 진행 상태\n\n' +
      '※ 제출된 결과(study_results)는 유지됩니다.'
    )
    if (!confirmed) return
    try {
      setLoading(true)
      setError(null)
      await adminApi.deleteSession(getToken(), sessionId)
      setSuccessMessage('세션 할당이 취소되었습니다')
      const details = await adminApi.getReader(getToken(), sessionTarget.id)
      setSessionTargetDetails(details)
      loadReaders()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetSession = async (sessionId) => {
    const confirmed = confirm(
      '⚠️ 세션을 초기화하시겠습니까?\n\n' +
      '이 작업은 다음 데이터를 삭제합니다:\n' +
      '• 진행 상태 (처음부터 다시 시작)\n' +
      '• 케이스 순서 (재진입 시 새로 생성)\n' +
      '• 제출된 결과 (study_results) ⚠️\n' +
      '• 병변 마커 (lesion_marks) ⚠️\n\n' +
      '※ 이 작업은 되돌릴 수 없습니다!'
    )
    if (!confirmed) return
    try {
      setLoading(true)
      setError(null)
      await adminApi.resetSession(getToken(), sessionId)
      setSuccessMessage('세션이 초기화되었습니다 (제출된 결과 포함)')
      const details = await adminApi.getReader(getToken(), sessionTarget.id)
      setSessionTargetDetails(details)
      loadReaders()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignSession = async (readerId, sessionCode) => {
    try {
      setLoading(true)
      setError(null)
      await adminApi.assignSession(getToken(), readerId, sessionCode)
      setSuccessMessage(`세션 ${sessionCode}이 할당되었습니다`)
      loadReaders()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivateReader = async (readerId) => {
    if (!confirm('정말 이 리더를 비활성화하시겠습니까?')) return
    try {
      setLoading(true)
      setError(null)
      await adminApi.deactivateReader(getToken(), readerId)
      setSuccessMessage('리더가 비활성화되었습니다')
      loadReaders()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReactivateReader = async (readerId) => {
    if (!confirm('이 리더를 재활성화하시겠습니까?')) return
    try {
      setLoading(true)
      setError(null)
      await adminApi.updateReader(getToken(), readerId, { is_active: true })
      setSuccessMessage('리더가 재활성화되었습니다')
      loadReaders()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 리더 그룹 변경
  const handleChangeReaderGroup = async (readerId, newGroup) => {
    try {
      setLoading(true)
      setError(null)
      await adminApi.updateReader(getToken(), readerId, { group: newGroup })
      setSuccessMessage(`그룹이 변경되었습니다`)
      loadReaders()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  // 메시지 자동 숨김
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  const tabs = [
    { id: 'study-config', label: '연구 설정', icon: SettingsIcon },
    { id: 'dashboard', label: '진행 현황', icon: ChartIcon },
    { id: 'readers', label: '리더 관리', icon: UsersIcon },
    { id: 'logs', label: '감사 로그', icon: LogIcon },
    { id: 'export', label: '데이터 내보내기', icon: DownloadIcon }
  ]

  return (
    <div className="min-h-screen bg-mesh">
      {/* 헤더 */}
      <header className="glass-card border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <SettingsIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
                  관리자 대시보드
                </h1>
                <p className="text-sm text-gray-500">Reader Study MVP</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <DashboardIcon className="w-4 h-4" />
                <span className="text-sm">대시보드</span>
              </Link>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AdminBadgeIcon className="w-4 h-4 text-amber-400" />
                <span className="text-amber-400 text-sm font-medium">{user?.name}</span>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                title="비밀번호 변경"
              >
                <KeyIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogoutIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="glass-card border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-4 font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 알림 메시지 */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 animate-fade-in-up">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <CheckIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-emerald-400">{successMessage}</p>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 animate-fade-in-up">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertIcon className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* 연구 설정 탭 */}
        {activeTab === 'study-config' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Lock 상태 배너 */}
            {studyConfig?.is_locked && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <LockIcon className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-400 font-medium">연구 설정이 잠겼습니다</p>
                  <p className="text-amber-400/70 text-sm">핵심 설정은 변경할 수 없습니다. {studyConfig.locked_at && `(${formatKST(studyConfig.locked_at)})`}</p>
                </div>
              </div>
            )}

            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">연구 설정</h2>
              </div>
              <div className="flex gap-2">
                {!studyConfig?.is_locked && (
                  <>
                    {isEditingConfig ? (
                      <>
                        <button
                          onClick={() => setIsEditingConfig(false)}
                          className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-all"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleSaveConfig}
                          disabled={loading}
                          className="px-4 py-2 rounded-lg btn-primary text-white disabled:opacity-50"
                        >
                          저장
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditingConfig(true)}
                        className="px-4 py-2 rounded-lg btn-primary text-white"
                      >
                        수정
                      </button>
                    )}
                    <button
                      onClick={handleLockConfig}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                      <LockIcon className="w-4 h-4" />
                      잠금
                    </button>
                  </>
                )}
              </div>
            </div>

            {studyConfig && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 구조 설정 */}
                <div className="glass-card rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <SessionIcon className="w-5 h-5 text-blue-400" />
                    세션/블록 구조
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-gray-400">총 세션 수</span>
                      {isEditingConfig && !studyConfig.is_locked ? (
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={configForm.total_sessions}
                          onChange={e => setConfigForm({...configForm, total_sessions: parseInt(e.target.value) || 1})}
                          className="w-20 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      ) : (
                        <span className="text-white font-medium">{studyConfig.total_sessions}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-gray-400">세션당 블록 수</span>
                      {isEditingConfig && !studyConfig.is_locked ? (
                        <input
                          type="number"
                          min="1"
                          max="4"
                          value={configForm.total_blocks}
                          onChange={e => setConfigForm({...configForm, total_blocks: parseInt(e.target.value) || 1})}
                          className="w-20 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      ) : (
                        <span className="text-white font-medium">{studyConfig.total_blocks}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-gray-400">리더 그룹 수</span>
                      {isEditingConfig && !studyConfig.is_locked ? (
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={configForm.total_groups}
                          onChange={e => setConfigForm({...configForm, total_groups: parseInt(e.target.value) || 1})}
                          className="w-20 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      ) : (
                        <span className="text-white font-medium">{studyConfig.total_groups}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400">케이스 순서</span>
                      <span className="px-3 py-1 rounded-lg bg-white/5 text-white text-sm">
                        {studyConfig.case_order_mode === 'random' ? '랜덤' : '고정'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 입력 설정 */}
                <div className="glass-card rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-purple-400" />
                    판독 입력 설정
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-gray-400">최대 병변 마커 수 (k_max)</span>
                      {isEditingConfig && !studyConfig.is_locked ? (
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={configForm.k_max}
                          onChange={e => setConfigForm({...configForm, k_max: parseInt(e.target.value)})}
                          className="w-20 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      ) : (
                        <span className="text-white font-medium">{studyConfig.k_max}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-gray-400">AI 확률 임계값</span>
                      {isEditingConfig ? (
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={configForm.ai_threshold}
                          onChange={e => setConfigForm({...configForm, ai_threshold: parseFloat(e.target.value)})}
                          className="w-20 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      ) : (
                        <span className="text-white font-medium">{studyConfig.ai_threshold}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-gray-400">Lesion marking 필수</span>
                      {isEditingConfig && !studyConfig.is_locked ? (
                        <input
                          type="checkbox"
                          checked={configForm.require_lesion_marking}
                          onChange={e => setConfigForm({...configForm, require_lesion_marking: e.target.checked})}
                          className="w-5 h-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500/50"
                        />
                      ) : (
                        <span className={`px-3 py-1 rounded-lg text-sm ${studyConfig.require_lesion_marking ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {studyConfig.require_lesion_marking ? '예' : '아니오'}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400">Confidence 입력 방식</span>
                      <span className="px-3 py-1 rounded-lg bg-white/5 text-white text-sm">
                        {studyConfig.confidence_mode}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 메타 정보 */}
                <div className="glass-card rounded-xl p-6 lg:col-span-2">
                  <h3 className="text-lg font-semibold text-white mb-4">메타 정보</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">연구 이름</label>
                      {isEditingConfig ? (
                        <input
                          type="text"
                          value={configForm.study_name}
                          onChange={e => setConfigForm({...configForm, study_name: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      ) : (
                        <p className="text-white">{studyConfig.study_name}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">설명</label>
                      {isEditingConfig ? (
                        <textarea
                          value={configForm.study_description || ''}
                          onChange={e => setConfigForm({...configForm, study_description: e.target.value})}
                          rows={3}
                          className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      ) : (
                        <p className="text-white">{studyConfig.study_description || '-'}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Crossover 매핑 */}
                <div className="glass-card rounded-xl p-6 lg:col-span-2">
                  <h3 className="text-lg font-semibold text-white mb-4">Crossover 매핑</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 border-b border-white/10">
                          <th className="py-3 text-left font-medium">그룹</th>
                          {Array.from({ length: studyConfig.total_sessions || 2 }, (_, si) => si + 1).map(sessionNum =>
                            Array.from({ length: studyConfig.total_blocks || 2 }, (_, bi) => String.fromCharCode(65 + bi)).map(blockLetter => (
                              <th key={`S${sessionNum}_${blockLetter}`} className="py-3 text-center font-medium">
                                S{sessionNum} Block {blockLetter}
                              </th>
                            ))
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {studyConfig.crossover_mapping && Object.entries(studyConfig.crossover_mapping).map(([group, sessions]) => (
                          <tr key={group} className="border-b border-white/5">
                            <td className="py-3">
                              {editingGroupName === group ? (
                                <input
                                  type="text"
                                  value={configForm.group_names?.[group] || ''}
                                  onChange={e => setConfigForm({
                                    ...configForm,
                                    group_names: {
                                      ...configForm.group_names,
                                      [group]: e.target.value
                                    }
                                  })}
                                  onBlur={(e) => {
                                    setEditingGroupName(null)
                                    handleSaveGroupName(group, e.target.value)
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      setEditingGroupName(null)
                                      handleSaveGroupName(group, e.target.value)
                                    }
                                  }}
                                  autoFocus
                                  className="w-32 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                  maxLength={50}
                                />
                              ) : (
                                <span
                                  onClick={() => {
                                    setEditingGroupName(group)
                                    if (!configForm.group_names) {
                                      setConfigForm({
                                        ...configForm,
                                        group_names: studyConfig.group_names || {}
                                      })
                                    }
                                  }}
                                  className="cursor-pointer hover:bg-white/10 px-2 py-1 rounded text-white inline-flex items-center gap-1 transition-all"
                                  title="클릭하여 수정"
                                >
                                  {studyConfig.group_names?.[group] || group.replace('_', ' ').toUpperCase()}
                                  <span className="text-gray-500 text-xs">✏️</span>
                                </span>
                              )}
                            </td>
                            {Array.from({ length: studyConfig.total_sessions || 2 }, (_, si) => si + 1).map(sessionNum =>
                              Array.from({ length: studyConfig.total_blocks || 2 }, (_, bi) => String.fromCharCode(65 + bi)).map(blockLetter => {
                                const sessionKey = `S${sessionNum}`
                                const blockKey = `block_${blockLetter}`
                                const mode = sessions[sessionKey]?.[blockKey]
                                return (
                                  <td key={`${sessionKey}_${blockLetter}`} className="py-3 text-center">
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                                      mode === 'AIDED'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    }`}>
                                      {mode || '-'}
                                    </span>
                                  </td>
                                )
                              })
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 대시보드 탭 */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <ChartIcon className="w-5 h-5 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">진행 현황</h2>
            </div>

            {/* 요약 카드 */}
            {dashboardSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <UsersIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-gray-400 text-sm">전체 리더</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{dashboardSummary.total_readers}</p>
                  <p className="text-xs text-gray-500 mt-1">시작: {dashboardSummary.readers_started} / 완료: {dashboardSummary.readers_completed}</p>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <SessionIcon className="w-5 h-5 text-purple-400" />
                    </div>
                    <p className="text-gray-400 text-sm">전체 세션</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{dashboardSummary.total_sessions}</p>
                  <p className="text-xs text-gray-500 mt-1">완료: {dashboardSummary.completed_sessions} / 진행: {dashboardSummary.in_progress_sessions}</p>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <ChartIcon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-gray-400 text-sm">전체 진행률</p>
                  </div>
                  <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    {dashboardSummary.overall_progress_percent}%
                  </p>
                  <div className="mt-2 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all progress-bar"
                      style={{ width: `${dashboardSummary.overall_progress_percent}%` }}
                    />
                  </div>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dashboardSummary.study_config_locked ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
                      {dashboardSummary.study_config_locked ? <LockIcon className="w-5 h-5 text-amber-400" /> : <UnlockIcon className="w-5 h-5 text-emerald-400" />}
                    </div>
                    <p className="text-gray-400 text-sm">설정 상태</p>
                  </div>
                  <p className={`text-2xl font-bold ${dashboardSummary.study_config_locked ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {dashboardSummary.study_config_locked ? '잠김' : '열림'}
                  </p>
                </div>
              </div>
            )}

            {/* 그룹별 진행률 */}
            {groupProgress.length > 0 && (
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">그룹별 진행률</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupProgress.map(group => (
                    <div key={group.group} className="p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white font-medium">
                          {studyConfig?.group_names?.[`group_${group.group}`] || `Group ${group.group}`}
                        </span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-bold">
                          {group.progress_percent}%
                        </span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                          style={{ width: `${group.progress_percent}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400">
                        리더: {group.total_readers}명 (시작: {group.readers_started}, 완료: {group.readers_completed})
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 리더별 진행 현황 */}
            {readerProgress.length > 0 && (
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">리더별 진행 현황</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-white/10">
                        <th className="py-3 text-left font-medium">리더</th>
                        <th className="py-3 text-center font-medium">그룹</th>
                        {Array.from({ length: studyConfig?.total_sessions || 2 }, (_, i) => i + 1).map(sessionNum => (
                          <th key={sessionNum} className="py-3 text-center font-medium">S{sessionNum}</th>
                        ))}
                        <th className="py-3 text-center font-medium">전체</th>
                        <th className="py-3 text-center font-medium">상태</th>
                        <th className="py-3 text-right font-medium">마지막 접속</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readerProgress.map(reader => (
                        <tr key={reader.reader_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-3">
                            <p className="text-white font-medium">{reader.name}</p>
                            <p className="text-xs text-gray-500">{reader.reader_code}</p>
                          </td>
                          <td className="py-3 text-center text-gray-300">
                            {reader.group
                              ? (studyConfig?.group_names?.[`group_${reader.group}`] || `G${reader.group}`)
                              : '-'}
                          </td>
                          {Array.from({ length: studyConfig?.total_sessions || 2 }, (_, i) => i + 1).map(sessionNum => {
                            const session = reader.sessions.find(s => s.session_code === `S${sessionNum}`)
                            return (
                              <td key={sessionNum} className="py-3 text-center">
                                {session ? (
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    session.status === 'completed'
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-white/10 text-gray-300'
                                  }`}>
                                    {session.progress_percent}%
                                  </span>
                                ) : <span className="text-gray-600">-</span>}
                              </td>
                            )
                          })}
                          <td className="py-3 text-center">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-medium">
                              {reader.total_progress_percent}%
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              reader.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              reader.status === 'active' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                              'bg-white/10 text-gray-400 border border-white/10'
                            }`}>
                              {reader.status === 'completed' ? '완료' : reader.status === 'active' ? '진행중' : '대기'}
                            </span>
                          </td>
                          <td className="py-3 text-right text-gray-400 text-xs">
                            {reader.last_accessed_at ? formatKST(reader.last_accessed_at) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 리더 관리 탭 */}
        {activeTab === 'readers' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">리더 관리</h2>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg btn-primary text-white"
              >
                <PlusIcon className="w-4 h-4" />
                리더 추가
              </button>
            </div>

            {/* 계정 생성 폼 */}
            {showCreateForm && (
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  {createForm.role === 'admin' ? <AdminBadgeIcon className="w-5 h-5 text-amber-400" /> : <ReaderIcon className="w-5 h-5 text-blue-400" />}
                  새 {createForm.role === 'admin' ? '관리자' : '리더'} 생성
                </h3>
                <form onSubmit={handleCreateReader} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    value={createForm.role}
                    onChange={e => setCreateForm({...createForm, role: e.target.value})}
                    className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="reader" className="bg-gray-800">리더 (Reader)</option>
                    <option value="admin" className="bg-gray-800">관리자 (Admin)</option>
                  </select>
                  <input
                    type="text"
                    placeholder={createForm.role === 'admin' ? '관리자 코드 (예: ADMIN01)' : '리더 코드 (예: R01)'}
                    value={createForm.reader_code}
                    onChange={e => setCreateForm({...createForm, reader_code: e.target.value})}
                    className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                  <input
                    type="text"
                    placeholder="이름"
                    value={createForm.name}
                    onChange={e => setCreateForm({...createForm, name: e.target.value})}
                    className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                  <input
                    type="email"
                    placeholder="이메일"
                    value={createForm.email}
                    onChange={e => setCreateForm({...createForm, email: e.target.value})}
                    className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                  <input
                    type="password"
                    placeholder="비밀번호"
                    value={createForm.password}
                    onChange={e => setCreateForm({...createForm, password: e.target.value})}
                    className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    required
                  />
                  {createForm.role === 'reader' && (
                    <select
                      value={createForm.group}
                      onChange={e => setCreateForm({...createForm, group: parseInt(e.target.value)})}
                      className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      {Array.from({ length: studyConfig?.total_groups || 2 }, (_, i) => i + 1).map(groupNum => (
                        <option key={groupNum} value={groupNum} className="bg-gray-800">
                          {studyConfig?.group_names?.[`group_${groupNum}`] || `Group ${groupNum}`}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2 md:col-span-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`px-6 py-2.5 rounded-lg text-white disabled:opacity-50 transition-all ${
                        createForm.role === 'admin'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25'
                          : 'btn-primary'
                      }`}
                    >
                      생성
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-6 py-2.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-all"
                    >
                      취소
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 리더 목록 */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : (
              <div className="glass-card rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">역할</th>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">코드</th>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">이름</th>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">이메일</th>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">그룹</th>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">세션</th>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">상태</th>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readers.map(reader => (
                      <tr key={reader.id} className={`border-t border-white/5 hover:bg-white/5 transition-colors ${reader.role === 'admin' ? 'bg-amber-500/5' : ''}`}>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-medium ${
                            reader.role === 'admin'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {reader.role === 'admin' ? <AdminBadgeIcon className="w-3 h-3" /> : <ReaderIcon className="w-3 h-3" />}
                            {reader.role === 'admin' ? '관리자' : '리더'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-white font-mono text-sm">{reader.reader_code}</td>
                        <td className="px-4 py-4 text-white">{reader.name}</td>
                        <td className="px-4 py-4 text-gray-400 text-sm">{reader.email}</td>
                        <td className="px-4 py-4">
                          {reader.role === 'admin' ? (
                            <span className="text-gray-500">-</span>
                          ) : (
                            <select
                              value={reader.group || ''}
                              onChange={(e) => handleChangeReaderGroup(reader.id, parseInt(e.target.value))}
                              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500/50 cursor-pointer hover:bg-white/10 transition-colors"
                            >
                              {Array.from({ length: studyConfig?.total_groups || 2 }, (_, i) => i + 1).map(groupNum => (
                                <option key={groupNum} value={groupNum} className="bg-gray-800 text-white">
                                  {studyConfig?.group_names?.[`group_${groupNum}`] || `Group ${groupNum}`}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-4 text-white">
                          {reader.role === 'admin' ? <span className="text-gray-500">-</span> : `${reader.session_count}개`}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                            reader.is_active
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                          }`}>
                            {reader.is_active ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2 flex-wrap">
                            {reader.role === 'reader' && (
                              <>
                                {Array.from({ length: studyConfig?.total_sessions || 2 }, (_, i) => i + 1).map(sessionNum => (
                                  <button
                                    key={sessionNum}
                                    onClick={() => handleAssignSession(reader.id, `S${sessionNum}`)}
                                    className="px-2 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
                                  >
                                    S{sessionNum}
                                  </button>
                                ))}
                                {reader.session_count > 0 && (
                                  <button
                                    onClick={() => openSessionModal(reader)}
                                    className="px-2 py-1 text-xs rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                                  >
                                    관리
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={() => openResetPasswordModal(reader)}
                              className="px-2 py-1 text-xs rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-all"
                            >
                              PW
                            </button>
                            {reader.id !== user?.id && (
                              reader.is_active ? (
                                <button
                                  onClick={() => handleDeactivateReader(reader.id)}
                                  className="px-2 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                                >
                                  비활성화
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivateReader(reader.id)}
                                  className="px-2 py-1 text-xs rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                                >
                                  활성화
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {readers.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    등록된 리더가 없습니다
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 감사 로그 탭 */}
        {activeTab === 'logs' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <LogIcon className="w-5 h-5 text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">감사 로그</h2>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : (
              <div className="glass-card rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">시간</th>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">사용자</th>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">작업</th>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">리소스</th>
                      <th className="px-4 py-4 text-left text-gray-400 font-medium text-sm">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-sm">
                          {formatKST(log.created_at)}
                        </td>
                        <td className="px-4 py-3 text-white">{log.reader_code || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                            log.action.includes('LOGIN') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            log.action.includes('ADMIN') ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-white/10 text-gray-300 border border-white/10'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-sm">
                          {log.resource_type ? `${log.resource_type}:${log.resource_id}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-sm">{log.ip_address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {auditLogs.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    로그가 없습니다
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 데이터 내보내기 탭 */}
        {activeTab === 'export' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <DownloadIcon className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">데이터 내보내기</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <DownloadIcon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">CSV 형식</h3>
                    <p className="text-gray-400 text-sm">스프레드시트 호환</p>
                  </div>
                </div>
                <p className="text-gray-400 mb-6 text-sm">
                  환자 수준 결과와 병변 마커를 포함한 CSV 파일을 다운로드합니다.
                </p>
                <a
                  href={adminApi.getExportUrl('csv')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg btn-primary text-white"
                >
                  <DownloadIcon className="w-4 h-4" />
                  CSV 다운로드
                </a>
              </div>

              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <DownloadIcon className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">JSON 형식</h3>
                    <p className="text-gray-400 text-sm">구조화된 데이터</p>
                  </div>
                </div>
                <p className="text-gray-400 mb-6 text-sm">
                  구조화된 JSON 형식으로 전체 데이터를 다운로드합니다.
                </p>
                <a
                  href={adminApi.getExportUrl('json')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25"
                >
                  <DownloadIcon className="w-4 h-4" />
                  JSON 다운로드
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 비밀번호 재설정 모달 */}
      {showResetPasswordModal && resetPasswordTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <KeyIcon className="w-5 h-5 text-purple-400" />
                비밀번호 재설정
              </h3>
              <button
                onClick={() => {
                  setShowResetPasswordModal(false)
                  setResetPasswordTarget(null)
                  setResetPasswordForm({ newPassword: '', confirmPassword: '' })
                  setError(null)
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-gray-400 text-sm">대상 계정</p>
              <p className="text-white font-medium">{resetPasswordTarget.name} ({resetPasswordTarget.reader_code})</p>
              <p className="text-gray-500 text-sm">{resetPasswordTarget.email}</p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">새 비밀번호</label>
                <input
                  type="password"
                  value={resetPasswordForm.newPassword}
                  onChange={e => setResetPasswordForm({...resetPasswordForm, newPassword: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  required
                  minLength={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={resetPasswordForm.confirmPassword}
                  onChange={e => setResetPasswordForm({...resetPasswordForm, confirmPassword: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  required
                  minLength={4}
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 disabled:opacity-50 transition-all"
                >
                  {loading ? '재설정 중...' : '비밀번호 재설정'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false)
                    setResetPasswordTarget(null)
                    setResetPasswordForm({ newPassword: '', confirmPassword: '' })
                    setError(null)
                  }}
                  className="px-4 py-2.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-all"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <KeyIcon className="w-5 h-5 text-blue-400" />
                비밀번호 변경
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                  setError(null)
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">현재 비밀번호</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">새 비밀번호</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                  minLength={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                  minLength={4}
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-lg btn-primary text-white disabled:opacity-50 transition-all"
                >
                  {loading ? '변경 중...' : '비밀번호 변경'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false)
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                    setError(null)
                  }}
                  className="px-4 py-2.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-all"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 세션 관리 모달 */}
      {showSessionModal && sessionTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <SessionIcon className="w-5 h-5 text-amber-400" />
                세션 관리
              </h3>
              <button
                onClick={() => {
                  setShowSessionModal(false)
                  setSessionTarget(null)
                  setSessionTargetDetails(null)
                  setError(null)
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-gray-400 text-sm">리더 정보</p>
              <p className="text-white font-medium">{sessionTarget.name} ({sessionTarget.reader_code})</p>
              <p className="text-gray-500 text-sm">
                {studyConfig?.group_names?.[`group_${sessionTarget.group}`] || `Group ${sessionTarget.group || '-'}`}
              </p>
            </div>

            {!sessionTargetDetails ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-400 mt-2">세션 정보 로딩 중...</p>
              </div>
            ) : sessionTargetDetails.sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                할당된 세션이 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {sessionTargetDetails.sessions.map(session => (
                  <div key={session.session_id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{session.session_code}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-lg font-medium ${
                            session.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            session.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            'bg-white/10 text-gray-400 border border-white/10'
                          }`}>
                            {session.status === 'completed' ? '완료' : session.status === 'in_progress' ? '진행중' : '대기'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          Block A: <span className={session.block_a_mode === 'AIDED' ? 'text-amber-400' : 'text-blue-400'}>{session.block_a_mode}</span>
                          {' / '}
                          Block B: <span className={session.block_b_mode === 'AIDED' ? 'text-amber-400' : 'text-blue-400'}>{session.block_b_mode}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResetSession(session.session_id)}
                          disabled={loading}
                          className="px-3 py-1.5 text-sm rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50 transition-all"
                          title="초기화"
                        >
                          초기화
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.session_id)}
                          disabled={loading}
                          className="px-3 py-1.5 text-sm rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 transition-all"
                          title="할당 취소"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => {
                  setShowSessionModal(false)
                  setSessionTarget(null)
                  setSessionTargetDetails(null)
                  setError(null)
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
