# Claude Code Guidelines

## 환경 설정

### 운영체제
- Windows 10/11

### Python 가상환경
- **위치**: `E:\ReaderApp\venv\`
- **Python 버전**: 3.12.7
- **활성화 방법**:
  ```powershell
  # PowerShell
  E:\ReaderApp\venv\Scripts\Activate.ps1
  
  # CMD
  E:\ReaderApp\venv\Scripts\activate.bat
  ```
- **패키지 설치**: `pip install -r backend/requirements.txt`

### 주요 의존성
- FastAPI 0.128.0 (웹 프레임워크)
- Uvicorn 0.40.0 (ASGI 서버)
- nibabel 5.3.3 (NIfTI 의료 이미지 처리)
- SQLAlchemy 2.0.45 (데이터베이스 ORM)
- Pydantic 2.12.5 (데이터 검증)

---

## 코딩 가이드라인

1. All output must be in Korean.

2. Use Serena tools first when available.

3. When generating any script, begin with comments that clearly explain:
- the script’s role/purpose
- available options/flags/configurations
- expected outputs/results
- detailed usage instructions

4. When modifying code, also update related comments accordingly.
If options are added/changed, default values are modified, or output formats are altered, ensure that:
- header comments
- usage examples
are kept fully synchronized.

5. Keep comments, option defaults, and usage examples aligned at all times.

6. Create a git commit whenever significant code updates are made.
This includes:
- Adding new features or functionality
- Fixing bugs
- Refactoring existing code
- Updating configurations or dependencies