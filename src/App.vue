<script setup>
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const showTabBar = computed(() => ['/', '/players', '/start', '/ranking', '/records'].includes(route.path))

const tabs = [
  { path: '/players', icon: '👥', label: '牌友' },
  { path: '/start', icon: '🀄', label: '开局' },
  { path: '/ranking', icon: '🏆', label: '榜单' },
  { path: '/records', icon: '📋', label: '记录' },
]
</script>

<template>
  <router-view />
  <nav v-if="showTabBar" class="tab-bar">
    <router-link v-for="tab in tabs" :key="tab.path" :to="tab.path"
      :class="{ active: route.path === tab.path }">
      <span class="tab-icon">{{ tab.icon }}</span>
      <span>{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.tab-bar {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 480px;
  background: #fff;
  display: flex;
  border-top: 1px solid #e2e8f0;
  padding: 8px 0;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  z-index: 100;
}
.tab-bar a {
  flex: 1; text-align: center;
  font-size: 12px; color: #64748b;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  text-decoration: none;
}
.tab-bar a.active { color: #4361ee; }
.tab-icon { font-size: 22px; }
</style>
