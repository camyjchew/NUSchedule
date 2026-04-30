import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/timetable': 'http://localhost:5001',
      '/group': 'http://localhost:5001',
      '/health': 'http://localhost:5001'
    }
  }
})
