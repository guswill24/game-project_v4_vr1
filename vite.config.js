import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@react-three/xr': '@react-three/xr/dist/index.js'
    }
  }
})
