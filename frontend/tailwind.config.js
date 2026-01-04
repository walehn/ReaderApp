/**
 * ============================================================================
 * Tailwind CSS Configuration - Reader Study Frontend
 * ============================================================================
 * 역할: Tailwind CSS 설정 및 커스터마이징
 *
 * 커스텀 색상:
 *   - primary: 주요 액션 버튼 색상
 *   - medical: 의료 영상 뷰어용 다크 테마
 *
 * 사용법:
 *   className="bg-medical-dark text-primary-500"
 * ============================================================================
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        medical: {
          dark: '#1a1a2e',
          darker: '#0f0f1a',
          accent: '#4a9eff',
        }
      }
    },
  },
  plugins: [],
}
