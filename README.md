# Web Reader Study

간 전이 병변(NEW hepatic metastasis) 검출을 위한 웹 기반 Reader Study 애플리케이션

## 개요

이 애플리케이션은 **Unaided vs Aided 조건**에서 환자 수준 False Negative 감소를 평가하기 위한 Reader Study 플랫폼입니다.

### 주요 기능

- **NiiVue WebGL 뷰어**: Baseline(좌) + Followup(우) 2-up 동기화 뷰어
- **병변 마킹**: 최대 3개 병변 마커 + Confidence 레벨 (Definite/Probable/Possible)
- **Crossover 디자인**: 2×2 Latin Square 세션 관리
- **JWT 인증**: 역할 기반 인가 (Reader/Admin)
- **관리자 대시보드**: 진행률 모니터링 및 데이터 내보내기
- **Docker 배포**: Nginx 리버스 프록시 구성

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| **Backend** | Python 3.12, FastAPI, uvicorn |
| **Frontend** | React 18, Vite, Tailwind CSS |
| **의료영상** | NiiVue (WebGL), nibabel, numpy |
| **데이터베이스** | SQLite (SQLAlchemy ORM, aiosqlite) |
| **인증** | JWT (python-jose), bcrypt |
| **배포** | Docker, Nginx |

---

## 프로젝트 구조

```
/home/walehn/ReaderApp/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI 애플리케이션 진입점
│   │   ├── config.py                  # 전역 설정 관리
│   │   ├── core/
│   │   │   ├── security.py            # JWT 토큰 및 비밀번호 해싱
│   │   │   └── middleware.py          # IP 제한, 로깅, 보안 헤더
│   │   ├── routers/
│   │   │   ├── auth.py                # POST /auth/login, /logout, /me
│   │   │   ├── case.py                # GET /case/meta, /allocate
│   │   │   ├── nifti.py               # GET /nifti/volume, /overlay
│   │   │   ├── study.py               # POST /study/submit
│   │   │   ├── sessions.py            # /sessions/my, /enter, /advance
│   │   │   ├── readers.py             # /readers CRUD (관리자)
│   │   │   ├── study_config.py        # /study-config (연구 설정)
│   │   │   ├── dashboard.py           # /dashboard/* (진행률)
│   │   │   └── admin.py               # /admin/export, /audit-logs
│   │   ├── models/
│   │   │   ├── schemas.py             # Pydantic 스키마
│   │   │   └── database.py            # SQLAlchemy 모델
│   │   └── services/
│   │       ├── nifti_service.py       # NIfTI 파일 로딩 및 메타데이터
│   │       ├── case_discovery_service.py  # 케이스 검색 및 할당
│   │       ├── study_session_service.py   # DB 기반 세션 관리
│   │       ├── study_config_service.py    # 연구 설정 관리
│   │       ├── dashboard_service.py       # 대시보드 통계
│   │       └── session_service.py         # 레거시 세션 목록
│   ├── requirements.txt
│   └── run.py                         # 서버 실행 스크립트
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── NiiVueCanvas.jsx       # WebGL 의료영상 렌더러
│   │   │   ├── Viewer.jsx             # 2-up 동기화 뷰어
│   │   │   ├── LesionMarker.jsx       # 병변 마커 목록
│   │   │   ├── InputPanel.jsx         # 환자 판정 입력
│   │   │   └── ProgressBar.jsx        # 진행 상황 표시
│   │   ├── pages/
│   │   │   ├── IntroPage.jsx          # 소개 페이지
│   │   │   ├── LoginPage.jsx          # 로그인 페이지
│   │   │   ├── DashboardPage.jsx      # 세션 대시보드
│   │   │   ├── ViewerPage.jsx         # 2-up 뷰어 페이지
│   │   │   └── AdminPage.jsx          # 관리자 페이지
│   │   ├── hooks/
│   │   │   ├── useCase.js             # 케이스 데이터 관리
│   │   │   ├── useTimer.js            # 소요 시간 측정
│   │   │   ├── useActivityDetector.js # 비활성 감지
│   │   │   └── usePreload.js          # 다음 케이스 프리로딩
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx        # JWT 인증 상태 관리
│   │   ├── services/
│   │   │   └── api.js                 # Backend API 호출
│   │   ├── App.jsx                    # 라우팅 설정
│   │   └── main.jsx                   # React 진입점
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── docker/
│   ├── backend/Dockerfile             # Python 3.12-slim 기반
│   ├── frontend/Dockerfile            # Multi-stage (Node → Nginx)
│   └── nginx/
│       ├── nginx.conf                 # Nginx 메인 설정
│       └── default.conf               # 사이트 설정 (COOP/COEP 헤더)
├── docker-compose.yml                 # 컨테이너 오케스트레이션
├── dataset/                           # NIfTI 데이터셋
│   ├── positive/                      # Positive 케이스
│   ├── negative/                      # Negative 케이스
│   └── LabelAI/                       # AI 레이블/확률맵
├── results/                           # SQLite 데이터베이스
│   └── reader_study.db
├── sessions/                          # 레거시 세션 설정 JSON
├── scripts/
│   └── generate_test_data.py          # 테스트 데이터 생성
└── README.md
```

---

## 설치 및 실행

### 1. 사전 요구사항

- Python 3.12+
- Node.js 20+
- Docker (선택, 배포용)

### 2. 개발 환경 설정

**Backend 설정**:
```bash
cd /home/walehn/ReaderApp

# Python 가상환경 활성화
source ReaderApp/bin/activate

# 패키지 설치
pip install -r backend/requirements.txt

# 환경 변수 설정 (필수)
export READER_STUDY_SECRET_KEY="your-secret-key-here"

# 서버 실행 (개발 모드)
python backend/run.py --reload
```

**Frontend 설정**:
```bash
cd /home/walehn/ReaderApp/frontend

# npm 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

### 3. Docker 배포

```bash
cd /home/walehn/ReaderApp

# 환경 변수 설정
export READER_STUDY_SECRET_KEY="your-production-secret-key"

# 컨테이너 빌드 및 실행
docker compose up -d --build

# 상태 확인
docker compose ps

# 로그 확인
docker compose logs -f
```

### 4. 접속

| URL | 설명 |
|-----|------|
| http://localhost:5173 | 소개 페이지 |
| http://localhost:5173/login | 로그인 |
| http://localhost:5173/dashboard | 세션 대시보드 |
| http://localhost:5173/viewer/:sessionId | 뷰어 |
| http://localhost:5173/admin | 관리자 페이지 |
| http://localhost:8000/docs | Swagger UI (개발 모드) |

---

## API 명세

### 인증 (`/auth`)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/auth/login` | POST | JWT 토큰 발급 |
| `/auth/logout` | POST | 로그아웃 (감사 로그) |
| `/auth/me` | GET | 현재 사용자 정보 |
| `/auth/change-password` | POST | 비밀번호 변경 |

### 세션 관리 (`/sessions`)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/sessions/my` | GET | 내 세션 목록 |
| `/sessions/{id}/enter` | POST | 세션 진입 |
| `/sessions/{id}/current` | GET | 현재 케이스 정보 |
| `/sessions/{id}/advance` | POST | 다음 케이스로 이동 |
| `/sessions/assign` | POST | 세션 할당 (관리자) |
| `/sessions/{id}/reset` | POST | 세션 초기화 (관리자) |

### NIfTI 스트리밍 (`/nifti`)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/nifti/volume` | GET | NIfTI 볼륨 파일 스트리밍 |
| `/nifti/overlay` | GET | AI 오버레이 (AIDED 모드 전용) |
| `/nifti/info` | GET | NIfTI 메타데이터 |

**파라미터**:
- `case_id`: 케이스 ID (예: `pos_enriched_001_10667525`)
- `series`: `baseline` | `followup`
- `reader_id`, `session_id`: AI 오버레이 접근 검증용

### 케이스 (`/case`)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/case/meta` | GET | 케이스 메타데이터 |
| `/case/available` | GET | 사용 가능한 케이스 목록 |
| `/case/allocate` | GET | 세션별 케이스 할당 |

### 연구 결과 (`/study`)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/study/submit` | POST | 결과 제출 |

**제출 데이터 예시**:
```json
{
  "reader_id": "RAD01",
  "session_id": "S1",
  "mode": "UNAIDED",
  "case_id": "pos_enriched_001_10667525",
  "patient_new_met_present": true,
  "lesions": [
    {"x": 128, "y": 128, "z": 40, "confidence": "probable"}
  ],
  "time_spent_sec": 45.5
}
```

### 리더 관리 (`/readers`) - 관리자 전용

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/readers` | GET | 리더 목록 |
| `/readers` | POST | 리더 생성 |
| `/readers/{id}` | GET | 리더 상세 |
| `/readers/{id}` | PATCH | 리더 수정 |
| `/readers/{id}` | DELETE | 리더 비활성화 |

### 연구 설정 (`/study-config`)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/study-config` | GET | 연구 설정 조회 |
| `/study-config` | PUT | 연구 설정 수정 |
| `/study-config/lock` | POST | 설정 잠금 |
| `/study-config/public` | GET | 공개 설정 (인증 불필요) |

### 대시보드 (`/dashboard`) - 관리자 전용

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/dashboard/summary` | GET | 전체 진행 요약 |
| `/dashboard/by-reader` | GET | 리더별 진행률 |
| `/dashboard/by-group` | GET | 그룹별 진행률 |
| `/dashboard/by-session` | GET | 세션별 진행률 |

### 관리자 (`/admin`)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/admin/export` | GET | 결과 내보내기 (CSV/JSON) |
| `/admin/audit-logs` | GET | 감사 로그 조회 |

---

## 데이터베이스 구조

### 테이블

| 테이블 | 용도 |
|--------|------|
| `study_config` | 연구 설정 (Singleton) |
| `readers` | 리더/관리자 계정 |
| `study_sessions` | 스터디 세션 |
| `session_progress` | 세션 진행 상태 |
| `study_results` | 환자 수준 판정 결과 |
| `lesion_marks` | 병변 마커 |
| `audit_logs` | 감사 로그 |

### 주요 필드

**readers**:
- `reader_code`: 리더 코드 (예: RAD01)
- `role`: `reader` | `admin`
- `group`: Crossover 그룹 (1 | 2)

**study_sessions**:
- `block_a_mode`, `block_b_mode`: UNAIDED | AIDED
- `case_order_block_a`, `case_order_block_b`: 케이스 순서 (JSON)
- `status`: pending | in_progress | completed

---

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `READER_STUDY_SECRET_KEY` | **필수** | JWT 서명 키 |
| `READER_STUDY_DEBUG` | 선택 | 디버그 모드 (기본: False) |
| `READER_STUDY_CASES_DIR` | 선택 | 케이스 디렉토리 |
| `READER_STUDY_DATASET_DIR` | 선택 | 데이터셋 디렉토리 |
| `READER_STUDY_RESULTS_DIR` | 선택 | 결과 디렉토리 |

---

## Crossover 디자인

2×2 Latin Square 디자인으로 읽기 순서 효과를 통제합니다.

| 그룹 | 세션 1 Block A | 세션 1 Block B | 세션 2 Block A | 세션 2 Block B |
|------|---------------|---------------|---------------|---------------|
| **Group 1** | UNAIDED | AIDED | AIDED | UNAIDED |
| **Group 2** | AIDED | UNAIDED | UNAIDED | AIDED |

---

## Window/Level 프리셋

| 프리셋 | Window Width | Window Level | 용도 |
|--------|--------------|--------------|------|
| `liver` | 150 | 50 | 간 조직 최적화 |
| `soft` | 400 | 40 | 연부 조직 |

---

## 개발 명령어

```bash
# Backend 개발 모드 (hot reload)
python backend/run.py --reload

# Backend 프로덕션 모드
python backend/run.py --workers 4

# Frontend 개발 서버
cd frontend && npm run dev

# Frontend 빌드
cd frontend && npm run build

# Docker 배포
docker compose up -d --build

# Docker 로그 확인
docker compose logs -f

# Docker 재배포
docker compose down && docker compose up -d --build
```

---

## 제약사항 (Acceptance Criteria)

- [x] UNAIDED 세션에서 AI 오버레이 API 호출 시 403 반환
- [x] AIDED 세션에서 AI 오버레이 정상 표시
- [x] Baseline/Followup NiiVue 동기화 스크롤
- [x] 환자 수준 Yes/No 판정 필수
- [x] 최대 3개 병변 마커 제한
- [x] 각 병변에 Confidence 필수 (Definite/Probable/Possible)
- [x] JWT 기반 인증 및 역할 기반 인가
- [x] Crossover 디자인 세션 관리
- [x] 결과 DB 저장 및 CSV/JSON 내보내기
- [x] 비활성 감지 타이머 일시정지
- [x] Docker/Nginx 배포 지원

---

## 라이선스

이 프로젝트는 연구 목적으로 개발되었습니다.
