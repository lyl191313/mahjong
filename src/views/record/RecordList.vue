<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase.js'

const router = useRouter()
const loading = ref(true)
const games = ref([])
const searchPlayer = ref('')
const dateFrom = ref('')
const dateTo = ref('')

onMounted(async () => {
  await fetchGames()
})

async function fetchGames() {
  loading.value = true
  let query = supabase
    .from('games')
    .select('*, game_players(*, players(nickname))')
    .eq('status', 'finished')
    .order('ended_at', { ascending: false })

  const { data, error } = await query
  if (!error) games.value = data || []
  loading.value = false
}

const filteredGames = computed(() => {
  let list = games.value

  if (searchPlayer.value) {
    const q = searchPlayer.value.toLowerCase()
    list = list.filter(g =>
      g.game_players?.some(gp => gp.players?.nickname?.toLowerCase().includes(q))
    )
  }

  if (dateFrom.value) {
    list = list.filter(g => g.ended_at >= dateFrom.value)
  }
  if (dateTo.value) {
    list = list.filter(g => g.ended_at <= dateTo.value + 'T23:59:59')
  }

  return list
})

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getPlayerNames(game) {
  const active = game.game_players
    ?.filter(gp => !gp.is_replaced)
    ?.map(gp => gp.players?.nickname)
    ?.filter(Boolean) || []
  const replaced = game.game_players
    ?.filter(gp => gp.is_replaced)
    ?.map(gp => gp.players?.nickname + '(替)')
    ?.filter(Boolean) || []
  return [...active, ...replaced].join('、') || '-'
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">牌局记录</h1>

    <div class="filters">
      <input v-model="searchPlayer" class="input" placeholder="按玩家昵称筛选..." />
      <div class="date-filters">
        <input v-model="dateFrom" type="date" class="input date-input" />
        <span class="date-sep">至</span>
        <input v-model="dateTo" type="date" class="input date-input" />
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="filteredGames.length === 0" class="empty">暂无牌局记录</div>

    <div v-else class="game-list">
      <div v-for="game in filteredGames" :key="game.id" class="card game-card"
        @click="router.push(`/records/${game.id}`)">
        <div class="game-header">
          <span class="game-date">{{ formatDate(game.ended_at) }}</span>
          <span class="game-score">总赢分 {{ game.total_win_score || 0 }}</span>
        </div>
        <div class="game-players">{{ getPlayerNames(game) }}</div>
        <div class="game-footer">
          <span v-if="game.meal_cost">饭钱 {{ game.meal_cost }}元</span>
          <span v-if="game.extra_cost">额外 {{ game.extra_cost }}元</span>
          <span v-if="game.remark" class="game-remark">{{ game.remark }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filters { margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
.date-filters { display: flex; align-items: center; gap: 8px; }
.date-input { flex: 1; font-size: 13px; }
.date-sep { color: var(--text-secondary); font-size: 13px; }
.game-list { display: flex; flex-direction: column; gap: 0; }
.game-card { cursor: pointer; }
.game-card:active { opacity: 0.8; }
.game-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.game-date { font-size: 13px; color: var(--text-secondary); }
.game-score { font-size: 14px; font-weight: 700; color: var(--primary); }
.game-players { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.game-footer { display: flex; gap: 12px; font-size: 12px; color: var(--text-secondary); }
.game-remark {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;
}
.loading { text-align: center; padding: 40px; color: var(--text-secondary); }
.empty { text-align: center; padding: 60px; color: var(--text-secondary); }
</style>
