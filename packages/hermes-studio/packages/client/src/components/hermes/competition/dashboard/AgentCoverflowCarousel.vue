<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

interface AgentSlide {
  name: string
  subtitle: string
  image: string
  color: string
}

const props = withDefaults(defineProps<{
  slides?: AgentSlide[]
  rotate?: number
  depth?: number
  perspective?: number
  falloff?: number
  fade?: number
  cardWidth?: number
  gap?: number
  loop?: boolean
}>(), {
  rotate: 44,
  depth: 0.6,
  perspective: 3,
  falloff: 0.56,
  fade: 0.1,
  cardWidth: 220,
  gap: 0.05,
  loop: true,
})

const defaultSlides: AgentSlide[] = [
  {
    name: 'Claude Code',
    subtitle: '推理与决策引擎',
    color: '#d97706',
    image: '/agents/claude.png',
  },
  {
    name: 'Codex',
    subtitle: '代码生成与分析',
    color: '#6366f1',
    image: '/agents/codex.png',
  },
  {
    name: 'Hermes Agent',
    subtitle: '任务编排与协调',
    color: '#111111',
    image: '/agents/hermes.png',
  },
  {
    name: 'OpenClaw',
    subtitle: '数据采集与验证',
    color: '#ea580c',
    image: '/agents/openclaw.png',
  },
]

const slides = computed(() => props.slides || defaultSlides)
const count = computed(() => slides.value.length)
const selected = ref(0)
const frameEl = ref<HTMLElement>()
const cardEls = ref<HTMLElement[]>([])
const width = ref(props.cardWidth)

let pos = 0
let target = 0
let raf: number | null = null
let dragState: { id: number; x: number; pos: number; v: number; t: number } | null = null

function indexAt(p: number) {
  return ((Math.round(p) % count.value) + count.value) % count.value
}

function paint() {
  const w = width.value
  if (!w) return
  const pitch = w * (1 + props.gap)

  cardEls.value.forEach((card, i) => {
    if (!card) return
    let offset = i - pos
    if (props.loop) {
      offset = ((offset % count.value) + count.value) % count.value
      if (offset > count.value / 2) offset -= count.value
    }
    const distance = Math.abs(offset)
    const ramp = Math.pow(distance, props.falloff)
    const tilt = Math.min(props.rotate * ramp, 82) * Math.sign(offset)
    card.style.transform =
      `translateX(calc(-50% + ${offset * pitch}px)) translateZ(${-props.depth * w * ramp}px) rotateY(${-tilt}deg)`
    const edge = props.loop ? Math.min(1, Math.max(0, count.value / 2 - distance)) : 1
    card.style.opacity = String(Math.max(0, 1 - props.fade * distance) * edge)
    card.style.zIndex = String(100 - Math.round(distance))
  })
}

function settle(t: number) {
  if (raf !== null) cancelAnimationFrame(raf)
  target = t
  selected.value = indexAt(t)
  const step = () => {
    const remaining = target - pos
    if (Math.abs(remaining) < 0.0004) {
      pos = target
      paint()
      raf = null
      return
    }
    pos += remaining * 0.16
    paint()
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function clamp(p: number) {
  return props.loop ? p : Math.max(0, Math.min(count.value - 1, p))
}

function nudge(by: number) {
  settle(clamp(Math.round(target) + by))
}

function goTo(index: number) {
  const t = props.loop
    ? index + Math.round((target - index) / count.value) * count.value
    : index
  settle(clamp(t))
}

function onPointerDown(e: PointerEvent) {
  if (raf !== null) { cancelAnimationFrame(raf); raf = null }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  target = pos
  dragState = { id: e.pointerId, x: e.clientX, pos, v: 0, t: performance.now() }
}

function onPointerMove(e: PointerEvent) {
  if (!dragState || dragState.id !== e.pointerId) return
  const pitch = width.value * (1 + props.gap)
  if (!pitch) return
  const now = performance.now()
  const prev = pos
  pos = clamp(dragState.pos - (e.clientX - dragState.x) / pitch)
  dragState.v = ((pos - prev) / Math.max(now - dragState.t, 1)) * 1000
  dragState.t = now
  const idx = indexAt(pos)
  if (idx !== selected.value) selected.value = idx
  paint()
}

function onPointerEnd(e: PointerEvent) {
  if (!dragState || dragState.id !== e.pointerId) return
  const carried = Math.max(-2, Math.min(2, dragState.v * 0.18))
  dragState = null
  settle(clamp(Math.round(pos + carried)))
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1) }
}

let autoTimer: ReturnType<typeof setInterval> | null = null
function startAuto() {
  stopAuto()
  autoTimer = setInterval(() => nudge(1), 3500)
}
function stopAuto() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null }
}

onMounted(() => {
  paint()
  startAuto()
  if (frameEl.value) {
    const observer = new ResizeObserver(() => {
      const card = cardEls.value[0]
      if (card) width.value = card.offsetWidth
      paint()
    })
    observer.observe(frameEl.value)
  }
})

onUnmounted(() => {
  if (raf !== null) cancelAnimationFrame(raf)
  stopAuto()
})
</script>

<template>
  <div class="coverflow-wrap">
    <div
      ref="frameEl"
      class="coverflow-frame"
      tabindex="0"
      :style="{ perspective: `${cardWidth * perspective}px` }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerEnd"
      @pointercancel="onPointerEnd"
      @keydown="onKeyDown"
      @mouseenter="stopAuto"
      @mouseleave="startAuto"
    >
      <div class="coverflow-stage" :style="{ height: `${cardWidth}px` }">
        <div
          v-for="(slide, i) in slides"
          :key="i"
          :ref="(el: any) => { if (el) cardEls[i] = el as HTMLElement }"
          class="coverflow-card"
          :style="{ width: `${cardWidth}px` }"
          @click="goTo(i)"
        >
          <div class="agent-card">
            <img :src="slide.image" :alt="slide.name" draggable="false" class="agent-avatar" />
            <div class="agent-name">{{ slide.name }}</div>
            <div class="agent-sub">{{ slide.subtitle }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="coverflow-caption" :key="selected">
      <strong>{{ slides[selected]?.name }}</strong>
      <span>{{ slides[selected]?.subtitle }}</span>
    </div>

    <div class="coverflow-dots">
      <button
        v-for="(_, i) in slides"
        :key="i"
        type="button"
        class="dot"
        :class="{ active: i === selected }"
        @click="goTo(i)"
      />
    </div>

    <button class="coverflow-arrow coverflow-arrow--left" type="button" @click="nudge(-1)">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <button class="coverflow-arrow coverflow-arrow--right" type="button" @click="nudge(1)">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  </div>
</template>

<style scoped>
.coverflow-wrap {
  position: relative;
  width: 100%;
  user-select: none;
}

.coverflow-frame {
  cursor: grab;
  overflow: hidden;
  padding: 32px 0;
  outline: none;
  touch-action: pan-y;
}
.coverflow-frame:active { cursor: grabbing; }

.coverflow-stage {
  position: relative;
  transform-style: preserve-3d;
}

.coverflow-card {
  position: absolute;
  left: 50%;
  top: 0;
  aspect-ratio: 1;
  will-change: transform;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
}

.agent-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  transition: box-shadow .2s;
}
.coverflow-card:hover .agent-card {
  box-shadow: 0 12px 40px rgba(0,0,0,.08);
}

.agent-avatar {
  width: 100px;
  height: 100px;
  object-fit: contain;
  border-radius: 16px;
  pointer-events: none;
}

.agent-name {
  font-size: 16px;
  font-weight: 700;
  color: #111;
  letter-spacing: .02em;
}

.agent-sub {
  font-size: 12px;
  color: #6b7280;
  text-align: center;
  padding: 0 16px;
}

.coverflow-caption {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  animation: fadeIn .3s ease;
}
.coverflow-caption strong { font-size: 15px; color: var(--text-primary); }
.coverflow-caption span { font-size: 12px; color: var(--text-secondary); }

.coverflow-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #111;
  opacity: .2;
  border: none;
  cursor: pointer;
  transition: opacity .2s;
}
.dot.active { opacity: 1; }

.coverflow-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 200;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background .15s, border-color .15s;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}
.coverflow-arrow:hover { background: #f3f4f6; border-color: #d1d5db; }
.coverflow-arrow--left { left: 12px; }
.coverflow-arrow--right { right: 12px; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
</style>
