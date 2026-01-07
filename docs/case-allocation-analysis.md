# 세션/블록별 케이스 할당 로직 분석

> 작성일: 2026-01-07
> 최종 수정: 2026-01-07
> 목적: 케이스 할당 구조 파악 및 Crossover Design 구현

---

## 1. 개요

Reader Study 시스템에서 각 세션과 블록에 케이스를 할당하는 로직을 분석한 문서입니다.

**✅ 2026-01-07 업데이트**: Crossover Design이 적용되어 모든 케이스가 AIDED와 UNAIDED 모두에서 평가될 수 있도록 수정되었습니다.

---

## 2. 핵심 파일 및 함수

| 파일 | 위치 | 함수 | 역할 |
|------|------|------|------|
| `case_discovery_service.py` | Line 218-317 | `allocate_cases_to_session()` | Crossover Design 케이스 할당 |
| `case_discovery_service.py` | Line 359-420 | `get_allocation_preview()` | 할당 미리보기 |
| `case_discovery_service.py` | Line 198-216 | `get_case_ids_by_category()` | positive/negative 케이스 분류 |
| `sessions.py` | Line 192-230 | `enter_session()` (라우터) | 클라이언트가 보낸 케이스 목록으로 세션 진입 |
| `study_session_service.py` | Line 136-252 | `enter_session()` (서비스) | 케이스 순서 셔플 후 DB 저장 |
| `study_session_service.py` | Line 403-468 | `create_session_for_reader()` | 리더에게 세션 할당 (관리자용) |

---

## 3. 데이터 모델

### 3.1 StudySession 테이블 (`database.py:167-210`)

```python
class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True)
    session_code = Column(String(50))           # S1, S2, ...
    reader_id = Column(Integer, ForeignKey("readers.id"))

    # Block/Mode 매핑
    block_a_mode = Column(String(10))           # UNAIDED | AIDED
    block_b_mode = Column(String(10))           # AIDED | UNAIDED

    # 케이스 순서 (JSON 배열, 최초 진입 시 생성)
    case_order_block_a = Column(Text)           # ["case_001", "case_002", ...]
    case_order_block_b = Column(Text)           # ["case_003", "case_004", ...]

    # 설정
    k_max = Column(Integer, default=3)
    ai_threshold = Column(Float, default=0.30)
    status = Column(String(20), default="pending")  # pending | in_progress | completed
```

### 3.2 Block/Mode 매핑 규칙 (Crossover Design)

| 그룹 | 세션 | Block A | Block B |
|------|------|---------|---------|
| Group 1 | S1 | UNAIDED | AIDED |
| Group 1 | S2 | AIDED | UNAIDED |
| Group 2 | S1 | AIDED | UNAIDED |
| Group 2 | S2 | UNAIDED | AIDED |

**Crossover Design 핵심**:
- S1의 block_a와 S2의 block_a는 **동일한 케이스** 포함 (순서만 다름)
- S1의 block_b와 S2의 block_b는 **동일한 케이스** 포함 (순서만 다름)
- 결과: 모든 케이스가 AIDED와 UNAIDED 모두로 평가됨

---

## 4. 케이스 할당 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│  1. CaseDiscoveryService.allocate_cases_to_session()            │
│  ─────────────────────────────────────────────────────────────  │
│  • 데이터셋 스캔하여 positive/negative 케이스 분류              │
│  • Crossover Design: 모든 세션이 전체 케이스 포함              │
│  • 블록 파트를 한 번만 생성 (모든 세션에서 동일하게 사용)      │
│  • positive/negative 비율 유지                                  │
│  • 결과: {"sessions": {"S1": {...}, "S2": {...}}}              │
│         - S1 block_a = S2 block_a (동일 케이스, 순서만 다름)   │
│         - S1 block_b = S2 block_b (동일 케이스, 순서만 다름)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. POST /sessions/{id}/enter  (클라이언트 요청)                │
│  ─────────────────────────────────────────────────────────────  │
│  Request Body:                                                   │
│  {                                                               │
│    "block_a_cases": ["case_001", "case_002", ...],  (60개)      │
│    "block_b_cases": ["case_061", "case_062", ...]   (60개)      │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. StudySessionService.enter_session()                         │
│  ─────────────────────────────────────────────────────────────  │
│  • 최초 진입 시: 케이스 목록 셔플 → DB 저장                     │
│  • 재진입 시: 저장된 순서 사용                                  │
│  • session.case_order_block_a = json.dumps(shuffled_a)          │
│  • session.case_order_block_b = json.dumps(shuffled_b)          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. StudySession (DB 저장)                                      │
│  ─────────────────────────────────────────────────────────────  │
│  • case_order_block_a: 셔플된 Block A 케이스 순서 (JSON)        │
│  • case_order_block_b: 셔플된 Block B 케이스 순서 (JSON)        │
│  • status: "in_progress"                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. 주요 함수 상세 분석

### 5.1 allocate_cases_to_session() - Crossover Design 케이스 할당

**위치**: `backend/app/services/case_discovery_service.py:218-317`

```python
def allocate_cases_to_session(
    self,
    num_sessions: int,
    num_blocks: int = 2,
    shuffle: bool = True
) -> Dict:
    """
    세션/블록별 케이스 자동 할당 (Crossover Design)

    Crossover 연구 설계를 지원합니다:
    - 모든 세션이 전체 케이스를 포함 (세션당 total_cases개)
    - 각 블록은 전체 케이스를 블록 수로 나눈 만큼 포함
    - 모든 세션에서 동일한 블록 파트 사용 (순서만 다름)
    - 이를 통해 모든 케이스가 AIDED/UNAIDED 모두 평가됨
    """
```

**핵심 알고리즘**:
1. `get_case_ids_by_category()`로 positive/negative 케이스 분류
2. 블록당 케이스 수 계산 (세션 수와 무관, 블록 수로만 나눔)
3. **[핵심 1]** 블록 파트를 한 번만 생성 (루프 외부)
4. **[핵심 2]** 모든 세션에 동일한 파트 할당, 블록 내 순서만 셔플

**반환 형식 (예: pos 40, neg 80, 2세션, 2블록)**:
```python
{
    "total_cases": 120,
    "usable_cases": 120,
    "cases_per_session": 120,   # 모든 세션이 전체 케이스 포함
    "cases_per_block": 60,      # 120 / 2 블록
    "positive_per_block": 20,   # 40 / 2 블록
    "negative_per_block": 40,   # 80 / 2 블록
    "ratio": "20:40",
    "sessions": {
        "S1": {
            "block_a": [파트 A 60개 - 순서 #1],
            "block_b": [파트 B 60개 - 순서 #2]
        },
        "S2": {
            "block_a": [파트 A 60개 - 순서 #3],  # S1 block_a와 동일 케이스!
            "block_b": [파트 B 60개 - 순서 #4]   # S1 block_b와 동일 케이스!
        }
    }
}
```

### 5.2 get_allocation_preview() - 할당 미리보기

**위치**: `backend/app/services/case_discovery_service.py:359-420`

```python
def get_allocation_preview(
    self,
    num_sessions: int,
    num_blocks: int = 2
) -> Dict:
    """
    케이스 할당 미리보기 (실제 할당 없이 숫자만 계산)

    Crossover Design을 반영하여:
    - 모든 세션이 전체 케이스를 포함 (세션당 total_cases개)
    - 각 블록은 전체 케이스를 블록 수로 나눈 만큼 포함
    - positive/negative 비율 유지
    """
```

### 5.3 enter_session() - 세션 진입

**위치**: `backend/app/services/study_session_service.py:136-252`

```python
async def enter_session(
    self,
    session_id: int,
    reader_id: int,
    block_a_cases: List[str],  # 클라이언트가 전달
    block_b_cases: List[str]   # 클라이언트가 전달
) -> dict:
```

**동작**:
- **최초 진입** (`case_order_block_a is None`):
  1. 연구 설정 Lock 트리거
  2. 케이스 목록 셔플
  3. DB에 저장 (`case_order_block_a`, `case_order_block_b`)
  4. SessionProgress 생성 (current_block="A", current_case_index=0)

- **재진입**:
  1. 저장된 케이스 순서 사용
  2. last_accessed_at 업데이트

### 5.4 get_case_ids_by_category() - 케이스 분류

**위치**: `backend/app/services/case_discovery_service.py:198-216`

```python
def get_case_ids_by_category(self, shuffle: bool = False) -> Tuple[List[str], List[str]]:
    """
    카테고리별 케이스 ID 목록 반환
    Returns: (positive_ids, negative_ids) 튜플
    """
    cases = self.scan_dataset_cases()
    positive_ids = [c.case_id for c in cases["positive"]]
    negative_ids = [c.case_id for c in cases["negative"]]
```

---

## 6. Crossover Design 검증

### 6.1 검증 결과 (2026-01-07)

| 항목 | 값 | 설명 |
|------|-----|------|
| 전체 케이스 | 120개 | pos:40, neg:80 |
| 세션당 케이스 | 120개 | 모든 세션이 전체 케이스 포함 ✅ |
| 블록당 케이스 | 60개 | 120 / 2 블록 ✅ |
| positive/block | 20개 | 40 / 2 블록 ✅ |
| negative/block | 40개 | 80 / 2 블록 ✅ |
| 비율 유지 | 20:40 (1:2) | positive/negative 비율 유지 ✅ |

### 6.2 Crossover 일관성 검증

| 검증 항목 | 결과 | 설명 |
|-----------|------|------|
| S1 block_a == S2 block_a | ✅ True | 동일한 케이스 구성 |
| S1 block_b == S2 block_b | ✅ True | 동일한 케이스 구성 |
| block_a ∩ block_b | ✅ 0개 | 블록 간 중복 없음 |
| block_a ∪ block_b | ✅ 120개 | 전체 케이스 커버 |

### 6.3 AIDED/UNAIDED 비교 가능성

```
한 리더 (Group 1) 관점:

| 세션 | 블록 | 모드     | 케이스 파트 |
|-----|-----|----------|------------|
| S1  | A   | UNAIDED  | 파트 A (60개) |
| S1  | B   | AIDED    | 파트 B (60개) |
| S2  | A   | AIDED    | 파트 A (60개) ← S1과 동일 케이스!
| S2  | B   | UNAIDED  | 파트 B (60개) ← S1과 동일 케이스!

결과:
- 파트 A 60개: S1에서 UNAIDED, S2에서 AIDED로 평가
- 파트 B 60개: S1에서 AIDED, S2에서 UNAIDED로 평가
- → 모든 120개 케이스가 양쪽 모드로 평가됨 ✅
```

---

## 7. 관련 API 엔드포인트

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/case/allocate` | Crossover Design 케이스 할당 |
| POST | `/sessions/{id}/enter` | 세션 진입 (케이스 목록 전달) |
| GET | `/sessions/my` | 내 세션 목록 조회 |
| POST | `/sessions/assign` | 세션 할당 (관리자) |
| POST | `/sessions/{id}/reset` | 세션 초기화 (관리자) |

---

## 8. 수정 이력

### 2026-01-07: Crossover Design 구현 (옵션 C)

**변경 파일**: `backend/app/services/case_discovery_service.py`

**변경 함수**:
1. `allocate_cases_to_session()` (Line 218-317)
2. `get_allocation_preview()` (Line 359-420)

**핵심 변경점**:
| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 세션당 케이스 | total / num_sessions | total (전체) |
| 블록당 케이스 | total / (sessions × blocks) | total / num_blocks |
| 세션 간 케이스 | 분할 (중복 없음) | 동일 (순서만 다름) |
| AIDED/UNAIDED 비교 | 불가능 | ✅ 가능 |

**선택 이유** (옵션 C):
- 최소 변경으로 요구사항 충족
- API 호환성 유지 (프론트엔드 수정 불필요)
- 기존 흐름 유지

---

## 9. 참고 파일

- `backend/app/services/case_discovery_service.py`
- `backend/app/services/study_session_service.py`
- `backend/app/routers/sessions.py`
- `backend/app/routers/case.py`
- `backend/app/models/database.py`
- `backend/app/models/schemas.py`
