import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // relative base so the built app runs from any folder or static host
  base: './',
  plugins: [react()],
})
