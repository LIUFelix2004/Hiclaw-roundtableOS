<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChatPanel from '@/components/hermes/chat/ChatPanel.vue'
import ChatDAGMini from '@/components/hermes/competition/dag/ChatDAGMini.vue'
import { useAppStore } from '@/stores/hermes/app'
import { useChatStore } from '@/stores/hermes/chat'
import { useProfilesStore } from '@/stores/hermes/profiles'
import { useSettingsStore } from '@/stores/hermes/settings'

const appStore = useAppStore()
const chatStore = useChatStore()
const profilesStore = useProfilesStore()
const settingsStore = useSettingsStore()
const route = useRoute()
const router = useRouter()

const routeSessionId = computed(() => {
  const value = route.params.sessionId
  return typeof value === 'string' && value.trim() ? value : null
})

const routeProfile = computed(() => {
  const value = route.query.profile
  return typeof value === 'string' && value.trim() ? value : null
})

const isStandaloneChat = computed(() => route.meta?.standaloneChat === true)
const productTitle = __COMPETITION_MODE__ ? 'AgentOS' : 'Hermes Studio'
const showDAGPanel = __COMPETITION_MODE__
const dagPanelCollapsed = ref(false)
const tabTitle = computed(() => {
  if (route.name !== 'hermes.session' && route.name !== 'desktop.chat') return productTitle
  return chatStore.activeSession?.title?.trim() || productTitle
})

watch(tabTitle, (value) => {
  document.title = value
}, { immediate: true })

onUnmounted(() => {
  document.title = productTitle
})

async function loadRouteSession() {
  await chatStore.loadSessions(chatStore.sessionProfileFilter, routeSessionId.value)
  if (routeSessionId.value && chatStore.activeSessionId !== routeSessionId.value) {
    await router.replace({ name: 'hermes.chat' })
  }
}

onMounted(async () => {
  chatStore.setRuntimeMode('default')
  appStore.loadModels()
  // 先加载 profile，确保缓存 key 使用正确的 profile name；同时预取显示设置，
  // 让聊天完成提示音不依赖用户先打开 Settings 页面。
  await Promise.all([
    profilesStore.fetchProfiles(),
    settingsStore.fetchSettings(),
  ])
  chatStore.validateSessionProfileFilter(profilesStore.profiles.map(profile => profile.name))
  await loadRouteSession()
})

watch([routeSessionId, routeProfile], async ([sessionId]) => {
  if (!chatStore.sessionsLoaded) return
  if (!sessionId) {
    await chatStore.loadSessions(chatStore.sessionProfileFilter)
    return
  }
  if (chatStore.activeSessionId === sessionId) return

  const exists = chatStore.sessions.some(session => session.id === sessionId)
  if (!exists) {
    await loadRouteSession()
    return
  }

  await chatStore.switchSession(sessionId)
})
</script>

<template>
  <div class="chat-view" :class="{ 'chat-view--standalone': isStandaloneChat, 'chat-view--with-dag': showDAGPanel }">
    <ChatPanel :standalone="isStandaloneChat" />
    <aside v-if="showDAGPanel" class="chat-dag-panel" :class="{ collapsed: dagPanelCollapsed }">
      <div class="dag-panel-header">
        <span v-if="!dagPanelCollapsed" class="dag-panel-title">Agent Execution</span>
        <button class="dag-panel-toggle" :aria-label="dagPanelCollapsed ? 'Expand execution DAG' : 'Collapse execution DAG'" @click="dagPanelCollapsed = !dagPanelCollapsed">
          {{ dagPanelCollapsed ? '◀' : '▶' }}
        </button>
      </div>
      <div v-show="!dagPanelCollapsed" class="dag-panel-body">
        <ChatDAGMini />
      </div>
    </aside>
  </div>
</template>

<style scoped lang="scss">
.chat-view {
  height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;

  &--standalone {
    height: 100%;
  }

  &--with-dag {
    flex-direction: row;
    gap: 0;

    :deep(.chat-panel) {
      flex: 1;
      min-width: 0;
    }
  }
}

.chat-dag-panel {
  width: 340px;
  min-width: 340px;
  border-left: 1px solid var(--border-color);
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  transition: width .2s ease, min-width .2s ease;

  &.collapsed { width: 40px; min-width: 40px; }
}

.dag-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text-secondary);
}

.dag-panel-toggle { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 12px; padding: 4px; }
.dag-panel-toggle:hover { color: var(--accent-primary); }
.dag-panel-body { flex: 1; min-height: 0; overflow: hidden; }

@media (max-width: 960px) { .chat-dag-panel { display: none; } }
</style>
