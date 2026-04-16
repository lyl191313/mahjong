<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase.js'

const route = useRoute()
const router = useRouter()
const gameId = route.params.gameId
const loading = ref(true)
const game = ref(null)
const gamePlayers = ref([])
const replacements = ref([])

const seatLabels = { east: '东', south: '南', west: '西', north: '北' }

onMounted(async () => {
  const { data: g } = await supabase.from('games').select('*').eq('id', gameId).single()
  game.value = g

  const { data: gp } = await supabase
    .from('game_players')
    .select('*, players(nickname, avatar)')
    .eq('game_id', gameId)
  gamePlayers.value = gp || []

  const { data: rp } = await supabase
    .from('replacements')
    .select('*, out_player:players!replacements_out_player_id_fkey(nickname), in_player:players!replacements_in_player_id_fkey(nickname)')
    .eq('game_id', gameId)
  replacements.value = rp || []

  loading.value = false
})

const activePlayers = computed(() => gamePlayers.value.filter(gp => !gp.is_replaced))
const replacedPlayers = computed(() => gamePlayers.value.filter(gp => gp.is_replaced))

function getAvatar(gp) {
  const name = gp.players?.nickname || '?'
  const colors = ['#4361ee', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']
  return colors[name.charCodeAt(0) % colors.length]
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 结算明细计算
const totalWinScore = computed(() => activePlayers.value.filter(p => p.score > 0).reduce((s, p) => s + p.score, 0))
const totalWinAmount = computed(() => totalWinScore.value * 5)
const distributable = computed(() => totalWinAmount.value - (game.value?.meal_cost || 0))

const ratioInfo = computed(() => {
  const s = distributable.value
  if (s <= 0) return { winnerRatio: 0, loserRatio: 0, label: '不分配' }
  if (s < 100) return { winnerRatio: 0.5, loserRatio: 0.5, label: '均衡 50/50' }
  if (s < 200) return { winnerRatio: 0.4, loserRatio: 0.6, label: '倾斜 40/60' }
  return { winnerRatio: 0.3, loserRatio: 0.7, label: '补偿 30/70' }
})
</script>

<template>
  <div class="page">
    <div class="nav-back" @click="router.push('/records')">← 返回列表</div>
    <h1 class="page-title">牌局详情</h1>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else-if="game">
      <!-- 基本信息 -->
      <div class="card">
        <div class="detail-row">
          <span class="label">开局时间</span>
          <span>{{ formatDate(game.created_at) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">结束时间</span>
          <span>{{ formatDate(game.ended_at) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">总赢分</span>
          <span class="primary">{{ game.total_win_score || 0 }}</span>
        </div>
        <div class="detail-row">
          <span class="label">饭钱</span>
          <span>{{ game.meal_cost || 0 }} 元</span>
        </div>
        <div v-if="game.extra_cost" class="detail-row">
          <span class="label">额外消费</span>
          <span>{{ game.extra_cost }} 元</span>
        </div>
        <div v-if="game.remark" class="detail-row">
          <span class="label">备注</span>
          <span>{{ game.remark }}</span>
        </div>
      </div>

      <!-- 玩家得分 -->
      <div class="card">
        <div class="section-label">玩家得分与结算</div>
        <div v-for="gp in activePlayers" :key="gp.id" class="player-row">
          <div class="player-left">
            <div class="avatar" :style="{ background: getAvatar(gp) }">
              {{ (gp.players?.nickname || '?').charAt(0) }}
            </div>
            <div>
              <div class="player-name">
                {{ gp.players?.nickname || '未知' }}
                <span class="seat-tag">{{ seatLabels[gp.seat] }}</span>
                <span v-if="gp.is_replacer" class="replacer-tag">替补</span>
              </div>
            </div>
          </div>
          <div class="player-right">
            <div class="score" :class="{ win: gp.score > 0, lose: gp.score < 0 }">
              {{ gp.score > 0 ? '+' : '' }}{{ gp.score || 0 }}分
            </div>
            <div class="settle-amount" v-if="gp.settlement_amount">
              分得 {{ gp.settlement_amount }} 元
            </div>
          </div>
        </div>

        <!-- 被替换的玩家 -->
        <template v-if="replacedPlayers.length > 0">
          <div class="divider"></div>
          <div class="section-label">被替换玩家（分数已冻结）</div>
          <div v-for="gp in replacedPlayers" :key="gp.id" class="player-row replaced">
            <div class="player-left">
              <div class="avatar" :style="{ background: getAvatar(gp), opacity: 0.6 }">
                {{ (gp.players?.nickname || '?').charAt(0) }}
              </div>
              <div class="player-name">{{ gp.players?.nickname || '未知' }}</div>
            </div>
            <div class="player-right">
              <div class="score">冻结 {{ gp.score || 0 }}分</div>
              <div class="settle-amount" v-if="gp.settlement_amount">
                分得 {{ gp.settlement_amount }} 元
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 结算明细 -->
      <div class="card" v-if="distributable > 0">
        <div class="section-label">结算明细</div>
        <div class="detail-row">
          <span class="label">总赢金额</span>
          <span>{{ totalWinAmount }} 元</span>
        </div>
        <div class="detail-row">
          <span class="label">可分配额</span>
          <span class="primary">{{ distributable }} 元</span>
        </div>
        <div class="detail-row">
          <span class="label">分配策略</span>
          <span>{{ ratioInfo.label }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nav-back {
  font-size: 14px; color: var(--primary); cursor: pointer;
  margin-bottom: 8px; padding: 4px 0;
}
.detail-row {
  display: flex; justify-content: space-between;
  padding: 6px 0; font-size: 14px;
}
.label { color: var(--text-secondary); }
.primary { color: var(--primary); font-weight: 700; }
.section-label { font-size: 14px; font-weight: 700; color: var(--text-secondary); margin-bottom: 12px; }
.player-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px solid var(--border);
}
.player-row:last-child { border-bottom: none; }
.player-row.replaced { opacity: 0.6; }
.player-left { display: flex; align-items: center; gap: 10px; }
.avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 14px; font-weight: 700;
}
.player-name { font-weight: 600; font-size: 14px; }
.seat-tag {
  display: inline-block; background: var(--primary-light); color: var(--primary);
  padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-left: 4px;
}
.replacer-tag {
  display: inline-block; background: #fef3c7; color: #d97706;
  padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-left: 4px;
}
.player-right { text-align: right; }
.score { font-weight: 700; font-size: 15px; }
.score.win { color: var(--success); }
.score.lose { color: var(--danger); }
.settle-amount { font-size: 12px; color: var(--text-secondary); }
.divider { height: 1px; background: var(--border); margin: 12px 0; }
.loading { text-align: center; padding: 40px; color: var(--text-secondary); }
</style>
