ReaderApp 대규모 기능 확장 구현 계획

     개요

     간 전이 병변 검출 Reader Study 앱에 인증, 세션 영속화, 프론트엔드 개편 기능 추가

     사용자 결정 사항

     - 구현 방식: 단계별 진행 (Phase 1 → 2 → 3 → 4 → 5)
     - Block A/B 케이스: 추후 별도 파일로 제공 (현재 placeholder 사용)
     - 초기 계정: CLI 스크립트로 최초 관리자 생성, 이후 관리자 UI에서 리더 생성

     ---
     Phase 1: 데이터베이스 스키마 확장

     목표

     새로운 테이블 추가 (readers, study_sessions, session_progress, audit_logs)

     수정 파일

     | 파일                           | 작업                                                      |
     |--------------------------------|-----------------------------------------------------------|
     | backend/app/models/database.py | Reader, StudySession, SessionProgress, AuditLog 모델 추가 |
     | backend/app/models/schemas.py  | 새 Pydantic 스키마 추가                                   |
     | backend/requirements.txt       | passlib[bcrypt], python-jose 추가                         |

     신규 파일

     | 파일                            | 설명                 |
     |---------------------------------|----------------------|
     | backend/scripts/create_admin.py | 최초 관리자 생성 CLI |
     | backend/app/core/__init__.py    | core 패키지 초기화   |

     테이블 구조

     readers: id, reader_code, name, email, password_hash, role, group, is_active, created_at, last_login_at
     study_sessions: id, session_code, reader_id(FK), block_a_mode, block_b_mode, case_order_block_a, case_order_block_b, k_max, ai_threshold, status, 
     created_at
     session_progress: id, session_id(FK), current_block, current_case_index, completed_cases, started_at, last_accessed_at, completed_at
     audit_logs: id, reader_id(FK), action, resource_type, resource_id, ip_address, user_agent, details, created_at

     완료 조건

     - 새 테이블 생성 완료
     - create_admin.py 스크립트 동작 확인

     ---
     Phase 2: 백엔드 인증 시스템

     목표

     세션 쿠키 기반 JWT 인증, 권한 검증 미들웨어

     수정 파일

     | 파일                  | 작업                               |
     |-----------------------|------------------------------------|
     | backend/app/main.py   | 인증 미들웨어, auth 라우터 등록    |
     | backend/app/config.py | SECRET_KEY, ALLOWED_IP_RANGES 추가 |

     신규 파일

     | 파일                             | 설명                                              |
     |----------------------------------|---------------------------------------------------|
     | backend/app/core/security.py     | 비밀번호 해싱, JWT 생성/검증                      |
     | backend/app/core/dependencies.py | get_current_reader, require_admin, require_reader |
     | backend/app/core/middleware.py   | IP 제한, 감사 로그 미들웨어                       |
     | backend/app/routers/auth.py      | POST /auth/login, /logout, GET /auth/me           |

     API 엔드포인트

     POST /auth/login     - 로그인 (쿠키 설정)
     POST /auth/logout    - 로그아웃 (쿠키 삭제)
     GET  /auth/me        - 현재 사용자 정보

     완료 조건

     - 로그인/로그아웃 동작
     - 쿠키 기반 인증 확인
     - 권한별 접근 제어 확인

     ---
     Phase 3: 세션 관리 시스템 개편

     목표

     JSON 파일 → DB 기반 세션 관리, Block/Group 로직, 랜덤 순서 영속화

     수정 파일

     | 파일                                    | 작업                              |
     |-----------------------------------------|-----------------------------------|
     | backend/app/services/session_service.py | 전면 개편 (DB 기반)               |
     | backend/app/routers/study.py            | 세션 진입/진행 API 수정           |
     | backend/app/models/schemas.py           | SessionEnterRequest/Response 추가 |

     핵심 로직

     # Group/Session에 따른 Block 모드 결정
     Group 1, S1: Block A = UNAIDED, Block B = AIDED
     Group 1, S2: Block A = AIDED, Block B = UNAIDED
     Group 2, S1: Block A = AIDED, Block B = UNAIDED
     Group 2, S2: Block A = UNAIDED, Block B = AIDED

     API 변경

     POST /study/enter/{session_code}  - 세션 진입 (최초 시 랜덤 순서 생성)
     GET  /study/current               - 현재 케이스 정보
     POST /study/submit                - 결과 제출 + 자동 다음 케이스
     GET  /study/my-sessions           - 내 세션 목록 (대시보드용)

     완료 조건

     - 세션 최초 진입 시 랜덤 순서 생성 및 DB 저장
     - 서버 재시작 후에도 진행 상태 유지
     - Block A 완료 → Block B 전환 동작

     ---
     Phase 4: 프론트엔드 개편

     목표

     React Router 도입, Intro/Login/Dashboard/Viewer 페이지 분리

     수정 파일

     | 파일                             | 작업                                  |
     |----------------------------------|---------------------------------------|
     | frontend/package.json            | react-router-dom 추가                 |
     | frontend/src/App.jsx             | 라우터 구조로 전면 개편               |
     | frontend/src/services/api.js     | 인증 API 추가, credentials: 'include' |
     | frontend/src/hooks/useSession.js | DB 기반으로 수정                      |

     신규 파일

     | 파일                                       | 설명                         |
     |--------------------------------------------|------------------------------|
     | frontend/src/contexts/AuthContext.jsx      | 인증 상태 관리               |
     | frontend/src/pages/IntroPage.jsx           | 연구 소개 + 로그인 진입      |
     | frontend/src/pages/LoginPage.jsx           | 이메일/비밀번호 로그인       |
     | frontend/src/pages/DashboardPage.jsx       | 세션 목록, 진행률, 진입 버튼 |
     | frontend/src/pages/ViewerPage.jsx          | 기존 뷰어 로직 이동          |
     | frontend/src/components/ProtectedRoute.jsx | 인증 필요 라우트 래퍼        |
     | frontend/src/components/AdminRoute.jsx     | 관리자 전용 라우트 래퍼      |

     라우트 구조

     /                  → IntroPage (공개)
     /login             → LoginPage (공개)
     /dashboard         → DashboardPage (리더/관리자)
     /viewer/:session   → ViewerPage (리더)
     /admin/*           → AdminPage (관리자)

     완료 조건

     - 로그인 → 대시보드 → 뷰어 플로우 동작
     - 인증 없이 /dashboard 접근 시 /login으로 리다이렉트
     - 세션 진행률 표시

     ---
     Phase 5: 관리자 기능

     목표

     리더 CRUD, 세션 배정/리셋, 결과 관리, 감사 로그

     수정 파일

     | 파일                          | 작업                                |
     |-------------------------------|-------------------------------------|
     | backend/app/routers/admin.py  | 리더/세션/결과 관리 API 확장        |
     | backend/app/models/schemas.py | ReaderCreate, SessionAssign 등 추가 |

     신규 파일

     | 파일                                      | 설명                  |
     |-------------------------------------------|-----------------------|
     | frontend/src/pages/AdminPage.jsx          | 관리자 메인 (탭 구조) |
     | frontend/src/pages/admin/ReadersTab.jsx   | 리더 관리             |
     | frontend/src/pages/admin/SessionsTab.jsx  | 세션 관리             |
     | frontend/src/pages/admin/ResultsTab.jsx   | 결과 관리             |
     | frontend/src/pages/admin/AuditLogsTab.jsx | 감사 로그             |

     관리자 API

     GET    /admin/readers           - 리더 목록
     POST   /admin/readers           - 리더 생성
     PUT    /admin/readers/{id}      - 리더 수정
     DELETE /admin/readers/{id}      - 리더 삭제/비활성화

     GET    /admin/sessions          - 전체 세션 목록
     POST   /admin/sessions/assign   - 세션 배정
     POST   /admin/sessions/{id}/reset - 세션 리셋

     DELETE /admin/results/{id}      - 결과 삭제
     GET    /admin/audit-logs        - 감사 로그 조회

     완료 조건

     - 리더 생성/수정/삭제 동작
     - 세션 배정 및 리셋 동작
     - 감사 로그 조회

     ---
     의존관계

     Phase 1 (DB)
         ↓
     Phase 2 (인증)
         ↓
     Phase 3 (세션)
         ↓
     Phase 4 (프론트엔드)
         ↓
     Phase 5 (관리자)

     예상 소요 시간

     - Phase 1: 2-3일
     - Phase 2: 2-3일
     - Phase 3: 3-4일
     - Phase 4: 4-5일
     - Phase 5: 3-4일
     - 총계: 14-19일

     주요 파일 경로 (수정 대상)

     /home/walehn/ReaderApp/
     ├── backend/
     │   ├── app/
     │   │   ├── models/database.py      ★ Phase 1
     │   │   ├── models/schemas.py       ★ Phase 1, 3, 5
     │   │   ├── services/session_service.py  ★ Phase 3
     │   │   ├── routers/auth.py         ★ Phase 2 (신규)
     │   │   ├── routers/admin.py        ★ Phase 5
     │   │   ├── routers/study.py        ★ Phase 3
     │   │   ├── core/security.py        ★ Phase 2 (신규)
     │   │   ├── core/dependencies.py    ★ Phase 2 (신규)
     │   │   ├── config.py               ★ Phase 2
     │   │   └── main.py                 ★ Phase 2
     │   ├── scripts/create_admin.py     ★ Phase 1 (신규)
     │   └── requirements.txt            ★ Phase 1
     ├── frontend/
     │   ├── src/
     │   │   ├── App.jsx                 ★ Phase 4
     │   │   ├── contexts/AuthContext.jsx ★ Phase 4 (신규)
     │   │   ├── pages/IntroPage.jsx     ★ Phase 4 (신규)
     │   │   ├── pages/LoginPage.jsx     ★ Phase 4 (신규)
     │   │   ├── pages/DashboardPage.jsx ★ Phase 4 (신규)
     │   │   ├── pages/ViewerPage.jsx    ★ Phase 4 (신규)
     │   │   ├── pages/AdminPage.jsx     ★ Phase 5 (신규)
     │   │   ├── services/api.js         ★ Phase 4
     │   │   └── hooks/useSession.js     ★ Phase 4
     │   └── package.json                ★ Phase 4