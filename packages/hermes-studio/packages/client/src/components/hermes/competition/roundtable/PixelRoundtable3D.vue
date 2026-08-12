<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import type { AgentRole, RoundtableSpeech } from '@hermes/shared'

interface Props {
  speeches: RoundtableSpeech[]
  isRunning: boolean
  activeRound: number
}

const props = defineProps<Props>()
const containerRef = ref<HTMLDivElement | null>(null)

const seatAgents: AgentRole[] = ['research', 'analyst', 'writer', 'data', 'validator']
const agentColors: Record<string, number> = {
  research: 0x6366f1,
  analyst: 0xf59e0b,
  writer: 0x10b981,
  data: 0x3b82f6,
  validator: 0xef4444,
  moderator: 0x8b5cf6,
  rollback: 0x64748b,
}
const agentNames: Record<string, string> = {
  research: '研究员', analyst: '分析师', writer: '撰稿员', data: '数据员', validator: '验证员', moderator: '主持人', rollback: '回滚员',
}

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let labelRenderer: CSS2DRenderer | null = null
let controls: OrbitControls | null = null
let resizeObserver: ResizeObserver | null = null
let animationFrame = 0
let tableMaterial: THREE.MeshStandardMaterial | null = null
let roundLabelElement: HTMLDivElement | null = null
let roundFlashStarted = -1
let hoveredAgent: AgentRole | null = null
let activeSpeaker: AgentRole | null = null
let userInteracting = false
let resumeRotateTimer: ReturnType<typeof setTimeout> | null = null

const agentGroups = new Map<AgentRole, THREE.Group>()
const agentLabels = new Map<AgentRole, HTMLDivElement>()
const activeRings = new Map<AgentRole, THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>()
const bubbleEffects: Array<{ group: THREE.Group; startedAt: number }> = []
const disposableGeometries = new Set<THREE.BufferGeometry>()
const disposableMaterials = new Set<THREE.Material>()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2(4, 4)
const particleMeta: Array<{ from: THREE.Vector3; to: THREE.Vector3; phase: number; arc: number }> = []
let particleGeometry: THREE.BufferGeometry | null = null
let particlePoints: THREE.Points | null = null

function material<T extends THREE.Material>(value: T): T {
  disposableMaterials.add(value)
  return value
}

function geometry<T extends THREE.BufferGeometry>(value: T): T {
  disposableGeometries.add(value)
  return value
}

function darker(color: number, factor = .72): number {
  const value = new THREE.Color(color)
  value.multiplyScalar(factor)
  return value.getHex()
}

function createVoxelTable(target: THREE.Scene) {
  const voxelSize = .3
  const radius = 2.5
  const positions: Array<[number, number]> = []
  for (let x = -radius; x <= radius; x += voxelSize) {
    for (let z = -radius; z <= radius; z += voxelSize) {
      if (x * x + z * z <= radius * radius) positions.push([x, z])
    }
  }
  const box = geometry(new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize))
  tableMaterial = material(new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: .2, roughness: .62 }))
  const tabletop = new THREE.InstancedMesh(box, tableMaterial, positions.length)
  const matrix = new THREE.Matrix4()
  positions.forEach(([x, z], index) => {
    matrix.makeTranslation(x, 1.25, z)
    tabletop.setMatrixAt(index, matrix)
  })
  tabletop.instanceMatrix.needsUpdate = true
  tabletop.receiveShadow = true
  target.add(tabletop)

  const legGeometry = geometry(new THREE.BoxGeometry(.45, 1.3, .45))
  const legMaterial = material(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: .12, roughness: .75 }))
  ;[[-1.65, -1.65], [1.65, -1.65], [-1.65, 1.65], [1.65, 1.65]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeometry, legMaterial)
    leg.position.set(x, .5, z)
    leg.castShadow = true
    target.add(leg)
  })
}

function createAgent(agent: AgentRole, index: number, target: THREE.Scene) {
  const angle = (index / seatAgents.length) * Math.PI * 2 - Math.PI / 2
  const radius = 3.5
  const group = new THREE.Group()
  group.position.set(Math.cos(angle) * radius, .32, Math.sin(angle) * radius)
  group.lookAt(0, group.position.y, 0)
  group.userData.agent = agent
  group.userData.baseY = group.position.y

  const color = agentColors[agent]
  const headMaterial = material(new THREE.MeshStandardMaterial({ color, roughness: .68 }))
  const bodyMaterial = material(new THREE.MeshStandardMaterial({ color: darker(color), roughness: .72 }))
  const legMaterial = material(new THREE.MeshStandardMaterial({ color: darker(color, .52), roughness: .78 }))
  const head = new THREE.Mesh(geometry(new THREE.BoxGeometry(.6, .6, .6)), headMaterial)
  head.position.y = 1.65
  head.castShadow = true
  head.userData.agent = agent
  group.add(head)

  const torsoGeometry = geometry(new THREE.BoxGeometry(.5, .4, .4))
  for (let y = 1.05; y <= 1.45; y += .4) {
    const torso = new THREE.Mesh(torsoGeometry, bodyMaterial)
    torso.position.y = y
    torso.castShadow = true
    torso.userData.agent = agent
    group.add(torso)
  }
  const legGeometry = geometry(new THREE.BoxGeometry(.2, .6, .3))
  for (const x of [-.15, .15]) {
    const leg = new THREE.Mesh(legGeometry, legMaterial)
    leg.position.set(x, .5, 0)
    leg.castShadow = true
    leg.userData.agent = agent
    group.add(leg)
  }

  const nameplate = new THREE.Mesh(
    geometry(new THREE.BoxGeometry(.8, .12, .3)),
    material(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .82 })),
  )
  nameplate.position.set(0, .9, .88)
  nameplate.userData.agent = agent
  group.add(nameplate)

  const label = document.createElement('div')
  label.className = 'agent-name-label'
  label.style.color = `#${color.toString(16).padStart(6, '0')}`
  label.innerHTML = `<strong>${agentNames[agent]}</strong><span>智能体</span><small>等待发言</small>`
  const labelObject = new CSS2DObject(label)
  labelObject.position.set(0, 2.25, 0)
  group.add(labelObject)
  agentLabels.set(agent, label)

  const ringMaterial = material(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }))
  const ring = new THREE.Mesh(geometry(new THREE.RingGeometry(.48, .62, 32)), ringMaterial)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = .02
  group.add(ring)
  activeRings.set(agent, ring)

  agentGroups.set(agent, group)
  target.add(group)
}

function createParticles(target: THREE.Scene) {
  const count = 40
  const positions = new Float32Array(count * 3)
  for (let index = 0; index < count; index++) {
    const fromAgent = seatAgents[index % seatAgents.length]
    const toAgent = seatAgents[(index + 1 + (index % 3)) % seatAgents.length]
    particleMeta.push({
      from: agentGroups.get(fromAgent)!.position.clone(),
      to: agentGroups.get(toAgent)!.position.clone(),
      phase: index / count,
      arc: .65 + (index % 5) * .1,
    })
  }
  particleGeometry = geometry(new THREE.BufferGeometry())
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const pointsMaterial = material(new THREE.PointsMaterial({ color: 0xffffff, size: .07, transparent: true, opacity: .72, depthWrite: false }))
  particlePoints = new THREE.Points(particleGeometry, pointsMaterial)
  particlePoints.visible = props.isRunning
  target.add(particlePoints)
}

function spawnSpeechEffect(speech: RoundtableSpeech) {
  const agent = speech.agent
  const parent = agentGroups.get(agent)
  if (!parent) return
  activeSpeaker = agent
  const bubbleGroup = new THREE.Group()
  bubbleGroup.position.set(.4, 2.05, 0)
  ;[.1, .15, .22].forEach((size, index) => {
    const bubbleMaterial = material(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .92 }))
    const cube = new THREE.Mesh(geometry(new THREE.BoxGeometry(size, size, size)), bubbleMaterial)
    cube.position.set(index * .16, index * .22, 0)
    bubbleGroup.add(cube)
  })
  parent.add(bubbleGroup)
  bubbleEffects.push({ group: bubbleGroup, startedAt: performance.now() })
  const label = agentLabels.get(agent)
  if (label) {
    const preview = speech.content.replace(/\s+/g, ' ').trim().slice(0, 46)
    label.querySelector('small')!.textContent = `${speech.model || '模型'} · ${preview || '正在发言'}`
  }
}

function createRoundLabel(target: THREE.Scene) {
  roundLabelElement = document.createElement('div')
  roundLabelElement.className = 'round-label'
  roundLabelElement.textContent = props.activeRound > 0 ? `第 ${props.activeRound} 轮` : '等待开始'
  const label = new CSS2DObject(roundLabelElement)
  label.position.set(0, 2.4, 0)
  target.add(label)
}

function updateParticles(time: number) {
  if (!particleGeometry || !particlePoints || !props.isRunning) return
  const values = particleGeometry.getAttribute('position') as THREE.BufferAttribute
  particleMeta.forEach((item, index) => {
    const progress = (item.phase + time * .00011) % 1
    const x = THREE.MathUtils.lerp(item.from.x, item.to.x, progress)
    const z = THREE.MathUtils.lerp(item.from.z, item.to.z, progress)
    const y = .75 + Math.sin(progress * Math.PI) * item.arc
    values.setXYZ(index, x, y, z)
  })
  values.needsUpdate = true
}

function updateEffects(time: number) {
  for (let index = bubbleEffects.length - 1; index >= 0; index--) {
    const effect = bubbleEffects[index]
    const progress = (time - effect.startedAt) / 2000
    effect.group.position.y = 2.05 + progress * .8
    effect.group.children.forEach(child => {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
      mesh.material.opacity = Math.max(0, 1 - Math.max(0, progress - .45) / .55)
    })
    if (progress >= 1) {
      effect.group.removeFromParent()
      bubbleEffects.splice(index, 1)
    }
  }
  agentGroups.forEach((group, agent) => {
    const speaking = agent === activeSpeaker && bubbleEffects.some(effect => effect.group.parent === group)
    const targetY = Number(group.userData.baseY) + (speaking ? Math.max(0, Math.sin(time * .018)) * .15 : 0)
    group.position.y = THREE.MathUtils.lerp(group.position.y, targetY, .22)
    const ring = activeRings.get(agent)
    if (ring) ring.material.opacity = speaking ? .55 + Math.sin(time * .007) * .25 : 0
    const scale = hoveredAgent === agent ? 1.1 : 1
    group.scale.lerp(new THREE.Vector3(scale, scale, scale), .18)
  })
  if (tableMaterial && roundFlashStarted > 0) {
    const progress = (time - roundFlashStarted) / 900
    const flash = Math.max(0, Math.sin(Math.min(progress, 1) * Math.PI))
    tableMaterial.emissive.setHex(0xffffff)
    tableMaterial.emissiveIntensity = flash * .35
    if (progress >= 1) roundFlashStarted = -1
  }
}

function updateHover(event: PointerEvent) {
  if (!renderer || !camera || !containerRef.value) return
  const bounds = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects([...agentGroups.values()], true)
  const next = hits.map(hit => hit.object.userData.agent as AgentRole | undefined).find(Boolean) || null
  if (next === hoveredAgent) return
  if (hoveredAgent) agentLabels.get(hoveredAgent)?.classList.remove('is-hovered')
  hoveredAgent = next
  if (hoveredAgent) agentLabels.get(hoveredAgent)?.classList.add('is-hovered')
}

function animate(time: number) {
  if (!renderer || !labelRenderer || !scene || !camera || !controls) return
  controls.autoRotate = !props.isRunning && !userInteracting
  controls.update()
  updateParticles(time)
  updateEffects(time)
  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
  animationFrame = requestAnimationFrame(animate)
}

function resize() {
  if (!containerRef.value || !renderer || !labelRenderer || !camera) return
  const width = Math.max(1, containerRef.value.clientWidth)
  const height = Math.max(1, containerRef.value.clientHeight)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  labelRenderer.setSize(width, height)
}

onMounted(() => {
  const container = containerRef.value
  if (!container) return
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, 1, .1, 100)
  camera.position.set(0, 8, 12)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setClearColor(0x000000, 0)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  labelRenderer = new CSS2DRenderer()
  labelRenderer.domElement.className = 'roundtable-label-layer'
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.inset = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'
  container.appendChild(labelRenderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = .08
  controls.minDistance = 6
  controls.maxDistance = 20
  controls.maxPolarAngle = Math.PI / 2.2
  controls.autoRotateSpeed = .55
  controls.addEventListener('start', () => {
    userInteracting = true
    if (resumeRotateTimer) clearTimeout(resumeRotateTimer)
  })
  controls.addEventListener('end', () => {
    resumeRotateTimer = setTimeout(() => { userInteracting = false }, 2400)
  })

  scene.add(new THREE.AmbientLight(0xffffff, .6))
  const directional = new THREE.DirectionalLight(0xffffff, .8)
  directional.position.set(5, 10, 5)
  directional.castShadow = true
  scene.add(directional)

  const ground = new THREE.Mesh(
    geometry(new THREE.CircleGeometry(6, 48)),
    material(new THREE.MeshBasicMaterial({ color: 0xf0f0f0, transparent: true, opacity: .3, wireframe: true, side: THREE.DoubleSide })),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -.02
  scene.add(ground)

  createVoxelTable(scene)
  seatAgents.forEach((agent, index) => createAgent(agent, index, scene!))
  createParticles(scene)
  createRoundLabel(scene)

  container.addEventListener('pointermove', updateHover)
  container.addEventListener('pointerleave', () => {
    if (hoveredAgent) agentLabels.get(hoveredAgent)?.classList.remove('is-hovered')
    hoveredAgent = null
  })
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()
  animationFrame = requestAnimationFrame(animate)
})

watch(() => props.speeches.length, (length, previous) => {
  if (length <= previous) return
  const latest = props.speeches[length - 1]
  if (latest) spawnSpeechEffect(latest)
})

watch(() => props.activeRound, round => {
  if (roundLabelElement) roundLabelElement.textContent = round > 0 ? `第 ${round} 轮` : '等待开始'
  roundFlashStarted = performance.now()
})

watch(() => props.isRunning, running => {
  if (particlePoints) particlePoints.visible = running
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  if (resumeRotateTimer) clearTimeout(resumeRotateTimer)
  if (containerRef.value) containerRef.value.removeEventListener('pointermove', updateHover)
  controls?.dispose()
  disposableGeometries.forEach(item => item.dispose())
  disposableMaterials.forEach(item => item.dispose())
  renderer?.dispose()
  renderer?.domElement.remove()
  labelRenderer?.domElement.remove()
  scene?.clear()
  agentGroups.clear()
  agentLabels.clear()
  activeRings.clear()
  bubbleEffects.length = 0
  particleMeta.length = 0
})
</script>

<template>
  <div ref="containerRef" class="pixel-roundtable-3d" aria-label="3D 像素智能体圆桌场景" />
</template>

<style scoped>
.pixel-roundtable-3d { position:relative; width:100%; height:400px; border-radius:12px; overflow:hidden; cursor:grab; background:rgba(248,249,250,.52); border:1px solid var(--border-color); }
.pixel-roundtable-3d:active { cursor:grabbing; }
.pixel-roundtable-3d :deep(canvas) { display:block; width:100%; height:100%; }
.pixel-roundtable-3d :deep(.agent-name-label) { display:grid; justify-items:center; min-width:76px; padding:5px 7px; border:1px solid currentColor; border-radius:7px; background:rgba(255,255,255,.94); box-shadow:0 4px 12px rgba(15,23,42,.1); font-size:11px; font-weight:600; line-height:1.2; text-align:center; transition:transform .18s ease, box-shadow .18s ease; }
.pixel-roundtable-3d :deep(.agent-name-label span) { font-size:8px; font-weight:500; opacity:.58; text-transform:uppercase; }
.pixel-roundtable-3d :deep(.agent-name-label small) { display:none; width:148px; margin-top:4px; color:#475569; font-size:9px; font-weight:500; white-space:normal; }
.pixel-roundtable-3d :deep(.agent-name-label.is-hovered) { transform:translateY(-4px) scale(1.04); box-shadow:0 8px 24px rgba(15,23,42,.16); }
.pixel-roundtable-3d :deep(.agent-name-label.is-hovered small) { display:block; }
.pixel-roundtable-3d :deep(.round-label) { padding:6px 10px; border:1px solid #e5e7eb; border-radius:7px; background:rgba(255,255,255,.94); color:#111827; box-shadow:0 5px 16px rgba(15,23,42,.1); font-size:12px; font-weight:700; }
@media (max-width:640px) { .pixel-roundtable-3d { height:320px; } }
</style>
