import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/jira/', // 예: '/jira/'
  server: {
    proxy: {
      '/api/jira': {
        target: 'http://jira.duzon.com:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/jira/, ''),
      },
    },
  },
})
