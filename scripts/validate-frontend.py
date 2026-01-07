#!/usr/bin/env python3
"""
============================================================================
프론트엔드 파일 수정 후 Chrome Extension 검증 알림 Hook
============================================================================
역할: Edit/Write 도구로 프론트엔드 파일 수정 시 자동으로 검증 알림 출력

실행 조건:
- .js, .jsx, .ts, .tsx, .css 파일 수정 시
- frontend/ 디렉토리 내 파일만 대상

출력:
- 검증 필요 알림 메시지
- 수정된 파일 경로
- 브라우저 확인 안내

사용법:
- .claude/settings.local.json의 hooks에 등록
- 자동으로 실행됨 (수동 실행 불필요)
============================================================================
"""

import json
import sys
import os
from pathlib import Path

# 프론트엔드 파일 확장자
FRONTEND_EXTENSIONS = {'.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html'}

# 프론트엔드 디렉토리 패턴
FRONTEND_DIRS = ['frontend', 'src', 'components', 'pages']


def is_frontend_file(file_path: str) -> bool:
    """프론트엔드 파일 여부 확인"""
    if not file_path:
        return False

    path = Path(file_path)

    # 확장자 확인
    if path.suffix.lower() not in FRONTEND_EXTENSIONS:
        return False

    # 경로에 frontend 관련 디렉토리 포함 여부
    normalized_path = file_path.replace('\\', '/').lower()
    return any(dir_name in normalized_path for dir_name in FRONTEND_DIRS)


def main():
    try:
        # stdin에서 Hook 데이터 읽기
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        # JSON 파싱 실패 시 조용히 종료
        sys.exit(0)

    # PostToolUse 이벤트만 처리
    hook_event = input_data.get('hook_event_name', '')
    if hook_event != 'PostToolUse':
        sys.exit(0)

    # Edit/Write 도구만 처리
    tool_name = input_data.get('tool_name', '')
    if tool_name not in ('Edit', 'Write'):
        sys.exit(0)

    # 파일 경로 추출
    tool_input = input_data.get('tool_input', {})
    file_path = tool_input.get('file_path', '')

    # 프론트엔드 파일이 아니면 무시
    if not is_frontend_file(file_path):
        sys.exit(0)

    # 검증 알림 메시지 출력
    filename = Path(file_path).name

    print("\n" + "=" * 60)
    print("  FRONTEND VERIFICATION REMINDER")
    print("=" * 60)
    print(f"  Modified: {filename}")
    print("-" * 60)
    print("  Please verify in Chrome with Claude Extension:")
    print("  1. Open http://localhost:5173 in Chrome")
    print("  2. Use Claude Extension to verify the changes")
    print("  3. Check for visual/functional issues")
    print("=" * 60 + "\n")

    # 정상 종료 (block하지 않음)
    sys.exit(0)


if __name__ == '__main__':
    main()
