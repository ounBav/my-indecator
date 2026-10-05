import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

type User = { id: string; email: string }
type SessionResponse = { accessToken: string; user: User }

const accessTokenKey = 'marketdesk.access-token'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref(sessionStorage.getItem(accessTokenKey) ?? '')
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => Boolean(accessToken.value && user.value))

  function setSession(session: SessionResponse) {
    accessToken.value = session.accessToken
    user.value = session.user
    sessionStorage.setItem(accessTokenKey, session.accessToken)
  }

  async function refresh(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      if (!response.ok) return false
      setSession(await response.json() as SessionResponse)
      return true
    } catch { return false }
  }

  async function restore() {
    if (accessToken.value) {
      const response = await request('/api/auth/me')
      if (response.ok) { user.value = await response.json() as User; return }
      accessToken.value = ''
      sessionStorage.removeItem(accessTokenKey)
    }
    if (await refresh()) {
      const response = await request('/api/auth/me')
      if (response.ok) user.value = await response.json() as User
    }
  }

  async function authenticate(action: 'login' | 'register', email: string, password: string) {
    const response = await fetch(`/api/auth/${action}`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const result = await response.json() as SessionResponse & { message?: string }
    if (!response.ok) throw new Error(result.message ?? 'Authentication failed')
    setSession(result)
  }

  async function request(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const send = () => fetch(input, {
      ...init,
      credentials: 'include',
      headers: { ...Object.fromEntries(new Headers(init.headers).entries()), ...(accessToken.value ? { authorization: `Bearer ${accessToken.value}` } : {}) },
    })
    let response = await send()
    if (response.status === 401 && !String(input).includes('/api/auth/')) {
      if (await refresh()) response = await send()
    }
    return response
  }

  async function logout() {
    if (accessToken.value) await request('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    accessToken.value = ''
    user.value = null
    sessionStorage.removeItem(accessTokenKey)
  }

  return { accessToken, user, isAuthenticated, authenticate, refresh, request, restore, logout }
})
