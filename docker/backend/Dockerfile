# ============================================================================
# ReaderApp Backend Dockerfile
# ============================================================================
# 역할: FastAPI 백엔드 서버 컨테이너 빌드
#
# 빌드 옵션:
#   docker build -f docker/backend/Dockerfile -t readerapp-backend .
#
# 실행:
#   docker run -p 8000:8000 readerapp-backend
#
# 주요 특징:
#   - Python 3.12-slim 기반 (경량 이미지)
#   - 비루트 사용자로 실행 (보안)
#   - 헬스 체크 내장
#   - NIfTI 처리를 위한 시스템 의존성 포함
# ============================================================================

FROM python:3.12-slim

# 메타데이터
LABEL maintainer="ReaderApp Team"
LABEL description="ReaderApp Backend - FastAPI Medical Imaging Server"
LABEL version="1.0"

# 시스템 의존성 설치 (NIfTI/이미지 처리용)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # 이미지 처리 라이브러리
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    # 헬스 체크용 curl
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 먼저 복사 및 설치 (Docker 캐시 활용)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY backend/app ./app

# 비루트 사용자 생성 및 권한 설정
RUN useradd -m -u 1000 -s /bin/bash appuser && \
    chown -R appuser:appuser /app

# 비루트 사용자로 전환
USER appuser

# 환경 변수 설정
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# 헬스 체크 (30초 간격, 10초 타임아웃)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 포트 노출
EXPOSE 8000

# FastAPI 서버 실행 (uvicorn)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
