<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'
import { getAvatarStyle, showAvatarLetter } from '../../lib/avatarDisplay.js'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const gameId = route.params.gameId
const loading = ref(true)
const scores = ref([])

const seatLabels = { east: '东', south: '南', west: '西', north: '北' }

onMounted(async () => {
  await gameStore.loadGame(gameId)
  // 被替换的玩家在前（分数已冻结），场上玩家在后
  const replaced = gameStore.gamePlayers
    .filter(gp => gp.is_replaced)
    .map(gp => ({
      playerId: gp.player_id,
      nickname: gp.players?.nickname || '未知',
      avatar: gp.players?.avatar ?? null,
      seat: gp.seat,
      score: gp.score || 0,
      isReplaced: true,
    }))
  const active = gameStore.gamePlayers
    .filter(gp => !gp.is_replaced)
    .map(gp => ({
      playerId: gp.player_id,
      nickname: gp.players?.nickname || '未知',
      avatar: gp.players?.avatar ?? null,
      seat: gp.seat,
      score: '',
      isReplaced: false,
    }))
  scores.value = [...replaced, ...active]
  loading.value = false
})

const totalScore = computed(() => {
  return scores.value.reduce((sum, s) => sum + (Number(s.score) || 0), 0)
})

const isValid = computed(() => {
  return scores.value.every(s => s.score !== '' && !isNaN(s.score)) && totalScore.value === 0
})

const activePlayers = computed(() => scores.value.filter(s => !s.isReplaced))
const replacedPlayers = computed(() => scores.value.filter(s => s.isReplaced))

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
      <!-- 被替换的玩家（分数已冻结） -->
      <template v-if="replacedPlayers.length > 0">
        <div class="section-label">已替换玩家（分数已冻结）</div>
        <div class="score-list">
          <div v-for="s in replacedPlayers" :key="s.playerId" class="card score-card replaced">
            <div class="score-player">
              <div class="avatar avatar-row" :class="{ 'is-replaced': s.isReplaced }" :style="getAvatarStyle(s)">
                <span v-if="showAvatarLetter(s)">{{ s.nickname.charAt(0) }}</span>
              </div>
              <div>
                <div class="player-name">{{ s.nickname }} <span class="replaced-tag">已替换</span></div>
                <div class="player-seat">{{ seatLabels[s.seat] }}</div>
              </div>
            </div>
            <div class="score-input-wrap">
              <div class="frozen-score">{{ s.score }} 分</div>
            </div>
          </div>
        </div>
      </template>

      <!-- 场上玩家 -->
      <div v-if="replacedPlayers.length > 0" class="section-label" style="margin-top: 16px;">场上玩家</div>
      <div class="score-list">
        <div v-for="s in activePlayers" :key="s.playerId" class="card score-card">
          <div class="score-player">
            <div class="avatar avatar-row" :style="getAvatarStyle(s)">
              <span v-if="showAvatarLetter(s)">{{ s.nickname.charAt(0) }}</span>
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
        <span v-else-if="scores.every(s => s.score !== '')" class="check-fail">所有玩家得分之和应为 0</span>
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
  overflow: hidden;
}
.avatar-row.is-replaced {
  opacity: 0.6;
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
.section-label { font-size: 14px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; }
.score-card.replaced { opacity: 0.7; }
.replaced-tag {
  display: inline-block; background: #fef3c7; color: #d97706;
  padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-left: 4px;
}
.frozen-score { font-size: 16px; font-weight: 700; color: var(--text-secondary); text-align: center; }
</style>
