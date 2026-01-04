#!/usr/bin/env python3
"""
============================================================================
Web Reader Study - Backend Server Runner
============================================================================
역할: FastAPI 서버 실행 스크립트

사용법:
  python run.py                    # 기본 실행 (0.0.0.0:8000)
  python run.py --port 8080        # 포트 지정
  python run.py --host 127.0.0.1   # 호스트 지정 (로컬만)
  python run.py --reload           # 개발 모드 (코드 변경 시 자동 재시작)
  python run.py --workers 4        # 워커 프로세스 수 (프로덕션)

옵션:
  --host HOST    바인딩 호스트 (기본값: 0.0.0.0)
  --port PORT    포트 번호 (기본값: 8000)
  --reload       개발 모드 - 코드 변경 시 자동 재시작
  --workers N    워커 프로세스 수 (기본값: 1, reload와 함께 사용 불가)

출력:
  서버 시작 후 다음 URL에서 접속 가능:
    - API: http://localhost:8000
    - Swagger UI: http://localhost:8000/docs
    - ReDoc: http://localhost:8000/redoc

예시:
  # 개발 환경
  source /home/walehn/ReaderApp/ReaderApp/bin/activate
  python run.py --reload

  # 프로덕션 환경
  python run.py --workers 4
============================================================================
"""

import argparse
import uvicorn
import sys
from pathlib import Path

# 프로젝트 루트를 Python path에 추가
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))


def parse_args():
    """명령줄 인수 파싱"""
    parser = argparse.ArgumentParser(
        description="Reader Study MVP Backend Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run.py                    # Default (0.0.0.0:8000)
  python run.py --reload           # Development mode
  python run.py --port 8080        # Custom port
  python run.py --workers 4        # Production mode
        """
    )

    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Bind host (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port number (default: 8000)"
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development"
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (default: 1)"
    )

    return parser.parse_args()


def main():
    """서버 실행"""
    args = parse_args()

    # reload와 workers는 함께 사용 불가
    if args.reload and args.workers > 1:
        print("Warning: --reload cannot be used with multiple workers. Using single worker.")
        args.workers = 1

    print("=" * 60)
    print("Reader Study MVP Backend Server")
    print("=" * 60)
    print(f"  Host: {args.host}")
    print(f"  Port: {args.port}")
    print(f"  Reload: {args.reload}")
    print(f"  Workers: {args.workers}")
    print("=" * 60)
    print(f"  API URL: http://localhost:{args.port}")
    print(f"  Swagger: http://localhost:{args.port}/docs")
    print("=" * 60)

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1
    )


if __name__ == "__main__":
    main()
