<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  HistogramSeries,
  LineSeries,
  type AreaData,
  type BarData,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type SeriesType,
} from 'lightweight-charts'
import { indicators } from '../lib/indicators'
import type { Candle, ChartType, Drawing } from '../types/market'

const props = defineProps<{
  candles: Candle[]
  chartType: ChartType
  symbol: string
  indicators: string[]
}>()

type DrawTool = Drawing['kind'] | 'select'
const chartHost = ref<HTMLDivElement>()
const drawingTool = ref<DrawTool>('select')
const drawings = ref<Drawing[]>([])
const selectedDrawing = ref<string>()
let chart: IChartApi | undefined
let mainSeries: ISeriesApi<SeriesType> | undefined
let volumeSeries: ISeriesApi<'Histogram'> | undefined
let overlaySeries: ISeriesApi<'Line'>[] = []
let resizeObserver: ResizeObserver | undefined
let pendingPoint: { x: number; y: number } | undefined
let dragDrawing: { id: string; point: 'first' | 'second' } | undefined
let latestCandleTime: Candle['time'] | undefined

function normalizedCandles(): Candle[] {
  const byTime = new Map<number, Candle>()
  for (const candle of props.candles) byTime.set(Number(candle.time), candle)
  return [...byTime.values()].sort((left, right) => Number(left.time) - Number(right.time))
}

const tools: { id: DrawTool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'horizontal', label: 'Horizontal line', icon: '—' },
  { id: 'vertical', label: 'Vertical line', icon: '│' },
  { id: 'trend', label: 'Trend line', icon: '╱' },
  { id: 'ray', label: 'Ray', icon: '↗' },
  { id: 'rectangle', label: 'Rectangle', icon: '▱' },
  { id: 'text', label: 'Text note', icon: 'T' },
]

function drawingKey() {
  return `marketdesk.demo.drawings.${props.symbol}`
}

function loadDrawings() {
  try {
    drawings.value = JSON.parse(localStorage.getItem(drawingKey()) ?? '[]') as Drawing[]
  } catch {
    drawings.value = []
  }
}

function persistDrawings() {
  localStorage.setItem(drawingKey(), JSON.stringify(drawings.value))
}

function makeOptions() {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: '#101719' },
      textColor: '#819195',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 10,
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: '#1c282b' },
      horzLines: { color: '#1c282b' },
    },
    crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#6c8280', style: 2, labelBackgroundColor: '#3a5550' }, horzLine: { color: '#6c8280', style: 2, labelBackgroundColor: '#3a5550' } },
    rightPriceScale: { borderColor: '#2b393d', scaleMargins: { top: 0.08, bottom: 0.24 } },
    timeScale: { borderColor: '#2b393d', timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 7 },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
  }
}

function clearSeries() {
  if (!chart) return
  for (const series of overlaySeries) chart.removeSeries(series)
  overlaySeries = []
  if (volumeSeries) chart.removeSeries(volumeSeries)
  if (mainSeries) chart.removeSeries(mainSeries)
  volumeSeries = undefined
  mainSeries = undefined
}

function setMainData() {
  const candles = normalizedCandles()
  if (!chart || !candles.length) return
  clearSeries()
  latestCandleTime = candles.at(-1)?.time
  const candleData: CandlestickData[] = candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }))

  if (props.chartType === 'Candles') {
    mainSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#69d7b0', downColor: '#f07878', borderUpColor: '#69d7b0', borderDownColor: '#f07878',
      wickUpColor: '#69d7b0', wickDownColor: '#f07878',
    })
    mainSeries.setData(candleData)
  } else if (props.chartType === 'Bar') {
    mainSeries = chart.addSeries(BarSeries, { upColor: '#69d7b0', downColor: '#f07878' })
    mainSeries.setData(candleData as BarData[])
  } else if (props.chartType === 'Area') {
    mainSeries = chart.addSeries(AreaSeries, {
      lineColor: '#69d7b0', topColor: 'rgba(105, 215, 176, .28)', bottomColor: 'rgba(105, 215, 176, .01)',
      lineWidth: 2,
    })
    mainSeries.setData(candles.map(({ time, close }) => ({ time, value: close })) as AreaData[])
  } else {
    mainSeries = chart.addSeries(LineSeries, { color: '#69d7b0', lineWidth: 2, crosshairMarkerRadius: 3 })
    mainSeries.setData(candles.map(({ time, close }) => ({ time, value: close })) as LineData[])
  }
  mainSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: props.indicators.includes('Volume') ? 0.24 : 0.08 } })

  if (props.indicators.includes('Volume')) {
    volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' }, priceScaleId: 'volume',
      lastValueVisible: false, priceLineVisible: false,
    })
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.81, bottom: 0 }, visible: false })
    const volumeData: HistogramData[] = candles.map((candle) => ({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(105, 215, 176, .32)' : 'rgba(240, 120, 120, .32)',
    }))
    volumeSeries.setData(volumeData)
  }

  for (const indicator of indicators) {
    if (!props.indicators.includes(indicator.id) || ['RSI 14', 'MACD'].includes(indicator.id)) continue
    const result = indicator.calculate(candles)
    for (const [lineIndex, line] of result.lines.entries()) {
      const series = chart.addSeries(LineSeries, {
        color: indicator.id === 'Bollinger Bands' ? '#8b9bca' : indicator.id === 'VWAP' ? '#e8c36a' : lineIndex ? '#7186a7' : indicator.id === 'EMA 20' ? '#e8c36a' : '#82a7d9',
        lineWidth: 1,
        lineStyle: indicator.id === 'Bollinger Bands' && lineIndex > 0 ? 2 : 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      series.setData(line as LineData[])
      overlaySeries.push(series)
    }
  }
  chart.timeScale().fitContent()
}

function updateLatest() {
  const candles = normalizedCandles()
  if (!chart || !mainSeries || !candles.length) return
  const last = candles.at(-1)!
  if (latestCandleTime !== undefined && Number(last.time) < Number(latestCandleTime)) {
    setMainData()
    return
  }
  try {
    if (props.chartType === 'Candles' || props.chartType === 'Bar') {
      mainSeries.update({ time: last.time, open: last.open, high: last.high, low: last.low, close: last.close } as CandlestickData)
    } else {
      mainSeries.update({ time: last.time, value: last.close } as LineData)
    }
    if (volumeSeries) volumeSeries.update({ time: last.time, value: last.volume, color: last.close >= last.open ? 'rgba(105, 215, 176, .32)' : 'rgba(240, 120, 120, .32)' })
    latestCandleTime = last.time
  } catch {
    setMainData()
  }
}

function drawingStyle(drawing: Drawing) {
  return {
    x1: `${drawing.x1 * 100}%`, y1: `${drawing.y1 * 100}%`,
    x2: `${(drawing.x2 ?? drawing.x1) * 100}%`, y2: `${(drawing.y2 ?? drawing.y1) * 100}%`,
  }
}

function addPoint(event: PointerEvent) {
  if (drawingTool.value === 'select' || !chartHost.value) return
  const bounds = chartHost.value.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
  const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))
  if (drawingTool.value === 'text') {
    const note = window.prompt('Drawing note')
    if (note) drawings.value.push({ id: crypto.randomUUID(), kind: 'text', x1: x, y1: y, label: note })
    persistDrawings()
    drawingTool.value = 'select'
    return
  }
  if (['horizontal', 'vertical'].includes(drawingTool.value)) {
    drawings.value.push({ id: crypto.randomUUID(), kind: drawingTool.value, x1: x, y1: y })
    persistDrawings()
    drawingTool.value = 'select'
    return
  }
  if (!pendingPoint) {
    pendingPoint = { x, y }
    return
  }
  drawings.value.push({ id: crypto.randomUUID(), kind: drawingTool.value, x1: pendingPoint.x, y1: pendingPoint.y, x2: x, y2: y })
  pendingPoint = undefined
  persistDrawings()
  drawingTool.value = 'select'
}

function removeDrawing(id: string) {
  drawings.value = drawings.value.filter((drawing) => drawing.id !== id)
  selectedDrawing.value = undefined
  persistDrawings()
}

function removeSelected() {
  if (selectedDrawing.value) removeDrawing(selectedDrawing.value)
  else if (drawings.value.length) removeDrawing(drawings.value.at(-1)!.id)
}

function startDrag(event: PointerEvent, drawing: Drawing, point: 'first' | 'second') {
  if (drawingTool.value !== 'select') return
  event.stopPropagation()
  selectedDrawing.value = drawing.id
  dragDrawing = { id: drawing.id, point }
  ;(event.currentTarget as SVGElement).setPointerCapture(event.pointerId)
}

function moveDrawing(event: PointerEvent) {
  if (!dragDrawing || !chartHost.value) return
  const bounds = chartHost.value.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
  const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))
  const drawing = drawings.value.find((item) => item.id === dragDrawing?.id)
  if (!drawing) return
  if (dragDrawing.point === 'first') { drawing.x1 = x; drawing.y1 = y }
  else { drawing.x2 = x; drawing.y2 = y }
}

function endDrag() {
  if (!dragDrawing) return
  dragDrawing = undefined
  persistDrawings()
}

async function initialize() {
  await nextTick()
  if (!chartHost.value) return
  chart?.remove()
  chart = createChart(chartHost.value, makeOptions())
  setMainData()
  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => chart?.applyOptions({}))
  resizeObserver.observe(chartHost.value)
}

onMounted(() => {
  loadDrawings()
  void initialize()
})
onUnmounted(() => {
  resizeObserver?.disconnect()
  chart?.remove()
})
watch(() => [props.symbol, props.chartType, props.indicators.join('|')], () => {
  loadDrawings()
  void initialize()
})
watch(() => props.candles, (next, previous) => {
  if (next.length !== previous?.length) setMainData()
  else updateLatest()
})
</script>

<template>
  <div class="chart-canvas" :class="{ 'drawing-mode': drawingTool !== 'select' }">
    <div ref="chartHost" class="chart-host"></div>
    <div class="drawing-tools" aria-label="Drawing tools">
      <button v-for="tool in tools" :key="tool.id" :class="{ active: drawingTool === tool.id }" :aria-label="tool.label" :title="tool.label" @click="drawingTool = tool.id; pendingPoint = undefined"><span>{{ tool.icon }}</span></button>
      <button aria-label="Delete selected drawing" title="Delete selected drawing" @click="removeSelected"><span>×</span></button>
    </div>
    <svg class="drawing-layer" :class="{ interactive: drawingTool !== 'select' }" @pointerdown="addPoint" @pointermove="moveDrawing" @pointerup="endDrag" @pointercancel="endDrag">
      <g v-for="drawing in drawings" :key="drawing.id" class="drawing-item" :class="{ selected: selectedDrawing === drawing.id }" @click.stop="selectedDrawing = drawing.id">
        <line v-if="['horizontal', 'vertical', 'trend', 'ray'].includes(drawing.kind)" :x1="drawingStyle(drawing).x1" :y1="drawingStyle(drawing).y1" :x2="drawing.kind === 'horizontal' || drawing.kind === 'ray' ? '100%' : drawing.kind === 'vertical' ? drawingStyle(drawing).x1 : drawingStyle(drawing).x2" :y2="drawing.kind === 'horizontal' ? drawingStyle(drawing).y1 : drawing.kind === 'vertical' ? '100%' : drawing.kind === 'ray' ? drawingStyle(drawing).y2 : drawingStyle(drawing).y2" @pointerdown="startDrag($event, drawing, 'first')" />
        <rect v-else-if="drawing.kind === 'rectangle'" :x="drawingStyle(drawing).x1" :y="drawingStyle(drawing).y1" :width="`${Math.abs((drawing.x2 ?? drawing.x1) - drawing.x1) * 100}%`" :height="`${Math.abs((drawing.y2 ?? drawing.y1) - drawing.y1) * 100}%`" @pointerdown="startDrag($event, drawing, 'first')" />
        <text v-else :x="drawingStyle(drawing).x1" :y="drawingStyle(drawing).y1" @pointerdown="startDrag($event, drawing, 'first')">{{ drawing.label }}</text>
        <circle v-if="selectedDrawing === drawing.id" :cx="drawingStyle(drawing).x1" :cy="drawingStyle(drawing).y1" r="5" @pointerdown="startDrag($event, drawing, 'first')" />
        <circle v-if="selectedDrawing === drawing.id && drawing.x2 !== undefined" :cx="drawingStyle(drawing).x2" :cy="drawingStyle(drawing).y2" r="5" @pointerdown="startDrag($event, drawing, 'second')" />
      </g>
    </svg>
    <span v-if="drawingTool !== 'select'" class="draw-hint">{{ drawingTool === 'text' ? 'Click to place a note' : ['horizontal', 'vertical'].includes(drawingTool) ? 'Click to place drawing' : pendingPoint ? 'Click to finish drawing' : 'Click first point' }}</span>
    <span v-if="props.indicators.includes('RSI 14') || props.indicators.includes('MACD')" class="indicator-summary">{{ props.indicators.filter((item) => ['RSI 14', 'MACD'].includes(item)).join(' · ') }} active</span>
  </div>
</template>