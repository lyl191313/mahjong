<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayersStore } from '../../stores/players.js'
import { useGameStore } from '../../stores/game.js'

const router = useRouter()
const playersStore = usePlayersStore()
const gameStore = useGameStore()
const searchQuery = ref('')
const selected = ref([])
const creating = ref(false)

onMounted(() => {
  playersStore.fetchPlayers()
})

const filteredPlayers = computed(() => {
  if (!searchQuery.value) return playersStore.players
  return playersStore.players.filter(p =>
    p.nickname.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

function isSelected(player) {
  return selected.value.includes(player.id)
}

function toggleSelect(player) {
  const idx = selected.value.indexOf(player.id)
  if (idx !== -1) {
    selected.value.splice(idx, 1)
  } else {
    if (selected.value.length >= 4) return
    selected.value.push(player.id)
  }
}

function getAvatar(player) {
  const colors = ['#4361ee', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']
  const idx = player.nickname.charCodeAt(0) % colors.length
  return colors[idx]
}

function selectedPlayers() {
  return selected.value.map(id => playersStore.players.find(p => p.id === id)).filter(Boolean)
}

async function startGame() {
  if (selected.value.length !== 4 || creating.value) return
  creating.value = true
  try {
    // 先进入座位分配页面，不直接创建游戏
    const playerIds = selected.value.join(',')
    router.push(`/seat/new?players=${playerIds}`)
  } catch (e) {
    alert('开局失败：' + e.message)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">开局选人</h1>

    <div class="search-bar">
      <input v-model="searchQuery" class="input" placeholder="搜索牌友..." />
    </div>

    <div class="selected-info">
      <span class="selected-count">已选 <strong>{{ selected.length }}</strong> / 4 人</span>
      <div v-if="selected.length > 0" class="selected-avatars">
        <div v-for="p in selectedPlayers()" :key="p.id" class="selected-tag">
          {{ p.nickname }}
          <span class="remove-tag" @click.stop="toggleSelect(p)">&times;</span>
        </div>
      </div>
    </div>

    <div class="player-list">
      <div v-for="player in filteredPlayers" :key="player.id"
        class="card player-card"
        :class="{ selected: isSelected(player), disabled: !isSelected(player) && selected.length >= 4 }"
        @click="toggleSelect(player)">
        <div class="player-info">
          <div class="check-box" :class="{ checked: isSelected(player) }">
            <span v-if="isSelected(player)">&#10003;</span>
          </div>
          <div class="avatar" :style="{ background: getAvatar(player) }">
            {{ player.nickname.charAt(0) }}
          </div>
          <div class="player-detail">
            <div class="player-name">{{ player.nickname }}</div>
            <div class="player-stats">
              <span>{{ player.total_games || 0 }}局</span>
              <span>总分 {{ player.total_score || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="filteredPlayers.length === 0" class="empty">
      <p>{{ searchQuery ? '未找到牌友' : '暂无牌友，请先添加' }}</p>
    </div>

    <div class="bottom-bar">
      <button class="btn btn-primary btn-block"
        :disabled="selected.length !== 4 || creating"
        @click="startGame">
        {{ creating ? '创建中...' : '一键开局' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.search-bar { margin-bottom: 12px; }
.selected-info {
  margin-bottom: 12px; padding: 12px;
  background: var(--primary-light); border-radius: 8px;
}
.selected-count { font-size: 14px; color: var(--text-secondary); }
.selected-count strong { color: var(--primary); font-size: 18px; }
.selected-avatars { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.selected-tag {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--primary); color: #fff;
  padding: 4px 10px; border-radius: 16px; font-size: 13px;
}
.remove-tag { cursor: pointer; font-size: 16px; margin-left: 2px; }
.player-list { padding-bottom: 80px; }
.player-card {
  display: flex; align-items: center; cursor: pointer;
  transition: all 0.2s;
}
.player-card.selected {
  border: 2px solid var(--primary); background: var(--primary-light);
}
.player-card.disabled { opacity: 0.5; }
.player-info { display: flex; align-items: center; gap: 12px; }
.check-box {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--border); display: flex;
  align-items: center; justify-content: center;
  font-size: 14px; flex-shrink: 0; color: #fff;
}
.check-box.checked { background: var(--primary); border-color: var(--primary); }
.avatar {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 16px; font-weight: 700; flex-shrink: 0;
}
.player-detail { min-width: 0; }
.player-name { font-weight: 600; font-size: 15px; }
.player-stats { display: flex; gap: 8px; font-size: 12px; color: var(--text-secondary); }
.empty { text-align: center; padding: 40px; color: var(--text-secondary); }
.bottom-bar {
  position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 480px; padding: 12px 16px;
  background: #fff; border-top: 1px solid var(--border);
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
