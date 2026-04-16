<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../lib/supabase.js'

const loading = ref(true)
const players = ref([])
const activeTab = ref('score')

const tabs = [
  { key: 'score', label: '总分' },
  { key: 'winRate', label: '胜率' },
  { key: 'games', label: '局数' },
  { key: 'expense', label: '支出' },
]

onMounted(async () => {
  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('is_deleted', false)
  players.value = data || []
  loading.value = false
})

const rankedPlayers = computed(() => {
  const list = [...players.value]
  switch (activeTab.value) {
    case 'score':
      return list.sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
    case 'winRate':
      return list
        .filter(p => p.total_games > 0)
        .sort((a, b) => (b.win_games / b.total_games) - (a.win_games / a.total_games))
    case 'games':
      return list.sort((a, b) => (b.total_games || 0) - (a.total_games || 0))
    case 'expense':
      return list.sort((a, b) => (b.total_expense || 0) - (a.total_expense || 0))
    default:
      return list
  }
})

function getAvatar(player) {
  const colors = ['#4361ee', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']
  const idx = player.nickname.charCodeAt(0) % colors.length
  return colors[idx]
}

function getValue(player) {
  switch (activeTab.value) {
    case 'score': return (player.total_score || 0) + ' 分'
    case 'winRate':
      if (!player.total_games) return '0%'
      return Math.round((player.win_games / player.total_games) * 100) + '%'
    case 'games': return (player.total_games || 0) + ' 局'
    case 'expense': return (player.total_expense || 0).toFixed(0) + ' 元'
    default: return ''
  }
}

function getMedal(index) {
  if (index === 0) return '🥇'
  if (index === 1) return '🥈'
  if (index === 2) return '🥉'
  return index + 1
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">榜单</h1>

    <div class="tab-switch">
      <button v-for="tab in tabs" :key="tab.key"
        class="tab-btn" :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key">
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="rankedPlayers.length === 0" class="empty">暂无数据</div>

    <div v-else class="rank-list">
      <div v-for="(player, index) in rankedPlayers" :key="player.id" class="card rank-card">
        <div class="rank-num" :class="{ top3: index < 3 }">{{ getMedal(index) }}</div>
        <div class="rank-info">
          <div class="avatar" :style="{ background: getAvatar(player) }">
            {{ player.nickname.charAt(0) }}
          </div>
          <div class="rank-name">{{ player.nickname }}</div>
        </div>
        <div class="rank-value">{{ getValue(player) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-switch {
  display: flex; gap: 0; background: var(--primary-light);
  border-radius: 10px; padding: 3px; margin-bottom: 16px;
}
.tab-btn {
  flex: 1; padding: 8px; border: none; background: transparent;
  border-radius: 8px; font-size: 14px; font-weight: 500;
  cursor: pointer; color: var(--text-secondary);
}
.tab-btn.active { background: var(--primary); color: #fff; }
.rank-list { display: flex; flex-direction: column; gap: 0; }
.rank-card { display: flex; align-items: center; gap: 12px; }
.rank-num {
  width: 32px; text-align: center; font-size: 16px;
  font-weight: 700; color: var(--text-secondary);
}
.rank-num.top3 { font-size: 22px; }
.rank-info { display: flex; align-items: center; gap: 10px; flex: 1; }
.avatar {
  width: 38px; height: 38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 16px; font-weight: 700;
}
.rank-name { font-weight: 600; font-size: 15px; }
.rank-value { font-weight: 700; font-size: 15px; color: var(--primary); }
.loading { text-align: center; padding: 40px; color: var(--text-secondary); }
.empty { text-align: center; padding: 60px; color: var(--text-secondary); }
</style>
