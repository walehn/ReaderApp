# Web Reader Study MVP

간 전이 병변(NEW hepatic metastasis) 검출을 위한 웹 기반 Reader Study 애플리케이션

## 개요

이 애플리케이션은 **unaided vs aided 조건**에서 환자 수준 False Negative 감소를 평가하기 위한 MVP입니다.

### 주요 기능

- **2-up 동기화 뷰어**: Baseline(좌) + Followup(우) 동시 표시
- **서버 측 NIfTI 렌더링**: JPEG 슬라이스 변환으로 브라우저 호환성 보장
- **병변 마킹**: Canvas 기반 최대 3개 병변 마커 + confidence 레벨
- **세션 분리**: UNAIDED/AIDED 모드 서버 측 강제
- **결과 저장**: SQLite DB + CSV/JSON 내보내기

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| **Backend** | Python 3.12, FastAPI, uvicorn |
| **Frontend** | React 18, Vite, Tailwind CSS |
| **의료영상** | nibabel, Pillow, numpy |
| **데이터베이스** | SQLite (SQLAlchemy ORM) |
| **캐싱** | cachetools (LRU Cache) |

---

## 프로젝트 구조

```
/home/walehn/ReaderApp/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 애플리케이션 진입점
│   │   ├── config.py            # 전역 설정 관리
│   │   ├── routers/
│   │   │   ├── case.py          # GET /case/meta
│   │   │   ├── render.py        # GET /render/slice, /render/overlay
│   │   │   ├── study.py         # POST /study/submit, GET /study/session
│   │   │   └── admin.py         # GET /admin/export
│   │   ├── models/
│   │   │   ├── schemas.py       # Pydantic 스키마
│   │   │   └── database.py      # SQLAlchemy 모델
│   │   └── services/
│   │       ├── nifti_service.py # NIfTI 로딩 및 JPEG 렌더링
│   │       ├── cache_service.py # LRU 캐시 관리
│   │       └── session_service.py # 세션 설정 관리
│   ├── requirements.txt
│   └── run.py                   # 서버 실행 스크립트
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Viewer.jsx       # 2-up 동기화 뷰어
│   │   │   ├── SliceCanvas.jsx  # Canvas 기반 슬라이스 표시
│   │   │   ├── LesionMarker.jsx # 병변 마커 목록
│   │   │   ├── InputPanel.jsx   # 환자 판정 입력
│   │   │   ├── OverlayToggle.jsx # AI 오버레이 토글
│   │   │   └── ProgressBar.jsx  # 진행 상황 표시
│   │   ├── hooks/
│   │   │   ├── useSession.js    # 세션 상태 관리
│   │   │   ├── useCase.js       # 케이스 데이터 관리
│   │   │   └── useTimer.js      # 소요 시간 측정
│   │   ├── services/
│   │   │   └── api.js           # Backend API 호출
│   │   ├── App.jsx              # 메인 애플리케이션
│   │   ├── main.jsx             # React 진입점
│   │   └── index.css            # Tailwind CSS
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── cases/                       # NIfTI 케이스 데이터
│   └── case_xxxx/
│       ├── baseline.nii.gz      # Baseline 볼륨
│       ├── followup.nii.gz      # Followup 볼륨
│       └── ai_prob.nii.gz       # AI 확률맵
├── sessions/                    # 세션 설정 JSON
│   ├── session_R01_S1.json      # UNAIDED 세션
│   └── session_R01_S2.json      # AIDED 세션
├── results/                     # SQLite 데이터베이스
│   └── reader_study.db
├── scripts/
│   └── generate_test_data.py    # 더미 NIfTI 생성 스크립트
├── ReaderApp/                   # Python venv 환경
├── CLAUDE.md
└── README.md
```

---

## 설치 및 실행

### 1. 사전 요구사항

- Python 3.12+
- Node.js 18+
- npm 9+

### 2. Backend 설정

```bash
cd /home/walehn/ReaderApp

# Python 가상환경 생성 (이미 생성됨)
python3 -m venv ReaderApp

# 가상환경 활성화
source ReaderApp/bin/activate

# 패키지 설치
pip install -r backend/requirements.txt
```

### 3. Frontend 설정

```bash
cd /home/walehn/ReaderApp/frontend

# npm 패키지 설치
npm install
```

### 4. 테스트 데이터 생성 (선택)

```bash
source ReaderApp/bin/activate
python scripts/generate_test_data.py --cases 5
```

### 5. 서버 실행

**Backend** (터미널 1):
```bash
cd /home/walehn/ReaderApp
source ReaderApp/bin/activate
python backend/run.py --reload
```

**Frontend** (터미널 2):
```bash
cd /home/walehn/ReaderApp/frontend
npm run dev
```

### 6. 접속

- **Frontend**: http://localhost:5173?reader=R01&session=S1
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## API 명세

### 케이스 관련

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/case/meta` | GET | 케이스 메타데이터 (shape, slices, spacing) |

### 렌더링

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/render/slice` | GET | JPEG 슬라이스 이미지 |
| `/render/overlay` | GET | AI 확률맵 오버레이 (AIDED 전용) |

**슬라이스 파라미터**:
- `case_id`: 케이스 ID
- `series`: `baseline` | `followup`
- `z`: 슬라이스 인덱스
- `wl`: `liver` | `soft` (Window/Level 프리셋)

### 연구 진행

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/study/session` | GET | 세션 설정 조회 |
| `/study/progress` | GET | 진행 상황 조회 |
| `/study/submit` | POST | 결과 제출 |

**제출 데이터 예시**:
```json
{
  "reader_id": "R01",
  "session_id": "S1",
  "mode": "UNAIDED",
  "case_id": "case_0001",
  "patient_new_met_present": true,
  "lesions": [
    {"x": 128, "y": 128, "z": 40, "confidence": "probable"}
  ],
  "time_spent_sec": 45.5
}
```

### 관리자

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/admin/export` | GET | 결과 내보내기 (CSV/JSON) |
| `/admin/sessions` | GET | 세션 목록 |
| `/admin/cache-stats` | GET | 캐시 통계 |

---

## 세션 설정

세션 파일은 `sessions/` 디렉토리에 JSON 형식으로 저장됩니다.

**파일명 형식**: `session_{reader_id}_{session_id}.json`

**예시** (`sessions/session_R01_S1.json`):
```json
{
  "reader_id": "R01",
  "session_id": "S1",
  "mode": "UNAIDED",
  "case_ids": ["case_0001", "case_0002", "case_0003"],
  "k_max": 3,
  "ai_threshold": 0.30
}
```

| 필드 | 설명 |
|------|------|
| `mode` | `UNAIDED` (AI 없음) 또는 `AIDED` (AI 오버레이 가능) |
| `case_ids` | 평가할 케이스 ID 목록 |
| `k_max` | 최대 병변 마커 수 (기본 3) |
| `ai_threshold` | AI 확률 임계값 (기본 0.30) |

---

## Window/Level 프리셋

| 프리셋 | Window Width | Window Level | 용도 |
|--------|--------------|--------------|------|
| `liver` | 150 | 50 | 간 조직 최적화 |
| `soft` | 400 | 40 | 연부 조직 |

---

## 결과 데이터

### SQLite 테이블

**study_results** (환자 수준):
- reader_id, session_id, mode, case_id
- patient_decision (Yes/No)
- time_spent_sec
- created_at

**lesion_marks** (병변 수준):
- result_id (FK)
- x, y, z 좌표
- confidence (definite/probable/possible)
- mark_order (1-3)

### 내보내기

```bash
# JSON 형식
curl "http://localhost:8000/admin/export?format=json" -o results.json

# CSV 형식
curl "http://localhost:8000/admin/export?format=csv" -o results.csv
```

---

## 개발 명령어

```bash
# Backend 개발 모드 (hot reload)
python backend/run.py --reload

# Backend 프로덕션 모드
python backend/run.py --workers 4

# Frontend 개발 서버
npm run dev

# Frontend 빌드
npm run build

# 테스트 데이터 생성
python scripts/generate_test_data.py --cases 10 --size 256 --slices 80
```

---

## 제약사항 (Acceptance Criteria)

- [x] UNAIDED 세션에서 AI 오버레이 API 호출 시 403 반환
- [x] AIDED 세션에서 AI 오버레이 정상 표시
- [x] Baseline/Followup 슬라이스 동기 스크롤
- [x] 환자 수준 Yes/No 판정 필수
- [x] 최대 3개 병변 마커 제한
- [x] 각 병변에 confidence 필수 (definite/probable/possible)
- [x] 결과 자동 저장 (새로고침 후에도 유지)
- [x] CSV/JSON 내보내기 지원

---

## 라이선스

이 프로젝트는 연구 목적으로 개발되었습니다.
