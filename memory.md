# NiiVue 메모리 최적화 현황

## 적용된 수정 사항

### 1) 언마운트 cleanup에 볼륨 제거 추가 ✅ 완료
**파일**: `frontend/src/components/NiiVueCanvas.jsx` (라인 188-218)

**수정 내용**:
- `removeVolumeByIndex()`로 볼륨 역순 제거
- 볼륨 제거 후 `loseContext()` 호출
- `nvRef.current = null`로 참조 해제

**효과**: 언마운트 시 GPU/CPU 메모리 명시적 해제

### 2) AI 오버레이 cancelled 플래그 추가 ✅ 완료
**파일**: `frontend/src/components/NiiVueCanvas.jsx` (라인 319-395)

**수정 내용**:
- `let cancelled = false` 플래그 추가
- 비동기 로딩 완료 후 `cancelled` 체크
- cleanup에서 `cancelled = true` 설정

**효과**: 케이스 전환 시 stale 요청 무시

### 3) ViewerPage 로딩 오버레이 패턴 적용 ✅ 완료
**파일**: `frontend/src/pages/ViewerPage.jsx` (라인 350-388)

**수정 내용**:
- `caseData.loading` 시 Viewer 언마운트 대신 오버레이 표시
- `stableCaseId` ref 패턴으로 케이스 전환 시 caseId 유지
- `key="main-viewer"` 추가

### 4) React.StrictMode 비활성화 ✅ 완료
**파일**: `frontend/src/main.jsx`

**수정 내용**:
- StrictMode 래퍼 제거
- 개발 모드에서 이중 마운트 방지

### 5) NiiVueCanvas key prop 추가 ✅ 완료
**파일**: `frontend/src/components/Viewer.jsx` (라인 193, 227)

**수정 내용**:
- `key="niivue-baseline"` 추가
- `key="niivue-followup"` 추가

---

## 미해결 문제

### 케이스 전환 시 NiiVue 인스턴스 재생성 ⚠️ 부분 해결

**현상**: 위의 모든 수정을 적용했음에도 케이스 전환 시 NiiVue 인스턴스가 재생성됨

**원인 분석**:
1. `key` prop만으로는 React reconciliation 문제를 완전히 해결하지 못함
2. `useCase` 훅의 상태 변화가 연쇄적인 리렌더링을 유발
3. 부모 컴포넌트의 상태 변화로 인해 컴포넌트 트리 구조가 변경됨

**콘솔 로그 패턴**:
```
New volume loaded: [old_case] baseline/followup  ← 볼륨 교체 (정상)
Instance created (once) x2                        ← 인스턴스 재생성 (문제)
New volume loaded: [both cases]                   ← 구/신 볼륨 혼재
```

---

## 권장 후속 조치

### 1. NiiVue 인스턴스 싱글톤 패턴 (권장)
NiiVue 인스턴스를 React 컴포넌트 외부에서 관리:
```javascript
// services/niivueManager.js
const instances = new Map()

export function getNiiVueInstance(canvasId) {
  if (!instances.has(canvasId)) {
    instances.set(canvasId, new Niivue(...))
  }
  return instances.get(canvasId)
}
```

### 2. Context API로 인스턴스 공유
App 레벨에서 NiiVue 인스턴스 생성하고 Context로 전달

### 3. 프로덕션 빌드에서 테스트
개발 모드의 HMR(Hot Module Replacement)이 영향을 줄 수 있으므로,
`npm run build && npm run preview`로 프로덕션 빌드에서 테스트 권장

---

## 테스트 결과 요약 (2025-01-08)

| 테스트 항목 | 결과 |
|------------|------|
| 초기 로드 시 인스턴스 수 | 2개 (정상) |
| 케이스 전환 시 볼륨 교체 | 동작함 |
| 케이스 전환 시 인스턴스 재생성 | 발생함 (문제) |
| StrictMode 비활성화 효과 | 초기 이중 마운트 해결 |
| HMR 영향 | 개발 모드에서 다수 인스턴스 생성 |
