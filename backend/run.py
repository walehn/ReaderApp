#!/usr/bin/env python3
"""
============================================================================
Web Reader Study - Backend Server Runner
============================================================================
역할: FastAPI 서버 실행 스크립트 (PID 파일 관리 포함)

사용법:
  python run.py                    # 기본 실행 (0.0.0.0:8000)
  python run.py --port 8080        # 포트 지정
  python run.py --host 127.0.0.1   # 호스트 지정 (로컬만)
  python run.py --reload           # 개발 모드 (코드 변경 시 자동 재시작)
  python run.py --workers 4        # 워커 프로세스 수 (프로덕션)
  python run.py --stop             # 실행 중인 서버 종료

옵션:
  --host HOST    바인딩 호스트 (기본값: 0.0.0.0)
  --port PORT    포트 번호 (기본값: 8000)
  --reload       개발 모드 - 코드 변경 시 자동 재시작
  --workers N    워커 프로세스 수 (기본값: 1, reload와 함께 사용 불가)
  --stop         실행 중인 서버 종료 (PID 파일 또는 포트 기반)

출력:
  서버 시작 후 다음 URL에서 접속 가능:
    - API: http://localhost:8000
    - Swagger UI: http://localhost:8000/docs
    - ReDoc: http://localhost:8000/redoc

예시:
  # 개발 환경
  python run.py --reload

  # 서버 중지
  python run.py --stop

  # 프로덕션 환경
  python run.py --workers 4
============================================================================
"""

import argparse
import uvicorn
import sys
import os
import signal
import subprocess
import atexit
from pathlib import Path

# 프로젝트 루트를 Python path에 추가
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# PID 파일 경로
PID_FILE = PROJECT_ROOT / ".server.pid"


def get_pids_by_port(port: int) -> list:
    """포트를 사용 중인 프로세스 PID 목록 반환 (Windows)"""
    pids = []
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            shell=True
        )
        for line in result.stdout.split("\n"):
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                if parts:
                    try:
                        pid = int(parts[-1])
                        if pid not in pids and pid != 0:
                            pids.append(pid)
                    except ValueError:
                        pass
    except Exception as e:
        print(f"Warning: Could not check port {port}: {e}")
    return pids


def kill_process(pid: int) -> bool:
    """프로세스 종료 (Windows/Unix 호환)"""
    try:
        if sys.platform == "win32":
            # Windows: taskkill /F /T (트리 킬)
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                capture_output=True,
                shell=True
            )
        else:
            # Unix: SIGTERM
            os.kill(pid, signal.SIGTERM)
        return True
    except Exception as e:
        print(f"Warning: Could not kill PID {pid}: {e}")
        return False


def stop_server(port: int = 8000) -> bool:
    """
    서버 종료
    1. PID 파일에서 PID 읽어서 종료
    2. 포트를 사용 중인 프로세스 종료
    """
    stopped = False

    # 1. PID 파일 확인
    if PID_FILE.exists():
        try:
            pid = int(PID_FILE.read_text().strip())
            print(f"Stopping server (PID: {pid})...")
            if kill_process(pid):
                stopped = True
            PID_FILE.unlink(missing_ok=True)
        except Exception as e:
            print(f"Warning: Could not read PID file: {e}")

    # 2. 포트 점유 프로세스 확인
    pids = get_pids_by_port(port)
    if pids:
        print(f"Found {len(pids)} process(es) on port {port}: {pids}")
        for pid in pids:
            print(f"  Killing PID {pid}...")
            if kill_process(pid):
                stopped = True

    if stopped:
        print("Server stopped successfully.")
    else:
        print("No running server found.")

    return stopped


def save_pid():
    """현재 프로세스 PID를 파일에 저장"""
    PID_FILE.write_text(str(os.getpid()))


def cleanup_pid():
    """종료 시 PID 파일 삭제"""
    PID_FILE.unlink(missing_ok=True)


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
    parser.add_argument(
        "--stop",
        action="store_true",
        help="Stop running server"
    )

    return parser.parse_args()


def main():
    """서버 실행"""
    args = parse_args()

    # --stop 옵션 처리
    if args.stop:
        stop_server(args.port)
        return

    # 기존 서버 종료 (포트 충돌 방지)
    existing_pids = get_pids_by_port(args.port)
    if existing_pids:
        print(f"Found existing server on port {args.port}, stopping...")
        stop_server(args.port)
        import time
        time.sleep(2)  # 프로세스 종료 대기

    # reload와 workers는 함께 사용 불가
    if args.reload and args.workers > 1:
        print("Warning: --reload cannot be used with multiple workers. Using single worker.")
        args.workers = 1

    # PID 저장 및 종료 시 정리 등록
    save_pid()
    atexit.register(cleanup_pid)

    print("=" * 60)
    print("Reader Study MVP Backend Server")
    print("=" * 60)
    print(f"  Host: {args.host}")
    print(f"  Port: {args.port}")
    print(f"  Reload: {args.reload}")
    print(f"  Workers: {args.workers}")
    print(f"  PID: {os.getpid()}")
    print("=" * 60)
    print(f"  API URL: http://localhost:{args.port}")
    print(f"  Swagger: http://localhost:{args.port}/docs")
    print("=" * 60)
    print("  Stop: python run.py --stop")
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
