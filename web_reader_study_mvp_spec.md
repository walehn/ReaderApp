# Web-based Reader Study App MVP Specification

## Purpose
A minimal, fast-to-develop web-based reader study application to evaluate **patient-level FN reduction** in detecting **NEW hepatic metastasis**, while maintaining unaided/aided separation and basic longitudinal comparison.

This MVP prioritizes:
- Research validity (unaided vs aided integrity)
- Clinical realism
- Fast implementation and deployment

---

## 1. Core Study Design Assumptions

- **Baseline imaging is classified as metastasis-negative by reference standard**
- Any metastasis detected on follow-up is **defined as NEW**
- Readers are asked only to judge **presence or absence of hepatic metastasis on follow-up**, using baseline as reference
- Unaided and aided conditions are **fixed per session** (no mixing within a session)

---

## 2. MVP Scope (What Is Included)

### Mandatory
- Web-based viewer (baseline + follow-up)
- Unaided / Aided session separation
- Patient-level decision (Yes / No)
- Top-K lesion marking (K=3)
- Lesion-level confidence category (definite / probable / possible)
- Fast NIfTI handling via server-side rendering
- Automatic result saving
- CSV / JSON export

### Explicitly Excluded (for MVP speed)
- Browser-side NIfTI rendering
- Complex authentication (SSO, OAuth)
- Real-time QC dashboards
- MRMC statistical analysis modules
- Fully blinded technical enforcement beyond session-level controls

---

## 3. High-level Architecture

### Backend
- Python + FastAPI
- Server-side NIfTI loading and slice rendering
- Optional Zarr-based ingest cache
- SQLite or file-based result storage

### Frontend
- React (or Vue) SPA
- 2-up synchronized slice viewer
- Canvas-based lesion markers
- Simple form-based inputs

---

## 4. Data Organization

```
cases/
  case_0001/
    baseline.nii.gz
    followup.nii.gz
    ai_prob.nii.gz        # aided only (optional)
  case_0002/
    ...
```

---

## 5. Session Configuration (Pre-generated)

Example: `session_R03_S1.json`

```json
{
  "reader_id": "R03",
  "session_id": "S1",
  "mode": "UNAIDED",
  "case_ids": ["case_0001", "case_0002"],
  "k_max": 3,
  "ai_threshold": 0.30
}
```

- UNAIDED sessions cannot access AI overlay endpoints
- Crossover is achieved by providing a second session file with mode=AIDED

---

## 6. Backend API Specification (Minimal)

### 6.1 Case Metadata
`GET /case/meta?case_id=...`

Returns:
- image shape
- slice count
- spacing
- AI availability

---

### 6.2 Slice Rendering
`GET /render/slice`

Parameters:
- case_id
- series = baseline | followup
- z (slice index)
- wl = liver | soft

Returns:
- PNG image

Caching:
- RAM LRU cache by (case_id, series, z, wl)

---

### 6.3 AI Overlay (AIDED only)
`GET /render/overlay`

Parameters:
- case_id
- z
- threshold (default 0.30)
- alpha (default 0.4)

Server behavior:
- Returns 403 if session mode is UNAIDED

---

### 6.4 Result Submission
`POST /study/submit`

```json
{
  "reader_id": "R03",
  "session_id": "S1",
  "mode": "UNAIDED",
  "case_id": "case_0001",
  "patient_new_met_present": true,
  "lesions": [
    {"x": 123, "y": 88, "z": 45, "confidence": "probable"}
  ],
  "time_spent_sec": 95
}
```

Validation:
- patient decision required
- lesions <= K
- UNAIDED cannot submit AI-derived fields

---

## 7. Frontend Functional Specification

### Viewer
- Side-by-side baseline (left) and follow-up (right)
- Z-slice synchronized scrolling
- Two WL presets only (liver / soft tissue)

### Aided Mode
- Overlay toggle
- Fixed threshold
- No AI controls in unaided mode

### Input Panel
- Patient-level Yes / No (required)
- Lesion marking on follow-up only
- Max 3 lesions
- Confidence dropdown per lesion
- Submit + auto-advance

### Progress
- Case counter (current / total)
- Automatic time tracking

---

## 8. Result Storage

### Per-case record
- reader_id
- session_id
- mode
- case_id
- patient_decision
- lesions (coords + confidence)
- time_spent_sec
- timestamp

### Storage options
- SQLite (recommended)
- JSONL file (one line per case)

---

## 9. Export

`GET /admin/export?session_id=...&format=csv|json`

Exports:
- Patient-level table
- Lesion-level table

---

## 10. Technology Stack

### Backend
- fastapi
- uvicorn
- nibabel
- numpy
- pillow or opencv-python-headless
- zarr, numcodecs (optional)
- sqlalchemy + sqlite
- cachetools

### Frontend
- React + Vite
- HTML5 canvas for markers
- Basic CSS (no heavy UI frameworks required)

---

## 11. Acceptance Criteria

- Unaided session cannot access AI overlays (server enforced)
- Aided session displays AI overlay correctly
- Baseline/follow-up slices move synchronously
- Patient Yes/No is mandatory
- Max 3 lesions enforced
- Confidence required for each lesion
- Results persist after refresh
- CSV/JSON export works

---

## 12. Rationale

This MVP is sufficient to:
- Demonstrate patient-level FN reduction
- Preserve unaided vs aided comparison validity
- Reflect realistic longitudinal reading workflow
- Be implemented quickly with minimal engineering overhead
