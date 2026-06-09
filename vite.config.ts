import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The frontend calls the backend at /api/*. In dev, proxy those to the local
// Express server (default :8787) so there is no CORS friction and the same
// relative URLs work in production behind a single origin.
const API_PORT = process.env.API_PORT ?? '8787'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
})
