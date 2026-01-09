# ============================================================================
# ReaderApp Frontend Dockerfile (Multi-stage Build)
# ============================================================================
# 역할: React 프론트엔드 빌드 및 Nginx 정적 파일 서빙
#
# 빌드 옵션:
#   docker build -f docker/frontend/Dockerfile -t readerapp-frontend .
#
# 특징:
#   - Multi-stage 빌드로 최종 이미지 크기 최소화
#   - Stage 1: Node.js에서 React 앱 빌드
#   - Stage 2: Nginx Alpine으로 정적 파일 서빙
#   - NiiVue SharedArrayBuffer 지원을 위한 COOP/COEP 헤더 설정
#
# 최종 이미지 크기: ~50MB (빌드 도구 제외)
# ============================================================================

# =============================================================================
# Stage 1: Build - React 앱 빌드
# =============================================================================
FROM node:20-alpine AS builder

# 메타데이터
LABEL stage="builder"

# 작업 디렉토리
WORKDIR /app

# package.json과 lock 파일만 먼저 복사 (의존성 캐시 활용)
COPY frontend/package*.json ./

# 의존성 설치 (devDependencies 포함 - 빌드에 필요)
RUN npm ci

# 소스 코드 복사
COPY frontend/ .

# 프로덕션 빌드
RUN npm run build

# =============================================================================
# Stage 2: Production - Nginx로 정적 파일 서빙
# =============================================================================
FROM nginx:alpine

# 메타데이터
LABEL maintainer="ReaderApp Team"
LABEL description="ReaderApp Frontend - React Medical Imaging Viewer"
LABEL version="1.0"

# 기본 nginx 설정 제거
RUN rm /etc/nginx/conf.d/default.conf

# 커스텀 Nginx 설정 복사
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# 빌드된 정적 파일 복사 (Stage 1에서)
COPY --from=builder /app/dist /usr/share/nginx/html

# 권한 설정
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    # Nginx PID 파일 디렉토리 권한
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# 포트 노출
EXPOSE 80

# 헬스 체크
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget -q --spider http://localhost/health || exit 1

# Nginx 실행 (foreground)
CMD ["nginx", "-g", "daemon off;"]
