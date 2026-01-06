/**
 * ============================================================================
 * AdminPage - Reader Study Frontend (Phase 5)
 * ============================================================================
 * 역할: 관리자 대시보드 (리더 관리, 세션 배정, 감사 로그)
 *
 * 탭:
 *   - 리더 관리: 리더 목록, 생성, 수정, 비활성화
 *   - 세션 관리: 세션 배정, 초기화
 *   - 감사 로그: 시스템 활동 로그 조회
 *   - 데이터 내보내기: CSV/JSON 다운로드
 *
 * 라우트: /admin (관리자 전용)
 * ============================================================================
 */

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { adminApi, authApi, studyConfigApi, dashboardApi } from '../services/api'

/**
 * UTC ISO 문자열을 한국 시간(KST)으로 변환
 * 서버에서 UTC로 저장되지만 "Z" 접미사 없이 전달되는 경우를 처리
 * @param {string} isoString - ISO 8601 형식의 UTC 시간
 * @returns {string} - 한국 시간 형식 (YYYY. MM. DD. HH:MM:SS)
 */
function formatKST(isoString) {
  if (!isoString) return '-'
  // 서버가 UTC로 저장하지만 "Z" 없이 보내므로 명시적으로 추가
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
  const [editingGroupName, setEditingGroupName] = useState(null)  // 현재 편집 중인 그룹 키

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
      loadStudyConfig()  // 그룹명 표시를 위해 studyConfig도 로드
    } else if (activeTab === 'readers') {
      loadReaders()
      loadStudyConfig()  // 그룹명 표시를 위해 studyConfig도 로드
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
        // 구조 설정 (잠금 전에만 수정 가능)
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

  // 그룹명 저장 (즉시 저장)
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

  // 비밀번호 변경 처리 (자기 자신)
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

  // 비밀번호 재설정 처리 (다른 사용자)
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

  // 비밀번호 재설정 모달 열기
  const openResetPasswordModal = (reader) => {
    setResetPasswordTarget(reader)
    setShowResetPasswordModal(true)
    setError(null)
  }

  // 세션 관리 모달 열기
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

  // 세션 삭제
  const handleDeleteSession = async (sessionId) => {
    if (!confirm('정말 이 세션 할당을 취소하시겠습니까?')) return
    try {
      setLoading(true)
      setError(null)
      await adminApi.deleteSession(getToken(), sessionId)
      setSuccessMessage('세션 할당이 취소되었습니다')
      // 세션 목록 새로고침
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

  // 리더 재활성화
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
    { id: 'study-config', label: '연구 설정' },
    { id: 'dashboard', label: '진행 현황' },
    { id: 'readers', label: '리더 관리' },
    { id: 'logs', label: '감사 로그' },
    { id: 'export', label: '데이터 내보내기' }
  ]

  return (
    <div className="min-h-screen bg-medical-darker">
      {/* 헤더 */}
      <header className="bg-medical-dark border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">관리자 대시보드</h1>
                <p className="text-sm text-gray-400">Reader Study MVP</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors">
                대시보드
              </Link>
              <span className="text-gray-600">|</span>
              <span className="text-white">{user?.name}</span>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1"
                title="비밀번호 변경"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                비밀번호 변경
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="bg-medical-dark border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary-400 border-b-2 border-primary-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 알림 메시지 */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-600 rounded-lg">
            <p className="text-green-400">{successMessage}</p>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* 연구 설정 탭 */}
        {activeTab === 'study-config' && (
          <div className="space-y-6">
            {/* Lock 상태 배너 */}
            {studyConfig?.is_locked && (
              <div className="p-4 bg-yellow-900/30 border border-yellow-600 rounded-lg">
                <p className="text-yellow-400 font-medium">
                  🔒 연구 설정이 잠겼습니다. 핵심 설정은 변경할 수 없습니다.
                  {studyConfig.locked_at && ` (${formatKST(studyConfig.locked_at)})`}
                </p>
              </div>
            )}

            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">연구 설정</h2>
              <div className="flex gap-2">
                {!studyConfig?.is_locked && (
                  <>
                    {isEditingConfig ? (
                      <>
                        <button
                          onClick={() => setIsEditingConfig(false)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleSaveConfig}
                          disabled={loading}
                          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                        >
                          저장
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditingConfig(true)}
                        className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                      >
                        수정
                      </button>
                    )}
                    <button
                      onClick={handleLockConfig}
                      disabled={loading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      🔒 잠금
                    </button>
                  </>
                )}
              </div>
            </div>

            {studyConfig && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 구조 설정 */}
                <div className="bg-medical-dark rounded-xl border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">세션/블록 구조</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                      <span className="text-gray-400">총 세션 수</span>
                      {isEditingConfig && !studyConfig.is_locked ? (
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={configForm.total_sessions}
                          onChange={e => setConfigForm({...configForm, total_sessions: parseInt(e.target.value) || 1})}
                          className="w-20 px-2 py-1 bg-medical-darker border border-gray-700 rounded text-white text-right"
                        />
                      ) : (
                        <span className="text-white font-medium">{studyConfig.total_sessions}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                      <span className="text-gray-400">세션당 블록 수</span>
                      {isEditingConfig && !studyConfig.is_locked ? (
                        <input
                          type="number"
                          min="1"
                          max="4"
                          value={configForm.total_blocks}
                          onChange={e => setConfigForm({...configForm, total_blocks: parseInt(e.target.value) || 1})}
                          className="w-20 px-2 py-1 bg-medical-darker border border-gray-700 rounded text-white text-right"
                        />
                      ) : (
                        <span className="text-white font-medium">{studyConfig.total_blocks}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                      <span className="text-gray-400">리더 그룹 수</span>
                      {isEditingConfig && !studyConfig.is_locked ? (
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={configForm.total_groups}
                          onChange={e => setConfigForm({...configForm, total_groups: parseInt(e.target.value) || 1})}
                          className="w-20 px-2 py-1 bg-medical-darker border border-gray-700 rounded text-white text-right"
                        />
                      ) : (
                        <span className="text-white font-medium">{studyConfig.total_groups}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400">케이스 순서</span>
                      <span className="text-white font-medium">
                        {studyConfig.case_order_mode === 'random' ? '랜덤' : '고정'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 입력 설정 */}
                <div className="bg-medical-dark rounded-xl border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">판독 입력 설정</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                      <span className="text-gray-400">최대 병변 마커 수 (k_max)</span>
                      {isEditingConfig && !studyConfig.is_locked ? (
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={configForm.k_max}
                          onChange={e => setConfigForm({...configForm, k_max: parseInt(e.target.value)})}
                          className="w-20 px-2 py-1 bg-medical-darker border border-gray-700 rounded text-white text-right"
                        />
                      ) : (
                        <span className="text-white font-medium">{studyConfig.k_max}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                      <span className="text-gray-400">AI 확률 임계값</span>
                      {isEditingConfig ? (
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={configForm.ai_threshold}
                          onChange={e => setConfigForm({...configForm, ai_threshold: parseFloat(e.target.value)})}
                          className="w-20 px-2 py-1 bg-medical-darker border border-gray-700 rounded text-white text-right"
                        />
                      ) : (
                        <span className="text-white font-medium">{studyConfig.ai_threshold}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                      <span className="text-gray-400">Lesion marking 필수</span>
                      {isEditingConfig && !studyConfig.is_locked ? (
                        <input
                          type="checkbox"
                          checked={configForm.require_lesion_marking}
                          onChange={e => setConfigForm({...configForm, require_lesion_marking: e.target.checked})}
                          className="w-5 h-5"
                        />
                      ) : (
                        <span className="text-white font-medium">
                          {studyConfig.require_lesion_marking ? '예' : '아니오'}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400">Confidence 입력 방식</span>
                      <span className="text-white font-medium">{studyConfig.confidence_mode}</span>
                    </div>
                  </div>
                </div>

                {/* 메타 정보 */}
                <div className="bg-medical-dark rounded-xl border border-gray-800 p-6 lg:col-span-2">
                  <h3 className="text-lg font-semibold text-white mb-4">메타 정보</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-400 mb-2">연구 이름</label>
                      {isEditingConfig ? (
                        <input
                          type="text"
                          value={configForm.study_name}
                          onChange={e => setConfigForm({...configForm, study_name: e.target.value})}
                          className="w-full px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white"
                        />
                      ) : (
                        <p className="text-white">{studyConfig.study_name}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-2">설명</label>
                      {isEditingConfig ? (
                        <textarea
                          value={configForm.study_description || ''}
                          onChange={e => setConfigForm({...configForm, study_description: e.target.value})}
                          rows={3}
                          className="w-full px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white"
                        />
                      ) : (
                        <p className="text-white">{studyConfig.study_description || '-'}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Crossover 매핑 - 세션/블록 수에 맞춰 동적 생성 */}
                <div className="bg-medical-dark rounded-xl border border-gray-800 p-6 lg:col-span-2">
                  <h3 className="text-lg font-semibold text-white mb-4">Crossover 매핑</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="py-2 text-left">그룹</th>
                          {/* 세션/블록 헤더 동적 생성 */}
                          {Array.from({ length: studyConfig.total_sessions || 2 }, (_, si) => si + 1).map(sessionNum =>
                            Array.from({ length: studyConfig.total_blocks || 2 }, (_, bi) => String.fromCharCode(65 + bi)).map(blockLetter => (
                              <th key={`S${sessionNum}_${blockLetter}`} className="py-2 text-center">
                                S{sessionNum} Block {blockLetter}
                              </th>
                            ))
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {studyConfig.crossover_mapping && Object.entries(studyConfig.crossover_mapping).map(([group, sessions]) => (
                          <tr key={group} className="border-b border-gray-800">
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
                                  className="w-32 px-2 py-1 bg-medical-darker border border-gray-600 rounded text-white text-sm"
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
                                  className="cursor-pointer hover:bg-gray-700 px-2 py-1 rounded text-white inline-flex items-center gap-1"
                                  title="클릭하여 수정"
                                >
                                  {studyConfig.group_names?.[group] || group.replace('_', ' ').toUpperCase()}
                                  <span className="text-gray-500 text-xs">✏️</span>
                                </span>
                              )}
                            </td>
                            {/* 세션/블록 데이터 동적 생성 */}
                            {Array.from({ length: studyConfig.total_sessions || 2 }, (_, si) => si + 1).map(sessionNum =>
                              Array.from({ length: studyConfig.total_blocks || 2 }, (_, bi) => String.fromCharCode(65 + bi)).map(blockLetter => {
                                const sessionKey = `S${sessionNum}`
                                const blockKey = `block_${blockLetter}`
                                const mode = sessions[sessionKey]?.[blockKey]
                                return (
                                  <td key={`${sessionKey}_${blockLetter}`} className="py-3 text-center">
                                    <span className={`px-2 py-1 rounded text-xs ${mode === 'AIDED' ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>
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
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">진행 현황</h2>

            {/* 요약 카드 */}
            {dashboardSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-medical-dark rounded-xl border border-gray-800 p-4">
                  <p className="text-gray-400 text-sm">전체 리더</p>
                  <p className="text-2xl font-bold text-white">{dashboardSummary.total_readers}</p>
                  <p className="text-xs text-gray-500">시작: {dashboardSummary.readers_started} / 완료: {dashboardSummary.readers_completed}</p>
                </div>
                <div className="bg-medical-dark rounded-xl border border-gray-800 p-4">
                  <p className="text-gray-400 text-sm">전체 세션</p>
                  <p className="text-2xl font-bold text-white">{dashboardSummary.total_sessions}</p>
                  <p className="text-xs text-gray-500">완료: {dashboardSummary.completed_sessions} / 진행: {dashboardSummary.in_progress_sessions}</p>
                </div>
                <div className="bg-medical-dark rounded-xl border border-gray-800 p-4">
                  <p className="text-gray-400 text-sm">전체 진행률</p>
                  <p className="text-2xl font-bold text-primary-400">{dashboardSummary.overall_progress_percent}%</p>
                  <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all"
                      style={{ width: `${dashboardSummary.overall_progress_percent}%` }}
                    />
                  </div>
                </div>
                <div className="bg-medical-dark rounded-xl border border-gray-800 p-4">
                  <p className="text-gray-400 text-sm">설정 상태</p>
                  <p className={`text-2xl font-bold ${dashboardSummary.study_config_locked ? 'text-yellow-400' : 'text-green-400'}`}>
                    {dashboardSummary.study_config_locked ? '🔒 잠김' : '🔓 열림'}
                  </p>
                </div>
              </div>
            )}

            {/* 그룹별 진행률 */}
            {groupProgress.length > 0 && (
              <div className="bg-medical-dark rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">그룹별 진행률</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupProgress.map(group => (
                    <div key={group.group} className="p-4 bg-medical-darker rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white font-medium">
                          {studyConfig?.group_names?.[`group_${group.group}`] || `Group ${group.group}`}
                        </span>
                        <span className="text-primary-400 font-bold">{group.progress_percent}%</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-primary-500 transition-all"
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
              <div className="bg-medical-dark rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">리더별 진행 현황</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                        <th className="py-2 text-left">리더</th>
                        <th className="py-2 text-center">그룹</th>
                        {/* 세션 컬럼 - 연구 설정의 세션 수에 맞춰 동적 생성 */}
                        {Array.from({ length: studyConfig?.total_sessions || 2 }, (_, i) => i + 1).map(sessionNum => (
                          <th key={sessionNum} className="py-2 text-center">S{sessionNum} 진행률</th>
                        ))}
                        <th className="py-2 text-center">전체</th>
                        <th className="py-2 text-center">상태</th>
                        <th className="py-2 text-right">마지막 접속</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readerProgress.map(reader => {
                        return (
                          <tr key={reader.reader_id} className="border-b border-gray-800">
                            <td className="py-3">
                              <p className="text-white font-medium">{reader.name}</p>
                              <p className="text-xs text-gray-500">{reader.reader_code}</p>
                            </td>
                            <td className="py-3 text-center text-gray-300">
                              {reader.group
                                ? (studyConfig?.group_names?.[`group_${reader.group}`] || `Group ${reader.group}`)
                                : '-'}
                            </td>
                            {/* 세션 진행률 - 연구 설정의 세션 수에 맞춰 동적 생성 */}
                            {Array.from({ length: studyConfig?.total_sessions || 2 }, (_, i) => i + 1).map(sessionNum => {
                              const session = reader.sessions.find(s => s.session_code === `S${sessionNum}`)
                              return (
                                <td key={sessionNum} className="py-3 text-center">
                                  {session ? (
                                    <span className={session.status === 'completed' ? 'text-green-400' : 'text-gray-300'}>
                                      {session.progress_percent}%
                                    </span>
                                  ) : '-'}
                                </td>
                              )
                            })}
                            <td className="py-3 text-center text-primary-400 font-medium">
                              {reader.total_progress_percent}%
                            </td>
                            <td className="py-3 text-center">
                              <span className={`px-2 py-1 rounded text-xs ${
                                reader.status === 'completed' ? 'bg-green-900 text-green-300' :
                                reader.status === 'active' ? 'bg-blue-900 text-blue-300' :
                                'bg-gray-700 text-gray-300'
                              }`}>
                                {reader.status === 'completed' ? '완료' :
                                 reader.status === 'active' ? '진행중' : '대기'}
                              </span>
                            </td>
                            <td className="py-3 text-right text-gray-400 text-xs">
                              {reader.last_accessed_at ? formatKST(reader.last_accessed_at) : '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 리더 관리 탭 */}
        {activeTab === 'readers' && (
          <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">리더 관리</h2>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                + 리더 추가
              </button>
            </div>

            {/* 계정 생성 폼 */}
            {showCreateForm && (
              <div className="bg-medical-dark rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  새 {createForm.role === 'admin' ? '관리자' : '리더'} 생성
                </h3>
                <form onSubmit={handleCreateReader} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 역할 선택 */}
                  <select
                    value={createForm.role}
                    onChange={e => setCreateForm({...createForm, role: e.target.value})}
                    className="px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white"
                  >
                    <option value="reader">리더 (Reader)</option>
                    <option value="admin">관리자 (Admin)</option>
                  </select>
                  <input
                    type="text"
                    placeholder={createForm.role === 'admin' ? '관리자 코드 (예: ADMIN01)' : '리더 코드 (예: R01)'}
                    value={createForm.reader_code}
                    onChange={e => setCreateForm({...createForm, reader_code: e.target.value})}
                    className="px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="이름"
                    value={createForm.name}
                    onChange={e => setCreateForm({...createForm, name: e.target.value})}
                    className="px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white"
                    required
                  />
                  <input
                    type="email"
                    placeholder="이메일"
                    value={createForm.email}
                    onChange={e => setCreateForm({...createForm, email: e.target.value})}
                    className="px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white"
                    required
                  />
                  <input
                    type="password"
                    placeholder="비밀번호"
                    value={createForm.password}
                    onChange={e => setCreateForm({...createForm, password: e.target.value})}
                    className="px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white"
                    required
                  />
                  {/* 그룹 선택 (리더만) - 연구 설정의 그룹명과 연동 */}
                  {createForm.role === 'reader' && (
                    <select
                      value={createForm.group}
                      onChange={e => setCreateForm({...createForm, group: parseInt(e.target.value)})}
                      className="px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white"
                    >
                      {Array.from({ length: studyConfig?.total_groups || 2 }, (_, i) => i + 1).map(groupNum => (
                        <option key={groupNum} value={groupNum}>
                          {studyConfig?.group_names?.[`group_${groupNum}`] || `Group ${groupNum}`}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                        createForm.role === 'admin'
                          ? 'bg-yellow-600 hover:bg-yellow-700'
                          : 'bg-primary-500 hover:bg-primary-600'
                      }`}
                    >
                      생성
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
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
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : (
              <div className="bg-medical-dark rounded-xl border border-gray-800 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-medical-darker">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">역할</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">코드</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">이름</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">이메일</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">그룹</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">세션</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">상태</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readers.map(reader => (
                      <tr key={reader.id} className={`border-t border-gray-800 ${reader.role === 'admin' ? 'bg-yellow-900/10' : ''}`}>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded font-medium ${
                            reader.role === 'admin'
                              ? 'bg-yellow-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}>
                            {reader.role === 'admin' ? '관리자' : '리더'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white font-mono">{reader.reader_code}</td>
                        <td className="px-4 py-3 text-white">{reader.name}</td>
                        <td className="px-4 py-3 text-gray-400">{reader.email}</td>
                        <td className="px-4 py-3 text-white">
                          {reader.role === 'admin'
                            ? '-'
                            : (studyConfig?.group_names?.[`group_${reader.group}`] || `Group ${reader.group || '-'}`)}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {reader.role === 'admin' ? '-' : `${reader.session_count}개`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded ${
                            reader.is_active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                          }`}>
                            {reader.is_active ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            {/* 리더 전용: 세션 할당 및 관리 - 연구 설정의 세션 수에 맞춰 동적 생성 */}
                            {reader.role === 'reader' && (
                              <>
                                {Array.from({ length: studyConfig?.total_sessions || 2 }, (_, i) => i + 1).map(sessionNum => (
                                  <button
                                    key={sessionNum}
                                    onClick={() => handleAssignSession(reader.id, `S${sessionNum}`)}
                                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                  >
                                    S{sessionNum} 할당
                                  </button>
                                ))}
                                {reader.session_count > 0 && (
                                  <button
                                    onClick={() => openSessionModal(reader)}
                                    className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                                  >
                                    세션 관리
                                  </button>
                                )}
                              </>
                            )}
                            {/* 공통: 비밀번호 재설정 */}
                            <button
                              onClick={() => openResetPasswordModal(reader)}
                              className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                            >
                              비밀번호
                            </button>
                            {/* 공통: 활성화/비활성화 토글 (자기 자신 제외) */}
                            {reader.id !== user?.id && (
                              reader.is_active ? (
                                <button
                                  onClick={() => handleDeactivateReader(reader.id)}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  비활성화
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivateReader(reader.id)}
                                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  재활성화
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
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">감사 로그</h2>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : (
              <div className="bg-medical-dark rounded-xl border border-gray-800 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-medical-darker">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">시간</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">사용자</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">작업</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">리소스</th>
                      <th className="px-4 py-3 text-left text-gray-400 font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id} className="border-t border-gray-800">
                        <td className="px-4 py-3 text-gray-400 text-sm">
                          {formatKST(log.created_at)}
                        </td>
                        <td className="px-4 py-3 text-white">{log.reader_code || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded ${
                            log.action.includes('LOGIN') ? 'bg-blue-600' :
                            log.action.includes('ADMIN') ? 'bg-yellow-600' :
                            'bg-gray-600'
                          } text-white`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
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
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">데이터 내보내기</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-medical-dark rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">CSV 형식</h3>
                <p className="text-gray-400 mb-4">
                  환자 수준 결과와 병변 마커를 포함한 CSV 파일을 다운로드합니다.
                </p>
                <a
                  href={adminApi.getExportUrl('csv')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  CSV 다운로드
                </a>
              </div>

              <div className="bg-medical-dark rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">JSON 형식</h3>
                <p className="text-gray-400 mb-4">
                  구조화된 JSON 형식으로 전체 데이터를 다운로드합니다.
                </p>
                <a
                  href={adminApi.getExportUrl('json')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  JSON 다운로드
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 비밀번호 재설정 모달 (다른 사용자) */}
      {showResetPasswordModal && resetPasswordTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-medical-dark rounded-xl border border-gray-800 p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                비밀번호 재설정
              </h3>
              <button
                onClick={() => {
                  setShowResetPasswordModal(false)
                  setResetPasswordTarget(null)
                  setResetPasswordForm({ newPassword: '', confirmPassword: '' })
                  setError(null)
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-medical-darker rounded-lg">
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
                  className="w-full px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  className="w-full px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                  minLength={4}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-600 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
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
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 (자기 자신) */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-medical-dark rounded-xl border border-gray-800 p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                비밀번호 변경
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
                  setError(null)
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">현재 비밀번호</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  className="w-full px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">새 비밀번호</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  className="w-full px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
                  className="w-full px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  minLength={4}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-600 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
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
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-medical-dark rounded-xl border border-gray-800 p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                세션 관리
              </h3>
              <button
                onClick={() => {
                  setShowSessionModal(false)
                  setSessionTarget(null)
                  setSessionTargetDetails(null)
                  setError(null)
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-medical-darker rounded-lg">
              <p className="text-gray-400 text-sm">리더 정보</p>
              <p className="text-white font-medium">{sessionTarget.name} ({sessionTarget.reader_code})</p>
              <p className="text-gray-500 text-sm">Group {sessionTarget.group || '-'}</p>
            </div>

            {!sessionTargetDetails ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-400 mt-2">세션 정보 로딩 중...</p>
              </div>
            ) : sessionTargetDetails.sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                할당된 세션이 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {sessionTargetDetails.sessions.map(session => (
                  <div key={session.session_id} className="p-4 bg-medical-darker rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{session.session_code}</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            session.status === 'completed' ? 'bg-green-600 text-white' :
                            session.status === 'in_progress' ? 'bg-blue-600 text-white' :
                            'bg-gray-600 text-gray-300'
                          }`}>
                            {session.status === 'completed' ? '완료' :
                             session.status === 'in_progress' ? '진행중' : '대기'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          Block A: {session.block_a_mode} / Block B: {session.block_b_mode}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSession(session.session_id)}
                        disabled={loading}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        할당 취소
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-600 rounded-lg">
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
                className="w-full py-2 px-4 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
