<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const gameId = route.params.gameId
const loading = ref(true)
const submitting = ref(false)

const scores = ref([])
const mealCost = ref('')
const extraCost = ref('')
const remark = ref('')

const seatLabels = { east: '东', south: '南', west: '西', north: '北' }

onMounted(async () => {
  await gameStore.loadGame(gameId)
  // 从 query 读取分数
  const scoreData = JSON.parse(decodeURIComponent(route.query.scores || '[]'))
  scores.value = scoreData.map(s => {
    const gp = gameStore.gamePlayers.find(g => g.player_id === s.playerId && !g.is_replaced)
    return {
      playerId: s.playerId,
      nickname: gp?.players?.nickname || '未知',
      seat: gp?.seat || '',
      score: s.score,
    }
  })
  loading.value = false
})

const totalWinScore = computed(() => scores.value.filter(s => s.score > 0).reduce((sum, s) => sum + s.score, 0))
const totalWinAmount = computed(() => totalWinScore.value * 5)
const distributable = computed(() => totalWinAmount.value - (Number(mealCost.value) || 0))

const ratioInfo = computed(() => {
  const s = distributable.value
  if (s <= 0) return { winnerRatio: 0, loserRatio: 0, label: '不分配' }
  if (s < 100) return { winnerRatio: 0.5, loserRatio: 0.5, label: '均衡分配 (50/50)' }
  if (s < 200) return { winnerRatio: 0.4, loserRatio: 0.6, label: '向输家倾斜 (40/60)' }
  return { winnerRatio: 0.3, loserRatio: 0.7, label: '加大输家补偿 (30/70)' }
})

const settlement = computed(() => {
  const s = distributable.value
  if (s <= 0) return scores.value.map(p => ({ ...p, amount: 0 }))

  const { winnerRatio, loserRatio } = ratioInfo.value
  const winnerPool = s * winnerRatio
  const loserPool = s * loserRatio
  const totalLose = Math.abs(scores.value.filter(p => p.score < 0).reduce((sum, p) => sum + p.score, 0))

  return scores.value.map(p => {
    let amount = 0
    if (p.score > 0) amount = winnerPool * (p.score / totalWinScore.value)
    else if (p.score < 0 && totalLose > 0) amount = loserPool * (Math.abs(p.score) / totalLose)
    return { ...p, amount: Math.round(amount * 100) / 100 }
  })
})

function getAvatar(player) {
  const colors = ['#4361ee', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']
  const idx = player.nickname.charCodeAt(0) % colors.length
  return colors[idx]
}

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    const scoreData = scores.value.map(s => ({ playerId: s.playerId, score: s.score }))
    await gameStore.finishGame(gameId, scoreData, Number(mealCost.value) || 0, Number(extraCost.value) || 0, remark.value)
    router.push(`/records/${gameId}`)
  } catch (e) {
    alert('结算失败：' + e.message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">聚餐结算</h1>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else>
      <!-- 得分概览 -->
      <div class="card">
        <div class="section-label">得分概览</div>
        <div class="score-overview">
          <div v-for="s in scores" :key="s.playerId" class="score-row">
            <span class="name">{{ s.nickname }}（{{ seatLabels[s.seat] }}）</span>
            <span class="score" :class="{ win: s.score > 0, lose: s.score < 0 }">
              {{ s.score > 0 ? '+' : '' }}{{ s.score }}
            </span>
          </div>
        </div>
      </div>

      <!-- 费用输入 -->
      <div class="card">
        <div class="section-label">费用信息</div>
        <div class="form-row">
          <label>饭钱（元）</label>
          <input v-model="mealCost" type="number" class="input" placeholder="0" />
        </div>
        <div class="form-row">
          <label>额外消费（仅记录）</label>
          <input v-model="extraCost" type="number" class="input" placeholder="0" />
        </div>
        <div class="form-row">
          <label>对局备注</label>
          <input v-model="remark" class="input" placeholder="选填" />
        </div>
      </div>

      <!-- 结算明细 -->
      <div class="card">
        <div class="section-label">结算明细</div>
        <div class="settle-info">
          <div class="info-row">
            <span>总赢金额</span>
            <span>{{ totalWinAmount }} 元</span>
          </div>
          <div class="info-row">
            <span>饭钱</span>
            <span>-{{ Number(mealCost) || 0 }} 元</span>
          </div>
          <div class="info-row highlight">
            <span>可分配额</span>
            <span>{{ distributable }} 元</span>
          </div>
          <div class="info-row">
            <span>分配策略</span>
            <span>{{ ratioInfo.label }}</span>
          </div>
        </div>

        <div v-if="distributable > 0" class="settle-detail">
          <div class="pool-section">
            <div class="pool-title win-pool">赢家池 {{ Math.round(distributable * ratioInfo.winnerRatio) }} 元</div>
            <div v-for="s in settlement.filter(x => x.score > 0)" :key="s.playerId" class="pool-row">
              <span>{{ s.nickname }}</span>
              <span class="amount win">+{{ s.amount }} 元</span>
            </div>
          </div>
          <div class="pool-section">
            <div class="pool-title lose-pool">输家池 {{ Math.round(distributable * ratioInfo.loserRatio) }} 元（补偿）</div>
            <div v-for="s in settlement.filter(x => x.score < 0)" :key="s.playerId" class="pool-row">
              <span>{{ s.nickname }}</span>
              <span class="amount lose">+{{ s.amount }} 元</span>
            </div>
          </div>
        </div>
        <div v-else class="no-distribute">
          饭钱 >= 总赢金额，本局不进行赢输分配
        </div>
      </div>

      <button class="btn btn-success btn-block" :disabled="submitting" @click="submit"
        style="margin-top: 16px;">
        {{ submitting ? '提交中...' : '确认结算' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.section-label { font-size: 14px; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px; }
.score-overview { display: flex; flex-direction: column; gap: 8px; }
.score-row { display: flex; justify-content: space-between; font-size: 15px; }
.score .win { color: var(--success); font-weight: 700; }
.score .lose { color: var(--danger); font-weight: 700; }
.win { color: var(--success); font-weight: 700; }
.lose { color: var(--danger); font-weight: 700; }
.form-row { margin-bottom: 12px; }
.form-row label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }
.settle-info { display: flex; flex-direction: column; gap: 8px; }
.info-row { display: flex; justify-content: space-between; font-size: 14px; }
.info-row.highlight { font-weight: 700; font-size: 16px; color: var(--primary); }
.settle-detail { margin-top: 16px; }
.pool-section { margin-bottom: 12px; }
.pool-title {
  font-size: 13px; font-weight: 700; padding: 6px 10px;
  border-radius: 6px; margin-bottom: 6px;
}
.win-pool { background: #f0fdf4; color: #15803d; }
.lose-pool { background: #fef2f2; color: #dc2626; }
.pool-row { display: flex; justify-content: space-between; padding: 4px 10px; font-size: 14px; }
.amount { font-weight: 600; }
.no-distribute {
  text-align: center; padding: 16px; color: var(--text-secondary);
  background: #f9fafb; border-radius: 8px; margin-top: 12px; font-size: 14px;
}
.loading { text-align: center; padding: 40px; color: var(--text-secondary); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
