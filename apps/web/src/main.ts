import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import './style.css'
import './market.css'
import App from './App.vue'
import { router } from './router'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } })
createApp(App).use(createPinia()).use(VueQueryPlugin, { queryClient }).use(router).mount('#app')
