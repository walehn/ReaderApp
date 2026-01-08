/**
 * ============================================================================
 * Vite Configuration - Reader Study Frontend
 * ============================================================================
 * 역할: React 개발 서버 및 빌드 설정
 *
 * 주요 기능:
 *   - React HMR (Hot Module Replacement)
 *   - API 프록시 설정 (백엔드 연동)
 *   - Tailwind CSS PostCSS 처리
 *
 * 사용법:
 *   npm run dev      # 개발 서버 (http://localhost:5173)
 *   npm run build    # 프로덕션 빌드
 *   npm run preview  # 빌드 결과 미리보기
 *
 * 프록시 설정:
 *   /api/* → http://localhost:8000/*
 * ============================================================================
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,  // Docker는 5173 사용, 개발 서버는 5174 사용
    host: true,  // 0.0.0.0 바인딩 - 원격 접속 허용 (LAN 내 다른 기기에서 접속 가능)
    // Cross-Origin Isolation 헤더 (NiiVue SharedArrayBuffer 지원용)
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      // NIfTI 파일 프록시 (CORS 문제 방지)
      '/nifti': {
        target: 'http://localhost:8001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
