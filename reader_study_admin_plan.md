# 리더 스터디 관리자 설정 페이지 설계안

## 1. 목적 및 설계 원칙

본 관리자 페이지는 리더 스터디 전반의 구조적 설정을 **GUI 기반으로 일관되게 관리**하기 위한 단일 컨트롤 타워 역할을 한다. 연구 설계 변경이 잦은 초기 단계에서도 **코드 수정 없이 설정 변경**이 가능하도록 하는 것을 1차 목표로 한다.

설계 원칙은 다음과 같다.

- 연구 방법론적으로 방어 가능한 옵션만 노출
- 리더 입장에서는 설정 변경이 체감되지 않도록 완전 추상화
- 세션 시작 이후에는 핵심 설정의 변경을 제한하여 데이터 무결성 보장

---

## 2. 필수 설정 항목 (요청 사항 반영)

### 2.1 세션(Session) 설정

- 총 세션 수
- 세션별 케이스 수
- 세션 순서 고정 여부 (랜덤 / 고정)
- 세션 간 휴식 권장 시간(메타 정보)

### 2.2 블록(Block) 설정

- 총 블록 수
- 블록 구성 방식
  - Sequential (Block 1 → Block 2)
  - Crossover (A/B 교차)
- 블록별 모드 지정
  - UNAIDED
  - AIDED
- 블록 내 케이스 순서
  - 완전 랜덤
  - 난이도 stratified 랜덤

### 2.3 Unaided / Aided 적용 방식

- Aided 모드 정의
  - AI overlay on/off
  - AI 결과 표시 방식
    - heatmap
    - candidate point
    - bounding marker
- Aided 모드에서 허용되는 추가 정보
  - confidence score 표시 여부
  - top-k 제한

### 2.4 리더 그룹 설정

- 리더 그룹 수
- 그룹별 리더 할당
- 그룹 간 설계 관계
  - Parallel design
  - Crossover design
- 그룹별 서로 다른 세션/블록 매핑 허용 여부

---

## 3. 추가로 권장되는 핵심 설정 항목

### 3.1 케이스 분배 및 랜덤화 정책 (강력 권장)

- 케이스 배정 단위
  - reader-level
  - group-level
- 랜덤 시드 고정 여부 (재현성 목적)
- Positive / Negative 비율 강제 옵션
- Hard case over-sampling 옵션

> **의의**: 리더 간 난이도 편차로 인한 성능 왜곡 방지

---

### 3.2 입력 및 응답 포맷 제어

- Patient-level 판단 필수 여부 (Yes/No)
- Lesion marking 필수 여부
- 최대 허용 lesion 수 (k_max)
- confidence score 입력 방식
  - categorical
  - continuous

---

### 3.3 시간 및 피로도 관리 설정

- 케이스당 최소/최대 판독 시간 제한
- 극단적 outlier time flagging
- 세션 내 권장 최대 케이스 수 (fatigue guardrail)

> **의의**: 비정상적으로 빠른 판독 데이터 사후 필터링 가능

---

### 3.4 블라인딩 및 누출 방지 설정

- 이전 세션 결과 접근 차단
- Aided 세션에서 Unaided 결과 참조 차단
- 리더 간 결과 상호 접근 완전 차단
- 동일 케이스 재노출 시 알림/차단 옵션

---

## 4. 운영 및 모니터링용 관리자 기능

### 4.1 진행 현황 대시보드

- 리더별 / 그룹별 진행률
- 세션별 완료율
- 평균 판독 시간
- 중도 이탈 리더 상태 표시

### 4.2 데이터 무결성 체크

- 중복 제출 감지
- 누락 항목 자동 검증
- 규칙 위반 데이터 flagging

---

## 5. 설정 변경 정책 (중요)

### 5.1 Lock 정책

- 아래 항목은 **첫 세션 시작 이후 수정 불가**
  - 세션 수
  - 블록 구조
  - Unaided/Aided 매핑
  - 케이스 할당 결과

### 5.2 수정 허용 항목

- UI 표현 방식
- 메타 정보
- 진행 알림 문구

---

## 6. 구현 관점에서의 권장 구조

### 6.1 설정 계층 구조 (예시)

```
StudyConfig
 ├─ Global
 │   ├─ random_seed
 │   ├─ k_max
 │   └─ fatigue_guardrail
 ├─ Groups
 │   ├─ GroupA
 │   └─ GroupB
 ├─ Blocks
 │   ├─ Block1 (UNAIDED)
 │   └─ Block2 (AIDED)
 └─ Sessions
     ├─ Session1
     └─ Session2
```

### 6.2 권장 UX

- Step-by-step wizard 형식
- 마지막 단계에서 **연구 설계 요약 자동 생성**
- 설정 확정 전 dry-run validation

---

## 7. 최소 구현(MVP) vs 확장 로드맵

### MVP에 반드시 포함

- 세션 수 / 블록 수
- Unaided / Aided 매핑
- 리더 그룹 수
- k_max 설정
- 진행률 모니터링

### Phase 2 확장

- Hard case stratification
- 시간 기반 quality control
- 결과 export + analysis preset

---

## 8. 한 줄 요약

> **관리자 페이지는 단순 설정 화면이 아니라, 리더 스터디의 방법론적 일관성과 데이터 신뢰도를 보장하는 연구 설계 엔진이다.**

