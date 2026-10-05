<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Activity, Bell, CandlestickChart, ChevronDown, ChevronLeft, ChevronRight, Command, Expand, LineChart, ListFilter, LogOut, Menu, MoreHorizontal, Plus, Search, Settings2, Star, Sun, TrendingUp, X } from '@lucide/vue'
import { io, type Socket } from 'socket.io-client'
import { watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import MarketChart from '../components/MarketChart.vue'
import TradingPanel from '../components/TradingPanel.vue'
import WatchlistPanel from '../components/WatchlistPanel.vue'
import { createDemoCandles, formatCompact, formatPrice } from '../lib/market'
import type { Candle, ChartType, Timeframe } from '../types/market'

const symbols = ref([
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', price: 142.87, change: 2.41, volume: '38.2M' },
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', price: 248.50, change: 0.74, volume: '21.6M' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', price: 512.16, change: -0.32, volume: '12.3M' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ', price: 327.63, change: 1.86, volume: '54.1M' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', price: 231.44, change: -1.08, volume: '17.8M' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', price: 184.03, change: 0.55, volume: '9.4M' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ', price: 736.21, change: 1.23, volume: '6.7M' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ', price: 736.21, change: 1.23, volume: '6.7M' },
])
const activeSymbol = ref('NVDA')
const activeTimeframe = ref<Timeframe>('1D')
const chartType = ref<ChartType>('Candles')
const candles = ref<Candle[]>(createDemoCandles(180, 142.87))
const selectedTab = ref<'positions' | 'orders' | 'history'>('positions')
const isSearchOpen = ref(false)
const isAuthOpen = ref(false)
const authMode = ref<'login' | 'register'>('login')
const authEmail = ref('')
const authPassword = ref('')
const authBusy = ref(false)
const auth = useAuthStore()
const searchQuery = ref('')
const isAlertOpen = ref(false)
const isMobileMenuOpen = ref(false)
const isFullscreen = ref(false)
const lightTheme = ref(false)
const enabledIndicators = ref<string[]>(['Volume', 'EMA 20'])
const alertPrice = ref('')
const alertDirection = ref('Above')
const alerts = ref<{ symbol: string; direction: string; price: number }[]>([])
const paperAccount = ref({ cashBalance: '100000.0000', equity: '100000.0000', realizedPnl: '0.0000', unrealizedPnl: '0.0000' })
const toast = ref('')
const price = computed(() => candles.value.at(-1)?.close ?? 0)
const previousClose = computed(() => candles.value[0]?.open ?? price.value)
const change = computed(() => ((price.value - previousClose.value) / previousClose.value) * 100)
const activeInfo = computed(() => symbols.value.find((item) => item.symbol === activeSymbol.value) ?? symbols.value[0]!)
const filteredSymbols = computed(() => symbols.value.filter((item) => `${item.symbol} ${item.name}`.toLowerCase().includes(searchQuery.value.toLowerCase())))
let streamTimer: number | undefined
let toastTimer: number | undefined
let marketSocket: Socket | undefined

function notify(message: string) {
  toast.value = message
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 2800)
}
function chooseSymbol(symbol: string) {
  const item = symbols.value.find((entry) => entry.symbol === symbol)
  if (!item) return
  activeSymbol.value = symbol
  candles.value = createDemoCandles(180, item.price, activeTimeframe.value)
  void loadHistory(symbol, activeTimeframe.value)
  isSearchOpen.value = false
  isMobileMenuOpen.value = false
  searchQuery.value = ''
}
async function loadHistory(symbol: string, timeframe: Timeframe) {
  try {
    const response = await fetch(`/api/markets/symbols/${encodeURIComponent(symbol)}/candles?timeframe=${encodeURIComponent(timeframe)}&limit=180`)
    if (!response.ok) return
    const result = await response.json() as Array<Omit<Candle, 'time'> & { time: number }>
    if (symbol === activeSymbol.value && timeframe === activeTimeframe.value && result.length) {
      candles.value = result.map((item) => ({ ...item, time: item.time as Candle['time'] }))
    }
  } catch { /* Keep the labeled demo chart when the API is offline. */ }
}
function connectMarket() {
  if (!auth.accessToken || marketSocket) return
  marketSocket = io('/market', { auth: (callback) => callback({ accessToken: auth.accessToken }), reconnection: true, reconnectionAttempts: 8 })
  marketSocket.on('connect', () => marketSocket?.emit('market.subscribe', { symbol: activeSymbol.value }))
  marketSocket.on('market.tick', (event: { symbol: string; time: number; open: number; high: number; low: number; close: number; volume: number }) => {
    if (event.symbol !== activeSymbol.value || ![event.time, event.open, event.high, event.low, event.close, event.volume].every(Number.isFinite)) return
    const candle = { ...event, time: event.time as Candle['time'] }
    const last = candles.value.at(-1)
    if (last && last.time === candle.time) candles.value = [...candles.value.slice(0, -1), { ...last, high: Math.max(last.high, candle.high), low: Math.min(last.low, candle.low), close: candle.close, volume: candle.volume }]
    else candles.value = [...candles.value.slice(-179), candle]
  })
}
async function submitAuth() {
  authBusy.value = true
  try {
    await auth.authenticate(authMode.value, authEmail.value, authPassword.value)
    isAuthOpen.value = false
    authPassword.value = ''
    connectMarket()
    notify(authMode.value === 'login' ? 'Signed in' : 'Paper account created')
  } catch (error) { notify(error instanceof Error ? error.message : 'Authentication failed') }
  finally { authBusy.value = false }
}
async function signOut() {
  marketSocket?.disconnect()
  marketSocket = undefined
  await auth.logout()
  notify('Signed out')
}
function setTimeframe(timeframe: Timeframe) {
  activeTimeframe.value = timeframe
  candles.value = createDemoCandles(180, price.value, timeframe)
}
function toggleIndicator(name: string) {
  enabledIndicators.value = enabledIndicators.value.includes(name) ? enabledIndicators.value.filter((item) => item !== name) : [...enabledIndicators.value, name]
}
async function addAlert() {
  const threshold = Number(alertPrice.value)
  if (!Number.isFinite(threshold) || threshold <= 0) return notify('Enter a valid alert price')
  if (auth.isAuthenticated) {
    const condition = ({ Above: 'PRICE_GT', Below: 'PRICE_LT', 'Crosses above': 'CROSSES_ABOVE', 'Crosses below': 'CROSSES_BELOW' } as const)[alertDirection.value as 'Above' | 'Below' | 'Crosses above' | 'Crosses below']
    try {
      const response = await auth.request('/api/alerts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbol: activeSymbol.value, condition, threshold }) })
      if (!response.ok) throw new Error('Alert could not be saved')
    } catch { notify('Alert API unavailable. Alert was not saved.'); return }
  }
  alerts.value.unshift({ symbol: activeSymbol.value, direction: alertDirection.value, price: threshold })
  alertPrice.value = ''
  isAlertOpen.value = false
  notify(auth.isAuthenticated ? `Alert saved for ${activeSymbol.value}` : `Demo alert saved locally for ${activeSymbol.value}`)
}
async function loadAlerts() {
  if (!auth.isAuthenticated) return
  const response = await auth.request('/api/alerts').catch(() => undefined)
  if (!response?.ok) return
  const records = await response.json() as Array<{ symbol: string; condition: string; threshold: string; active: boolean }>
  const labels: Record<string, string> = { PRICE_GT: 'Above', PRICE_LT: 'Below', PRICE_GTE: 'Above or equal', PRICE_LTE: 'Below or equal', CROSSES_ABOVE: 'Crosses above', CROSSES_BELOW: 'Crosses below', VOLUME_GT: 'Volume above' }
  alerts.value = records.filter((alert) => alert.active).map((alert) => ({ symbol: alert.symbol, direction: labels[alert.condition] ?? alert.condition, price: Number(alert.threshold) }))
}
function toggleFullscreen() {
  if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.()
  else void document.exitFullscreen?.()
  isFullscreen.value = !isFullscreen.value
}
function toggleTheme() {
  lightTheme.value = !lightTheme.value
  document.documentElement.classList.toggle('light-theme', lightTheme.value)
  localStorage.setItem('marketdesk.theme', lightTheme.value ? 'light' : 'dark')
}
function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); isSearchOpen.value = true }
  if (event.key === 'Escape') { isSearchOpen.value = false; isAlertOpen.value = false }
}
onMounted(async () => {
  await auth.restore()
  await loadAlerts()
  connectMarket()
  void loadHistory(activeSymbol.value, activeTimeframe.value)
  try {
    const response = await fetch('/api/markets/symbols')
    if (response.ok) {
      const result = await response.json() as Array<{ symbol: string; name: string; exchange: string; price: number; changePercent: number; volume: number }>
      if (result.length) symbols.value = result.map((item) => ({ ...item, change: item.changePercent, volume: formatCompact(item.volume) }))
    }
  } catch { /* Keep the local demonstration catalog when the API is offline. */ }
  lightTheme.value = localStorage.getItem('marketdesk.theme') === 'light'
  document.documentElement.classList.toggle('light-theme', lightTheme.value)
  window.addEventListener('keydown', onKeydown)
  streamTimer = window.setInterval(() => {
    if (marketSocket?.connected) return
    const prior = candles.value.at(-1)
    if (!prior) return
    const close = Math.max(1, prior.close + (Math.random() - 0.48) * prior.close * 0.0017)
    candles.value = [...candles.value.slice(0, -1), { ...prior, high: Math.max(prior.high, close), low: Math.min(prior.low, close), close, volume: prior.volume + Math.round(Math.random() * 7000) }]
  }, 2400)
})
watch(activeSymbol, (next, previous) => {
  if (marketSocket?.connected) { marketSocket.emit('market.unsubscribe', { symbol: previous }); marketSocket.emit('market.subscribe', { symbol: next }) }
})
watch(() => auth.accessToken, (token) => { if (token) { connectMarket(); void loadAlerts() } })
onUnmounted(() => { window.removeEventListener('keydown', onKeydown); window.clearInterval(streamTimer); window.clearTimeout(toastTimer); marketSocket?.disconnect() })
</script>

<template>
  <main class="terminal-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Market Desk"><span class="brand-mark"><Activity :size="17" /></span><span class="brand-name">market<span>desk</span></span><span class="brand-version">PAPER</span></a>
      <i class="topbar-divider"></i>
      <button class="symbol-picker" aria-label="Search symbol" @click="isSearchOpen = true"><b>{{ activeSymbol }}</b><span>{{ activeInfo.name }}</span><ChevronDown :size="14" /><kbd><Command :size="10" /> K</kbd></button>
      <span class="grow"></span><span class="market-state"><i></i> DEMO FEED <small>SIMULATED</small></span>
      <button class="icon-button" aria-label="Create alert" title="Create alert" @click="isAlertOpen = true"><Bell :size="17" /><b v-if="alerts.length" class="alert-count">{{ alerts.length }}</b></button>
      <button class="icon-button top-settings" aria-label="Workspace settings" @click="notify('Workspace settings are not connected yet')"><Settings2 :size="17" /></button>
      <button class="profile-button" :aria-label="auth.user ? 'Sign out' : 'Sign in'" @click="auth.user ? signOut() : isAuthOpen = true"><span>{{ auth.user?.email.slice(0, 2).toUpperCase() ?? 'IN' }}</span><small>{{ auth.user?.email ?? 'Sign in' }}</small><LogOut v-if="auth.user" :size="13" /></button>
      <button class="icon-button mobile-menu" aria-label="Open watchlist" @click="isMobileMenuOpen = !isMobileMenuOpen"><Menu :size="18" /></button>
    </header>

    <div class="workspace">
      <aside class="watchlist-column" :class="{ 'mobile-open': isMobileMenuOpen }"><WatchlistPanel :symbols="symbols" :active-symbol="activeSymbol" @select="chooseSymbol" @close="isMobileMenuOpen = false" @notify="notify" /></aside>
      <section class="main-column">
        <section class="instrument-strip">
          <div class="instrument-heading"><div class="instrument-ident"><span class="instrument-logo">{{ activeSymbol.slice(0, 1) }}</span><span><b>{{ activeSymbol }}</b><small>{{ activeInfo.exchange }} · USD</small></span></div><div class="instrument-quote"><b>{{ formatPrice(price) }}</b><small :class="change >= 0 ? 'positive' : 'negative'">{{ change >= 0 ? '+' : '' }}{{ change.toFixed(2) }}%</small></div></div>
          <div class="quote-stats"><span>O <b>{{ formatPrice(candles.at(-1)?.open ?? 0) }}</b></span><span>H <b>{{ formatPrice(candles.at(-1)?.high ?? 0) }}</b></span><span>L <b>{{ formatPrice(candles.at(-1)?.low ?? 0) }}</b></span><span>C <b>{{ formatPrice(price) }}</b></span><span>Vol <b>{{ formatCompact(candles.at(-1)?.volume ?? 0) }}</b></span></div>
          <button class="star-button" aria-label="Add to favorites" @click="notify(`${activeSymbol} is in your watchlist`)"><Star :size="17" /></button>
        </section>
        <section class="chart-workspace">
          <div class="chart-toolbar">
            <div class="timeframe-select" aria-label="Chart timeframe"><button v-for="tf in ['1m','5m','15m','30m','1h','4h','1D','1W','1M'] as Timeframe[]" :key="tf" :class="{ active: activeTimeframe === tf }" @click="setTimeframe(tf)">{{ tf }}</button></div><i class="toolbar-rule"></i>
            <button class="toolbar-button" title="Cycle chart type" @click="chartType = chartType === 'Candles' ? 'Line' : chartType === 'Line' ? 'Area' : chartType === 'Area' ? 'Bar' : 'Candles'"><CandlestickChart v-if="chartType === 'Candles' || chartType === 'Bar'" :size="16" /><LineChart v-else :size="16" /><span>{{ chartType }}</span><ChevronDown :size="12" /></button><i class="toolbar-rule"></i>
            <div class="indicator-menu"><button class="toolbar-button"><Activity :size="15" /><span>Indicators</span><ChevronDown :size="12" /></button><div class="indicator-list"><button v-for="name in ['SMA 50','EMA 20','RSI 14','MACD','Bollinger Bands','VWAP','Volume']" :key="name" :class="{ selected: enabledIndicators.includes(name) }" @click="toggleIndicator(name)">{{ name }}<b>{{ enabledIndicators.includes(name) ? '✓' : '' }}</b></button></div></div>
            <span class="grow"></span><span class="live-indicator"><i></i> DEMO</span><button class="toolbar-icon" aria-label="Chart settings" @click="notify('Chart settings are not connected yet')"><Settings2 :size="16" /></button><button class="toolbar-icon" aria-label="Fullscreen" @click="toggleFullscreen"><Expand :size="15" /></button>
          </div>
          <div class="chart-caption"><b>{{ activeSymbol }} · {{ activeTimeframe }}</b><span>O {{ formatPrice(candles.at(-1)?.open ?? 0) }} <i>H {{ formatPrice(candles.at(-1)?.high ?? 0) }}</i> <em>L {{ formatPrice(candles.at(-1)?.low ?? 0) }}</em> C {{ formatPrice(price) }}</span></div>
          <MarketChart :candles="candles" :chart-type="chartType" :symbol="activeSymbol" :indicators="enabledIndicators" />
          <div class="chart-footer"><div class="range-shortcuts"><button v-for="range in ['1D','5D','1M','3M','6M','YTD','1Y','ALL']" :key="range">{{ range }}</button></div><span class="chart-time">◷ {{ new Date().toLocaleDateString('en-US', { month:'short', day:'2-digit', year:'numeric' }) }} <ChevronLeft :size="12" /><ChevronRight :size="12" /></span></div>
        </section>
        <section class="trade-section"><div class="trade-tabs" role="tablist" aria-label="Portfolio views"><button :class="{ active: selectedTab === 'positions' }" role="tab" @click="selectedTab = 'positions'">Positions</button><button :class="{ active: selectedTab === 'orders' }" role="tab" @click="selectedTab = 'orders'">Open orders</button><button :class="{ active: selectedTab === 'history' }" role="tab" @click="selectedTab = 'history'">Order history</button><span class="grow"></span><span class="buying-power">Paper cash <b>{{ formatPrice(Number(paperAccount.cashBalance)) }}</b></span><button class="toolbar-icon" aria-label="More trade actions"><MoreHorizontal :size="17" /></button></div><TradingPanel :symbol="activeSymbol" :price="price" :selected-tab="selectedTab" @notify="notify" @account="paperAccount = $event" /></section>
      </section>
      <aside class="details-column">
        <div class="details-header"><div><span class="eyebrow">MARKET SNAPSHOT</span><h2>{{ activeSymbol }} overview</h2></div><button class="toolbar-icon" aria-label="More symbol details"><MoreHorizontal :size="17" /></button></div>
        <div class="detail-price"><b>{{ formatPrice(price) }}</b><span :class="change >= 0 ? 'positive' : 'negative'">{{ change >= 0 ? '+' : '' }}{{ change.toFixed(2) }}%</span><small>USD</small></div>
        <div class="detail-chart"><div class="sparkline-bg"><span>250</span><span>200</span><span>150</span><span>100</span></div><svg viewBox="0 0 280 100" preserveAspectRatio="none" aria-label="Indicative trend"><path class="spark-fill" d="M0 78 C13 73 16 79 28 67 S47 73 58 55 S76 60 85 50 S99 58 110 44 S127 51 139 36 S153 42 165 33 S181 43 192 26 S210 35 221 20 S238 26 247 17 S265 22 280 8 V100 H0Z"/><path class="spark-line" d="M0 78 C13 73 16 79 28 67 S47 73 58 55 S76 60 85 50 S99 58 110 44 S127 51 139 36 S153 42 165 33 S181 43 192 26 S210 35 221 20 S238 26 247 17 S265 22 280 8" /></svg><div class="spark-dates"><span>09:30</span><span>12:00</span><span>16:00</span></div></div>
        <div class="range-pills"><button class="active">1D</button><button>1W</button><button>1M</button><button>3M</button><button>1Y</button><button>ALL</button></div>
        <div class="details-separator"></div><div class="section-heading"><h3>Key statistics</h3><button class="toolbar-icon" aria-label="Statistics options"><ListFilter :size="15" /></button></div>
        <dl class="stats-list"><div><dt>Previous close</dt><dd>{{ formatPrice(previousClose) }}</dd></div><div><dt>Day range</dt><dd>{{ formatPrice(Math.min(...candles.slice(-30).map(item => item.low))) }} – {{ formatPrice(Math.max(...candles.slice(-30).map(item => item.high))) }}</dd></div><div><dt>52-week range</dt><dd>$86.62 – $153.13</dd></div><div><dt>Volume</dt><dd>{{ formatCompact(candles.at(-1)?.volume ?? 0) }}</dd></div><div><dt>Avg. volume</dt><dd>{{ activeInfo.volume }}</dd></div><div><dt>Price source</dt><dd>Simulated</dd></div></dl>
        <div class="details-separator"></div><div class="section-heading"><h3>Price alerts</h3><button class="add-alert-link" @click="isAlertOpen = true"><Plus :size="13" /> Add</button></div>
        <div v-if="alerts.length" class="alert-items"><div v-for="(alert,index) in alerts.slice(0,3)" :key="index" class="alert-item"><i></i><span>{{ alert.symbol }} {{ alert.direction.toLowerCase() }} {{ formatPrice(alert.price) }}</span><button :aria-label="`Remove ${alert.symbol} alert`" @click="alerts.splice(index,1)"><X :size="13" /></button></div></div><div v-else class="empty-alerts"><Bell :size="15" /> No active alerts</div>
        <div class="details-separator"></div><div class="news-heading"><div class="section-heading"><h3>Market pulse</h3><TrendingUp :size="15" /></div><p>Market news feed is not connected</p><span>DEMO WORKSPACE</span></div>
        <button class="sun-button" @click="toggleTheme"><Sun :size="15" /> {{ lightTheme ? 'Dark appearance' : 'Light appearance' }}</button>
      </aside>
    </div>
    <footer class="statusbar"><span><i></i> Simulated data</span><span>Paper mode · no broker connection</span><span class="grow"></span><span>USD</span><span>Market data is illustrative</span></footer>
    <div v-if="isSearchOpen" class="modal-backdrop" @click.self="isSearchOpen = false"><section class="search-modal" role="dialog" aria-modal="true" aria-label="Search markets"><div class="modal-search"><Search :size="17" /><input v-model="searchQuery" autofocus placeholder="Search symbols, companies or markets" @keydown.enter="filteredSymbols[0] && chooseSymbol(filteredSymbols[0].symbol)" /><kbd>ESC</kbd><button aria-label="Close search" @click="isSearchOpen = false"><X :size="16" /></button></div><div class="search-section-label">DEMO US EQUITIES</div><button v-for="item in filteredSymbols" :key="item.symbol" class="search-result" @click="chooseSymbol(item.symbol)"><span class="result-ticker">{{ item.symbol.slice(0,1) }}</span><span class="result-symbol"><b>{{ item.symbol }}</b><small>{{ item.name }}</small></span><span class="result-exchange">{{ item.exchange }}</span><span :class="item.change >= 0 ? 'positive' : 'negative'">{{ item.change >= 0 ? '+' : '' }}{{ item.change.toFixed(2) }}%</span></button><p v-if="!filteredSymbols.length" class="search-empty">No markets found</p></section></div>
    <div v-if="isAlertOpen" class="modal-backdrop" @click.self="isAlertOpen = false"><form class="alert-modal" @submit.prevent="addAlert"><div class="modal-heading"><div><span class="eyebrow">LOCAL PRICE NOTIFICATION</span><h2>Create alert</h2></div><button type="button" class="toolbar-icon" aria-label="Close dialog" @click="isAlertOpen = false"><X :size="17" /></button></div><label class="form-label">Symbol<input :value="activeSymbol" readonly /></label><label class="form-label">Condition<select v-model="alertDirection"><option>Above</option><option>Below</option><option>Crosses above</option><option>Crosses below</option></select></label><label class="form-label">Price (USD)<input v-model="alertPrice" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label><div class="modal-actions"><button type="button" class="button-muted" @click="isAlertOpen = false">Cancel</button><button class="button-primary" type="submit"><Bell :size="14" /> Save alert</button></div></form></div>
    <div v-if="isAuthOpen" class="modal-backdrop" @click.self="isAuthOpen = false"><form class="alert-modal" @submit.prevent="submitAuth"><div class="modal-heading"><div><span class="eyebrow">PAPER TRADING ACCOUNT</span><h2>{{ authMode === 'login' ? 'Sign in' : 'Create account' }}</h2></div><button type="button" class="toolbar-icon" aria-label="Close dialog" @click="isAuthOpen = false"><X :size="17" /></button></div><label class="form-label">Email<input v-model="authEmail" type="email" autocomplete="email" required maxlength="320" placeholder="you@example.com" /></label><label class="form-label">Password<input v-model="authPassword" type="password" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" minlength="8" maxlength="72" required placeholder="At least 8 characters" /></label><div class="auth-switch">{{ authMode === 'login' ? 'New to Market Desk?' : 'Already have an account?' }} <button type="button" @click="authMode = authMode === 'login' ? 'register' : 'login'">{{ authMode === 'login' ? 'Create account' : 'Sign in' }}</button></div><div class="modal-actions"><button class="button-primary" type="submit" :disabled="authBusy">{{ authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Register' }}</button></div></form></div>
    <Transition name="toast"><div v-if="toast" class="toast-message"><i></i>{{ toast }}</div></Transition>
  </main>
</template>
