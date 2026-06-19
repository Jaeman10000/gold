import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// frontend/assets/ 폴더를 @assets 로 직접 참조 (단일 사본, 복제 없음). 백엔드 API 는 :8002 로 프록시.
// (assets 를 frontend 안으로 이동 — Railway 격리형 모노레포 빌드는 루트 디렉터리 밖을 못 봄)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@assets': path.resolve(__dirname, 'assets') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8002', // ← 백엔드 포트 8002
    },
  },
  // Railway preview 서버가 프록시 도메인 Host 헤더를 차단하지 않도록 허용
  preview: {
    allowedHosts: ['.railway.app'],
  },
})
