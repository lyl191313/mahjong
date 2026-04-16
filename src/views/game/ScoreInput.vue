<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const gameId = route.params.gameId
const loading = ref(true)
const scores = ref([])

const seatLabels = { east: '东', south: '南', west: '西', north: '北' }

onMounted(async () => {
  await gameStore.loadGame(gameId)
  scores.value = gameStore.gamePlayers
    .filter(gp => !gp.is_replaced)
    .map(gp => ({
      playerId: gp.player_id,
      nickname: gp.players?.nickname || '未知',
      seat: gp.seat,
      score: '',
    }))
  loading.value = false
})

const totalScore = computed(() => {
  return scores.value.reduce((sum, s) => sum + (Number(s.score) || 0), 0)
})

const isValid = computed(() => {
  return scores.value.every(s => s.score !== '' && !isNaN(s.score)) && totalScore.value === 0
})

function getAvatar(player) {
  const colors = ['#4361ee', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']
  const idx = player.nickname.charCodeAt(0) % colors.length
  return colors[idx]
}

function submit() {
  if (!isValid.value) return
  const scoreData = scores.value.map(s => ({
    playerId: s.playerId,
    score: Number(s.score),
  }))
  // 将分数存到 query 传给结算页
  const encoded = encodeURIComponent(JSON.stringify(scoreData))
  router.push(`/settle/${gameId}?scores=${encoded}`)
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">计分面板</h1>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else>
      <div class="score-list">
        <div v-for="s in scores" :key="s.playerId" class="card score-card">
          <div class="score-player">
            <div class="avatar" :style="{ background: getAvatar(s) }">
              {{ s.nickname.charAt(0) }}
            </div>
            <div>
              <div class="player-name">{{ s.nickname }}</div>
              <div class="player-seat">{{ seatLabels[s.seat] }}</div>
            </div>
          </div>
          <div class="score-input-wrap">
            <input v-model="s.score" type="number" class="input score-input"
              placeholder="输入得分" />
          </div>
        </div>
      </div>

      <div class="total-check" :class="{ valid: totalScore === 0, invalid: totalScore !== 0 && scores.every(s => s.score !== '') }">
        <span>得分总和：{{ totalScore }}</span>
        <span v-if="totalScore === 0 && scores.every(s => s.score !== '')" class="check-ok">零和校验通过</span>
        <span v-else-if="scores.every(s => s.score !== '')" class="check-fail">四人得分之和应为 0</span>
      </div>

      <button class="btn btn-primary btn-block" :disabled="!isValid" @click="submit"
        style="margin-top: 16px;">
        确认得分，进入结算
      </button>
    </template>
  </div>
</template>

<style scoped>
.score-list { display: flex; flex-direction: column; gap: 0; }
.score-card { display: flex; align-items: center; justify-content: space-between; }
.score-player { display: flex; align-items: center; gap: 10px; }
.avatar {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 16px; font-weight: 700;
}
.player-name { font-weight: 600; font-size: 15px; }
.player-seat { font-size: 12px; color: var(--text-secondary); }
.score-input-wrap { width: 120px; }
.score-input { text-align: center; font-size: 18px; font-weight: 700; }
.total-check {
  text-align: center; padding: 12px; border-radius: 8px;
  font-size: 15px; font-weight: 600; margin-top: 12px;
  background: var(--primary-light);
}
.total-check.valid { background: #f0fdf4; color: #15803d; }
.total-check.invalid { background: #fef2f2; color: #dc2626; }
.check-ok { margin-left: 8px; }
.check-fail { margin-left: 8px; }
.loading { text-align: center; padding: 40px; color: var(--text-secondary); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
