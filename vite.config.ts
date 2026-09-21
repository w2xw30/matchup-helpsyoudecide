import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Keep big third-party code in its own long-cached chunks so app updates don't re-download it.
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules.@supabase/, priority: 20 },
            { name: 'react', test: /node_modules.(react|react-dom|react-router|react-router-dom|scheduler)./, priority: 10 },
          ],
        },
      },
    },
  },
})
