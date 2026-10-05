import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/graphql': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'ws://localhost:3000', ws: true },
    },
  },
})
