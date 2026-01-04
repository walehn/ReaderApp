#!/usr/bin/env python3
"""
============================================================================
Create Admin Script - Reader Study MVP
============================================================================
역할: 최초 관리자 계정 생성 CLI 스크립트

사용법:
  cd /home/walehn/ReaderApp
  source ReaderApp/bin/activate
  python backend/scripts/create_admin.py --email admin@example.com --password your_password

옵션:
  --email       관리자 이메일 (필수)
  --password    관리자 비밀번호 (필수)
  --name        관리자 이름 (기본값: "Administrator")
  --code        관리자 코드 (기본값: "ADMIN")

출력:
  성공 시: 생성된 관리자 정보 출력
  실패 시: 에러 메시지 출력

주의사항:
  - 동일 이메일 또는 코드가 이미 존재하면 에러
  - 프로덕션에서는 강력한 비밀번호 사용 권장
============================================================================
"""

import sys
import asyncio
import argparse
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select
from app.models.database import async_session, init_db, Reader
from app.core.security import hash_password


async def create_admin(
    email: str,
    password: str,
    name: str = "Administrator",
    code: str = "ADMIN"
) -> None:
    """
    관리자 계정 생성

    Args:
        email: 관리자 이메일
        password: 관리자 비밀번호
        name: 관리자 이름
        code: 관리자 코드 (reader_code)
    """
    # 데이터베이스 초기화
    await init_db()

    async with async_session() as session:
        # 중복 확인 - 이메일
        existing_email = await session.execute(
            select(Reader).where(Reader.email == email)
        )
        if existing_email.scalar_one_or_none():
            print(f"Error: 이메일 '{email}'이 이미 사용 중입니다.")
            sys.exit(1)

        # 중복 확인 - 코드
        existing_code = await session.execute(
            select(Reader).where(Reader.reader_code == code)
        )
        if existing_code.scalar_one_or_none():
            print(f"Error: 코드 '{code}'가 이미 사용 중입니다.")
            sys.exit(1)

        # 관리자 생성
        admin = Reader(
            reader_code=code,
            name=name,
            email=email,
            password_hash=hash_password(password),
            role="admin",
            group=None,  # 관리자는 그룹 없음
            is_active=True
        )
        session.add(admin)
        await session.commit()
        await session.refresh(admin)

        print("=" * 60)
        print("관리자 계정이 성공적으로 생성되었습니다!")
        print("=" * 60)
        print(f"  코드:     {admin.reader_code}")
        print(f"  이름:     {admin.name}")
        print(f"  이메일:   {admin.email}")
        print(f"  역할:     {admin.role}")
        print(f"  생성일:   {admin.created_at}")
        print("=" * 60)
        print("\n이 계정으로 로그인하여 다른 리더 계정을 생성할 수 있습니다.")


def main():
    parser = argparse.ArgumentParser(
        description="Reader Study MVP - 관리자 계정 생성",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
사용 예시:
  python create_admin.py --email admin@hospital.com --password SecurePass123!
  python create_admin.py -e admin@hospital.com -p SecurePass123! --name "Dr. Kim" --code "ADMIN01"
        """
    )
    parser.add_argument(
        "-e", "--email",
        required=True,
        help="관리자 이메일 (로그인 ID로 사용)"
    )
    parser.add_argument(
        "-p", "--password",
        required=True,
        help="관리자 비밀번호"
    )
    parser.add_argument(
        "--name",
        default="Administrator",
        help="관리자 이름 (기본값: Administrator)"
    )
    parser.add_argument(
        "--code",
        default="ADMIN",
        help="관리자 코드/ID (기본값: ADMIN)"
    )

    args = parser.parse_args()

    # 비밀번호 길이 확인
    if len(args.password) < 4:
        print("Warning: 비밀번호가 너무 짧습니다. 보안을 위해 더 긴 비밀번호를 사용하세요.")

    # 관리자 생성 실행
    asyncio.run(create_admin(
        email=args.email,
        password=args.password,
        name=args.name,
        code=args.code
    ))


if __name__ == "__main__":
    main()
