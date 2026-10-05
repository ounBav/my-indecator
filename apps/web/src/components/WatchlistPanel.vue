<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, ChevronDown, MoreHorizontal, Plus, Search, Star, X } from '@lucide/vue'
import { formatPrice } from '../lib/market'
import { useAuthStore } from '../stores/auth'

type MarketSymbol = { symbol: string; name: string; exchange: string; price: number; change: number; volume: string }
const props = defineProps<{ symbols: MarketSymbol[]; activeSymbol: string }>()
const emit = defineEmits<{ select: [symbol: string]; close: []; notify: [message: string] }>()
const auth = useAuthStore()
const selectedList = ref('Main watchlist')
const query = ref('')
const adding = ref(false)
const watchlist = ref<string[]>(JSON.parse(localStorage.getItem('marketdesk.demo.watchlist') ?? 'null') ?? ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'META'])
const available = computed(() => props.symbols.filter((item) => !watchlist.value.includes(item.symbol)))
const visibleSymbols = computed(() => watchlist.value
  .map((symbol) => props.symbols.find((item) => item.symbol === symbol))
  .filter((item): item is MarketSymbol => Boolean(item))
  .filter((item) => `${item.symbol} ${item.name}`.toLowerCase().includes(query.value.toLowerCase())))

watch(watchlist, (value) => localStorage.setItem('marketdesk.demo.watchlist', JSON.stringify(value)), { deep: true })

const listId = ref('')
async function loadServerList() {
  if (!auth.isAuthenticated) return
  try {
    const response = await auth.request('/api/watchlists')
    if (!response.ok) return
    let lists = await response.json() as Array<{ id: string; name: string; items: Array<{ symbol: { symbol: string } }> }>
    if (!lists.length) {
      const created = await auth.request('/api/watchlists', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Main watchlist' }) })
      if (!created.ok) return
      const list = await created.json() as { id: string; name: string; items: [] }
      lists = [list]
    }
    const active = lists[0]!
    listId.value = active.id
    selectedList.value = active.name
    if (active.items.length) watchlist.value = active.items.map((item) => item.symbol.symbol)
    else {
      for (const symbol of [...watchlist.value]) {
        const added = await auth.request(`/api/watchlists/${active.id}/symbols`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbol }) })
        if (!added.ok) continue
      }
    }
  } catch { emit('notify', 'Watchlist service unavailable; using the local demo list') }
}

onMounted(() => { void loadServerList() })
watch(() => auth.isAuthenticated, (authenticated) => { if (authenticated) void loadServerList(); else listId.value = '' })

function addSymbol(symbol: string) {
  watchlist.value.push(symbol)
  if (listId.value) void auth.request(`/api/watchlists/${listId.value}/symbols`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbol }) }).then((response) => { if (!response.ok) emit('notify', 'Symbol could not be saved to your watchlist') })
  adding.value = false
}

function moveSymbol(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= watchlist.value.length) return
  const items = [...watchlist.value]
  ;[items[index], items[target]] = [items[target]!, items[index]!]
  watchlist.value = items
  if (listId.value) void auth.request(`/api/watchlists/${listId.value}/symbols/${encodeURIComponent(watchlist.value[target]!)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ position: target }) }).then((response) => { if (!response.ok) emit('notify', 'Watchlist order could not be saved') })
}

function removeSymbol(symbol: string) {
  watchlist.value = watchlist.value.filter((item) => item !== symbol)
  if (listId.value) void auth.request(`/api/watchlists/${listId.value}/symbols/${encodeURIComponent(symbol)}`, { method: 'DELETE' }).then((response) => { if (!response.ok) emit('notify', 'Symbol could not be removed from your watchlist') })
}
</script>

<template>
  <section class="watchlist-panel">
    <div class="watchlist-heading"><div><span class="eyebrow">YOUR MARKETS</span><button class="watchlist-name" @click="selectedList = selectedList === 'Main watchlist' ? 'Tech leaders' : 'Main watchlist'">{{ selectedList }} <ChevronDown :size="13" /></button></div><div class="watchlist-actions"><button class="toolbar-icon" aria-label="Add symbol" title="Add symbol" @click="adding = !adding"><Plus :size="16" /></button><button class="toolbar-icon watch-close" aria-label="Close watchlist" @click="emit('close')"><X :size="16" /></button><button class="toolbar-icon watch-more" aria-label="Watchlist actions" title="Watchlist actions"><MoreHorizontal :size="16" /></button></div></div>
    <div class="watchlist-tools"><label class="watch-search"><Search :size="14" /><input v-model="query" placeholder="Find symbol" aria-label="Filter watchlist" /></label><button class="watchlist-filter" aria-label="Sort watchlist" title="Sort and filter"><Star :size="14" /></button></div>
    <div class="watchlist-columns"><span>SYMBOL</span><span>LAST</span><span>CHG %</span></div>
    <div v-if="adding" class="add-symbol-menu"><button v-for="item in available" :key="item.symbol" @click="addSymbol(item.symbol)"><span>{{ item.symbol }}</span><small>{{ item.name }}</small><Plus :size="13" /></button><p v-if="!available.length">All demo symbols are on this list</p></div>
    <div v-if="visibleSymbols.length" class="watchlist-rows">
      <div v-for="(item, index) in visibleSymbols" :key="item.symbol" class="watch-row" :class="{ active: activeSymbol === item.symbol }" @click="emit('select', item.symbol)">
        <span class="watch-company-mark" :class="`mark-${item.symbol.toLowerCase()}`">{{ item.symbol.slice(0, 1) }}</span>
        <span class="watch-symbol"><b>{{ item.symbol }}</b><small>{{ item.exchange }}</small></span>
        <span class="watch-last">{{ formatPrice(item.price) }}</span>
        <span class="watch-change" :class="item.change >= 0 ? 'positive' : 'negative'">{{ item.change >= 0 ? '+' : '' }}{{ item.change.toFixed(2) }}%</span>
        <span class="watch-hover-actions"><button :aria-label="`Move ${item.symbol} up`" @click.stop="moveSymbol(index, -1)"><ArrowUp :size="12" /></button><button :aria-label="`Move ${item.symbol} down`" @click.stop="moveSymbol(index, 1)"><ArrowDown :size="12" /></button><button :aria-label="`Remove ${item.symbol}`" @click.stop="removeSymbol(item.symbol)"><X :size="12" /></button></span>
      </div>
    </div>
    <div v-else class="watchlist-empty"><Search :size="16" /><span>No symbols match</span></div>
    <div class="watchlist-footer"><span><span class="live-dot"></span> US market</span><span>Delayed data</span></div>
  </section>
</template>