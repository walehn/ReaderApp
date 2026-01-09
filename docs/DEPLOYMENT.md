# ReaderApp Docker 배포 가이드

병원/연구소 내부 배포를 위한 Docker Compose 기반 배포 문서입니다.

---

## 목차

1. [시스템 요구사항](#시스템-요구사항)
2. [아키텍처](#아키텍처)
3. [빠른 시작](#빠른-시작)
4. [상세 설정](#상세-설정)
5. [운영 명령어](#운영-명령어)
6. [모니터링](#모니터링)
7. [백업 및 복구](#백업-및-복구)
8. [트러블슈팅](#트러블슈팅)
9. [보안 설정](#보안-설정)

---

## 시스템 요구사항

### 필수 소프트웨어
- **Docker**: 20.10 이상
- **Docker Compose**: 2.0 이상 (또는 docker-compose v1.29+)

### 권장 하드웨어
| 항목 | 최소 | 권장 |
|------|------|------|
| CPU | 2코어 | 4코어+ |
| RAM | 4GB | 8GB+ |
| 디스크 | 20GB | 50GB+ |

### Docker 설치 확인
```bash
docker --version
docker compose version
```

---

## 아키텍처

```
                    ┌─────────────────────────────────────┐
                    │         Docker Compose              │
    :80 ──────────▶ │  ┌───────────────────────────────┐ │
                    │  │           Nginx                │ │
                    │  │  (리버스 프록시 + 정적 파일)   │ │
                    │  └───────────────────────────────┘ │
                    │           │              │         │
                    │    /api/* │       /* (정적)        │
                    │           ▼              │         │
                    │  ┌──────────────┐        │         │
                    │  │   Backend    │◀───────┘         │
                    │  │  (FastAPI)   │   /nifti/*       │
                    │  │    :8000     │                  │
                    │  └──────────────┘                  │
                    └──────────│──────────────────────────┘
                               │ 볼륨 마운트
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         ./dataset        ./results       ./sessions
          (5.3GB)          (SQLite)         (JSON)
           [RO]             [RW]             [RO]
```

### 서비스 구성
| 서비스 | 역할 | 포트 |
|--------|------|------|
| `frontend` | Nginx + React 정적 파일 | 80 (외부) |
| `backend` | FastAPI API 서버 | 8000 (내부) |

---

## 빠른 시작

### 1. 환경 변수 설정
```bash
# 템플릿 복사
cp .env.example .env

# SECRET_KEY 생성 및 설정
python -c "import secrets; print(secrets.token_urlsafe(32))"
# 출력된 값을 .env 파일의 SECRET_KEY에 복사
```

### 2. 서비스 시작
```bash
# 빌드 및 시작 (백그라운드)
docker compose up -d --build

# 로그 확인 (Ctrl+C로 종료)
docker compose logs -f
```

### 3. 접속 확인
```
웹 애플리케이션: http://서버IP
API 문서:       http://서버IP/api/docs
헬스 체크:      http://서버IP/health
```

---

## 상세 설정

### 환경 변수 (.env)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `HTTP_PORT` | 80 | 외부 HTTP 포트 |
| `DEBUG` | false | 디버그 모드 |
| `SECRET_KEY` | (필수) | JWT 서명 키 |
| `ALLOWED_IP_RANGES` | (없음) | 허용 IP 대역 (CIDR) |

### SECRET_KEY 생성
```bash
# Python 사용
python -c "import secrets; print(secrets.token_urlsafe(32))"

# OpenSSL 사용
openssl rand -base64 32
```

### 포트 변경
```bash
# .env 파일 수정
HTTP_PORT=8080
```

### IP 제한 설정
```bash
# .env 파일에 추가
ALLOWED_IP_RANGES=192.168.0.0/16,10.0.0.0/8
```

---

## 운영 명령어

### 서비스 관리

```bash
# 시작
docker compose up -d

# 중지
docker compose down

# 재시작
docker compose restart

# 특정 서비스만 재시작
docker compose restart backend
docker compose restart frontend
```

### 업데이트 배포

```bash
# 코드 업데이트
git pull

# 재빌드 및 재시작
docker compose up -d --build

# 특정 서비스만 재빌드
docker compose up -d --build backend
```

### 로그 확인

```bash
# 전체 로그 (실시간)
docker compose logs -f

# 특정 서비스 로그
docker compose logs -f backend
docker compose logs -f frontend

# 최근 100줄만
docker compose logs --tail=100 backend
```

### 상태 확인

```bash
# 서비스 상태
docker compose ps

# 리소스 사용량
docker stats

# 헬스 체크 상태
docker inspect --format='{{.State.Health.Status}}' readerapp-backend
docker inspect --format='{{.State.Health.Status}}' readerapp-frontend
```

---

## 모니터링

### 컨테이너 리소스
```bash
# 실시간 리소스 모니터링
docker stats

# 특정 컨테이너만
docker stats readerapp-backend readerapp-frontend
```

### 디스크 사용량
```bash
# Docker 전체 사용량
docker system df

# 상세 정보
docker system df -v
```

### 헬스 체크 URL
| 엔드포인트 | 설명 |
|------------|------|
| `/health` | 전체 시스템 상태 |
| `/api/docs` | API 문서 (Swagger) |

---

## 백업 및 복구

### 데이터베이스 백업

```bash
# SQLite 백업 (호스트에서)
cp results/reader_study.db results/backup_$(date +%Y%m%d_%H%M%S).db

# 컨테이너 내부에서 백업
docker exec readerapp-backend cp /app/results/reader_study.db /app/results/backup_$(date +%Y%m%d).db
```

### 자동 백업 스크립트

`scripts/backup.sh` 파일 생성:
```bash
#!/bin/bash
# ReaderApp 자동 백업 스크립트
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp results/reader_study.db "$BACKUP_DIR/reader_study_$DATE.db"

# 30일 이상 된 백업 삭제
find $BACKUP_DIR -name "*.db" -mtime +30 -delete

echo "백업 완료: $BACKUP_DIR/reader_study_$DATE.db"
```

### Cron 등록 (매일 자정)
```bash
crontab -e
# 추가:
0 0 * * * /path/to/ReaderApp/scripts/backup.sh >> /var/log/readerapp-backup.log 2>&1
```

### 복구
```bash
# 서비스 중지
docker compose down

# 백업 복원
cp backups/reader_study_YYYYMMDD.db results/reader_study.db

# 서비스 시작
docker compose up -d
```

---

## 트러블슈팅

### 문제: 서비스가 시작되지 않음

```bash
# 로그 확인
docker compose logs

# 컨테이너 상태 확인
docker compose ps -a

# 재빌드
docker compose down
docker compose up -d --build
```

### 문제: 포트 충돌

```bash
# 사용 중인 포트 확인
sudo lsof -i :80

# 다른 포트 사용 (.env 수정)
HTTP_PORT=8080
```

### 문제: 권한 오류 (results 디렉토리)

```bash
# 권한 수정
chmod 755 results/
chown -R 1000:1000 results/
```

### 문제: 이미지 빌드 실패

```bash
# 캐시 없이 재빌드
docker compose build --no-cache

# Docker 정리
docker system prune -a
```

### 문제: NiiVue가 로드되지 않음

- COOP/COEP 헤더 확인 (브라우저 개발자 도구 → Network → Response Headers)
- 필요한 헤더:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`

### 문제: 502 Bad Gateway

```bash
# Backend 상태 확인
docker compose logs backend

# Backend 헬스 체크
docker exec readerapp-backend curl -f http://localhost:8000/health
```

---

## 보안 설정

### 필수 보안 조치

1. **SECRET_KEY 변경**: 반드시 랜덤 값으로 변경
2. **방화벽 설정**: 필요한 포트만 개방
3. **IP 제한**: 병원/연구소 내부 IP만 허용

### 방화벽 설정 (UFW)
```bash
# HTTP 포트만 허용
sudo ufw allow 80/tcp

# 특정 IP 대역만 허용
sudo ufw allow from 192.168.0.0/16 to any port 80
```

### IP 제한 (.env)
```bash
# 병원 내부 네트워크만 허용
ALLOWED_IP_RANGES=192.168.1.0/24,10.0.0.0/8
```

---

## 파일 구조

```
ReaderApp/
├── docker-compose.yml          # 서비스 오케스트레이션
├── .env.example                # 환경 변수 템플릿
├── .env                        # 환경 변수 (git 제외)
├── .dockerignore               # Docker 빌드 제외 파일
├── docker/
│   ├── backend/
│   │   └── Dockerfile          # Backend 이미지 빌드
│   ├── frontend/
│   │   └── Dockerfile          # Frontend 이미지 빌드
│   └── nginx/
│       ├── nginx.conf          # Nginx 메인 설정
│       └── default.conf        # 사이트 설정
├── backend/                    # FastAPI 소스
├── frontend/                   # React 소스
├── dataset/                    # NIfTI 데이터 (볼륨)
├── results/                    # SQLite DB (볼륨)
├── sessions/                   # 세션 설정 (볼륨)
└── cases/                      # 테스트 케이스 (볼륨)
```

---

## 연락처

문제가 발생하면 관리자에게 문의하세요.

---

*마지막 업데이트: 2026-01-08*
