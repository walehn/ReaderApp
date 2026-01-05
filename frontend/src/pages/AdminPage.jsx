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
import { adminApi } from '../services/api'

export default function AdminPage() {
  const navigate = useNavigate()
  const { user, logout, getToken, isAdmin } = useAuth()

  const [activeTab, setActiveTab] = useState('readers')
  const [readers, setReaders] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // 리더 생성 폼
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({
    reader_code: '',
    name: '',
    email: '',
    password: '',
    group: 1
  })

  // 권한 체크
  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAdmin, navigate])

  // 데이터 로드
  useEffect(() => {
    if (activeTab === 'readers') {
      loadReaders()
    } else if (activeTab === 'logs') {
      loadAuditLogs()
    }
  }, [activeTab])

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
      setSuccessMessage('리더가 생성되었습니다')
      setShowCreateForm(false)
      setCreateForm({ reader_code: '', name: '', email: '', password: '', group: 1 })
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

            {/* 리더 생성 폼 */}
            {showCreateForm && (
              <div className="bg-medical-dark rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">새 리더 생성</h3>
                <form onSubmit={handleCreateReader} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="리더 코드 (예: R01)"
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
                  <select
                    value={createForm.group}
                    onChange={e => setCreateForm({...createForm, group: parseInt(e.target.value)})}
                    className="px-4 py-2 bg-medical-darker border border-gray-700 rounded-lg text-white"
                  >
                    <option value={1}>Group 1</option>
                    <option value={2}>Group 2</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
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
                      <tr key={reader.id} className="border-t border-gray-800">
                        <td className="px-4 py-3 text-white font-mono">{reader.reader_code}</td>
                        <td className="px-4 py-3 text-white">{reader.name}</td>
                        <td className="px-4 py-3 text-gray-400">{reader.email}</td>
                        <td className="px-4 py-3 text-white">Group {reader.group}</td>
                        <td className="px-4 py-3 text-white">{reader.session_count}개</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded ${
                            reader.is_active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                          }`}>
                            {reader.is_active ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAssignSession(reader.id, 'S1')}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              S1 할당
                            </button>
                            <button
                              onClick={() => handleAssignSession(reader.id, 'S2')}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              S2 할당
                            </button>
                            {reader.is_active && (
                              <button
                                onClick={() => handleDeactivateReader(reader.id)}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                비활성화
                              </button>
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
                          {new Date(log.created_at).toLocaleString('ko-KR')}
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
    </div>
  )
}
