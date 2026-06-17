import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 루트 assets/ 폴더를 @assets 로 직접 참조 (복제 없음). 백엔드 API 는 :8002 로 프록시.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@assets': path.resolve(__dirname, '../assets') },
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] }, // 프론트 밖(../assets) 파일 import 허용
    proxy: {
      '/api': 'http://localhost:8002', // ← 백엔드 포트 8002
    },
  },
})
