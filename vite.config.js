import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'fab0-2800-484-a485-7400-8cbd-81aa-bdf2-1284.ngrok-free.app' // 👈 Añade tu host ngrok
    ]
  }
})
