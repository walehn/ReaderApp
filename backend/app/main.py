"""
============================================================================
Web Reader Study MVP - FastAPI Backend
============================================================================
역할: 간 전이 병변 검출을 위한 Reader Study 웹 서버

주요 기능:
  - NIfTI 이미지 슬라이스 렌더링 (JPEG)
  - AI 오버레이 제공 (AIDED 모드 전용)
  - 결과 저장 및 내보내기
  - 세션 관리

API 엔드포인트:
  - GET  /case/meta          케이스 메타데이터
  - GET  /render/slice       슬라이스 이미지
  - GET  /render/overlay     AI 오버레이 (AIDED only)
  - POST /study/submit       결과 제출
  - GET  /study/session      세션 설정
  - GET  /study/progress     진행 상황
  - GET  /admin/export       데이터 내보내기
  - GET  /admin/sessions     세션 목록
  - GET  /admin/cache-stats  캐시 통계

사용법:
  # 개발 모드
  cd /home/walehn/ReaderApp
  source ReaderApp/bin/activate
  python backend/run.py --reload

  # 프로덕션 모드
  python backend/run.py --workers 4

Swagger UI:
  http://localhost:8000/docs
============================================================================
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models.database import init_db
from app.routers import case, render, study, admin
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 이벤트 핸들러"""
    # 시작 시: 데이터베이스 초기화
    await init_db()
    print("=" * 60)
    print("Reader Study MVP Backend Started")
    print(f"  Cases directory: {settings.CASES_DIR}")
    print(f"  Sessions directory: {settings.SESSIONS_DIR}")
    print(f"  Results directory: {settings.RESULTS_DIR}")
    print("=" * 60)

    yield

    # 종료 시: 정리 작업
    print("Reader Study MVP Backend Shutdown")


# FastAPI 애플리케이션 생성
app = FastAPI(
    title="Reader Study MVP",
    description="Web-based Reader Study for hepatic metastasis detection",
    version="0.1.0",
    lifespan=lifespan
)

# CORS 설정 (개발용 - 프로덕션에서는 제한 필요)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(case.router)
app.include_router(render.router)
app.include_router(study.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    """루트 엔드포인트 - 상태 확인용"""
    return {
        "service": "Reader Study MVP",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    return {"status": "healthy"}
