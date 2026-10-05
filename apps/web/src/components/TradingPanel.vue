<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowDownRight, ArrowUpRight, LoaderCircle } from '@lucide/vue'
import { formatPrice } from '../lib/market'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{ symbol: string; price: number; selectedTab: 'positions' | 'orders' | 'history' }>()
const emit = defineEmits<{ notify: [message: string]; account: [account: { cashBalance: string; equity: string; realizedPnl: string; unrealizedPnl: string }] }>()
const auth = useAuthStore()
const side = ref<'BUY' | 'SELL'>('BUY')
const orderType = ref<'MARKET' | 'LIMIT'>('MARKET')
const quantity = ref('10')
const limitPrice = ref('')
const submitting = ref(false)
const loading = ref(false)
const loadError = ref('')
const rows = ref<Array<Record<string, string | number | Date>>>([])
const estimatedValue = computed(() => Number(quantity.value || 0) * props.price)

async function refreshData() {
  if (!auth.isAuthenticated) { rows.value = []; return }
  loading.value = true
  loadError.value = ''
  try {
    const accountResponse = await auth.request('/api/paper/account')
    if (!accountResponse.ok) throw new Error('Paper account unavailable')
    const account = await accountResponse.json() as { cashBalance: string; equity: string; realizedPnl: string; unrealizedPnl: string }
    emit('account', account)
    const endpoint = props.selectedTab === 'positions' ? '/api/paper/positions' : props.selectedTab === 'orders' ? '/api/paper/orders?status=OPEN' : '/api/paper/orders'
    const response = await auth.request(endpoint)
    if (!response.ok) throw new Error('Portfolio data unavailable')
    rows.value = await response.json() as Array<Record<string, string | number | Date>>
  } catch (error) { loadError.value = error instanceof Error ? error.message : 'Portfolio data unavailable' }
  finally { loading.value = false }
}

async function cancelOrder(id: string) {
  const response = await auth.request(`/api/paper/orders/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok) { emit('notify', 'Order could not be cancelled'); return }
  emit('notify', 'Limit order cancelled')
  await refreshData()
}

async function submitOrder() {
  if (!auth.isAuthenticated) {
    emit('notify', 'Sign in to submit a paper order')
    return
  }
  const shares = Number(quantity.value)
  if (!Number.isFinite(shares) || shares <= 0) {
    emit('notify', 'Enter a quantity greater than zero')
    return
  }
  const priceLimit = Number(limitPrice.value)
  if (orderType.value === 'LIMIT' && (!Number.isFinite(priceLimit) || priceLimit <= 0)) {
    emit('notify', 'Enter a valid limit price')
    return
  }
  submitting.value = true
  try {
    const response = await auth.request('/api/paper/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol: props.symbol, side: side.value, type: orderType.value, quantity: shares, ...(orderType.value === 'LIMIT' ? { limitPrice: priceLimit } : {}) }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { message?: string }
      throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message ?? 'Paper trading service is unavailable')
    }
    const result = await response.json() as { message?: string }
    emit('notify', result.message ?? `${side.value} order accepted by the paper account`)
    quantity.value = '10'
    await refreshData()
  } catch (error) {
    emit('notify', error instanceof Error ? `${error.message}. No order was placed.` : 'Paper trading API unavailable. No order was placed.')
  } finally {
    submitting.value = false
  }
}

onMounted(() => { void refreshData() })
watch(() => props.selectedTab, () => { void refreshData() })
watch(() => auth.isAuthenticated, () => { void refreshData() })
</script>

<template>
  <div class="trading-content">
    <form class="order-entry" @submit.prevent="submitOrder">
      <div class="order-side" role="group" aria-label="Order side">
        <button type="button" :class="{ selected: side === 'BUY' }" @click="side = 'BUY'"><ArrowUpRight :size="14" /> Buy</button>
        <button type="button" :class="{ selected: side === 'SELL' }" @click="side = 'SELL'"><ArrowDownRight :size="14" /> Sell</button>
      </div>
      <div class="order-type" role="group" aria-label="Order type"><button type="button" :class="{ active: orderType === 'MARKET' }" @click="orderType = 'MARKET'">Market</button><button type="button" :class="{ active: orderType === 'LIMIT' }" @click="orderType = 'LIMIT'">Limit</button></div>
      <label class="order-field">Shares<input v-model="quantity" type="number" min="0.0001" step="any" inputmode="decimal" aria-label="Number of shares" /></label>
      <label v-if="orderType === 'LIMIT'" class="order-field">Limit price<input v-model="limitPrice" type="number" min="0.01" step="0.01" inputmode="decimal" aria-label="Limit price" :placeholder="price.toFixed(2)" /></label>
      <div class="order-estimate"><span>Est. {{ side === 'BUY' ? 'cost' : 'proceeds' }}</span><b>{{ formatPrice(estimatedValue) }}</b></div>
      <button class="order-submit" :class="side.toLowerCase()" :disabled="submitting" type="submit"><LoaderCircle v-if="submitting" class="spin" :size="14" /><span v-else>{{ side === 'BUY' ? 'Buy' : 'Sell' }} {{ props.symbol }}</span></button>
    </form>
    <div class="trade-data">
      <div v-if="loading" class="trade-empty"><LoaderCircle class="spin" :size="16" /><div><b>Loading portfolio</b><small>Fetching server-side account data</small></div></div>
      <div v-else-if="loadError" class="trade-empty"><span class="empty-mark">!</span><div><b>Portfolio unavailable</b><small>{{ loadError }}</small></div></div>
      <div v-else-if="!auth.isAuthenticated" class="trade-empty"><span class="empty-mark">⌑</span><div><b>Sign in to view your paper account</b><small>Orders, positions, and balances are private to your account.</small></div></div>
      <div v-else-if="!rows.length" class="trade-empty"><span class="empty-mark">{{ selectedTab === 'positions' ? '↗' : selectedTab === 'orders' ? '◷' : '≡' }}</span><div><b>{{ selectedTab === 'positions' ? 'No open positions' : selectedTab === 'orders' ? 'No open orders' : 'No order history' }}</b><small>{{ selectedTab === 'positions' ? 'Filled paper trades will appear here.' : selectedTab === 'orders' ? 'Limit orders waiting to be filled will appear here.' : 'Completed and cancelled orders will appear here.' }}</small></div></div>
      <div v-else class="trade-table-wrap"><table class="trade-table"><thead><tr><th>{{ selectedTab === 'positions' ? 'SYMBOL' : 'SIDE / SYMBOL' }}</th><th>{{ selectedTab === 'positions' ? 'QTY' : 'TYPE' }}</th><th>{{ selectedTab === 'positions' ? 'AVG. PRICE' : 'PRICE' }}</th><th>{{ selectedTab === 'positions' ? 'P&L' : 'STATUS' }}</th><th></th></tr></thead><tbody><tr v-for="row in rows" :key="String(row.id)"><td><b>{{ row.symbol }}</b></td><td>{{ selectedTab === 'positions' ? row.quantity : `${row.side} ${row.type}` }}</td><td>{{ formatPrice(Number(selectedTab === 'positions' ? row.averagePrice : row.fillPrice ?? row.limitPrice ?? 0)) }}</td><td :class="Number(row.unrealizedPnl ?? row.realizedPnl ?? 0) >= 0 ? 'positive' : 'negative'">{{ selectedTab === 'positions' ? formatPrice(Number(row.unrealizedPnl ?? 0)) : row.status }}</td><td><button v-if="selectedTab === 'orders' && row.status === 'OPEN'" class="cancel-order" :aria-label="`Cancel order ${row.id}`" @click="cancelOrder(String(row.id))">Cancel</button></td></tr></tbody></table></div>
    </div>
  </div>
</template>