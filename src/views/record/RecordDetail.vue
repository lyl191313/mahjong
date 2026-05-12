<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import html2canvas from 'html2canvas'
import { supabase } from '../../lib/supabase.js'

const route = useRoute()
const router = useRouter()
const gameId = route.params.gameId
const loading = ref(true)
const game = ref(null)
const gamePlayers = ref([])
const replacements = ref([])
const captureRoot = ref(null)
const exporting = ref(false)

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

async function exportScreenshot() {
  const el = captureRoot.value
  if (!el || !game.value) return
  exporting.value = true
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
    await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('empty'))
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const safeTime = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
        a.href = url
        a.download = `牌局-${gameId}-${safeTime}.png`
        a.click()
        URL.revokeObjectURL(url)
        resolve()
      }, 'image/png')
    })
  } catch (e) {
    console.error(e)
    alert('截图失败，请稍后重试')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="nav-back" @click="router.push('/records')">← 返回列表</div>
    <div class="title-row">
      <h1 class="page-title">牌局详情</h1>
      <button
        v-if="!loading && game"
        type="button"
        class="btn-export"
        :disabled="exporting"
        @click="exportScreenshot"
      >
        {{ exporting ? '生成中…' : '保存截图' }}
      </button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else-if="game">
      <div ref="captureRoot" class="capture-stack">
      <!-- 概要：标题、编号与时间费用同卡，避免编号与标题抢宽断行 -->
      <div class="card card-shot-overview">
        <div class="shot-overview-head">
          <h2 class="shot-overview-title">牌局记录</h2>
          <div class="shot-id-wrap">
            <span class="shot-id-label">对局编号</span>
            <span class="shot-id-value">{{ gameId }}</span>
          </div>
        </div>
        <div class="detail-row">
          <span class="label">开局时间</span>
          <span class="value">{{ formatDate(game.created_at) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">结束时间</span>
          <span class="value">{{ formatDate(game.ended_at) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">总赢分</span>
          <span class="value">{{ game.total_win_score || 0 }}</span>
        </div>
        <div class="detail-row">
          <span class="label">饭钱</span>
          <span class="value">{{ game.meal_cost || 0 }} 元</span>
        </div>
        <div v-if="game.extra_cost" class="detail-row">
          <span class="label">额外消费</span>
          <span class="value">{{ game.extra_cost }} 元</span>
        </div>
        <div v-if="game.remark" class="detail-row detail-row-remark">
          <span class="label">备注</span>
          <span class="value value-remark">{{ game.remark }}</span>
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
          <span class="value">{{ totalWinAmount }} 元</span>
        </div>
        <div class="detail-row">
          <span class="label">可分配额</span>
          <span class="value value-em">{{ distributable }} 元</span>
        </div>
        <div class="detail-row">
          <span class="label">分配策略</span>
          <span class="value">{{ ratioInfo.label }}</span>
        </div>
      </div>

      <div v-if="replacements.length" class="card">
        <div class="section-label">换人记录</div>
        <div
          v-for="r in replacements"
          :key="r.id"
          class="replace-line"
        >
          {{ r.out_player?.nickname || '?' }} → {{ r.in_player?.nickname || '?' }}，冻结 {{ r.frozen_score ?? 0 }} 分
        </div>
      </div>

      <p class="capture-footer">截图生成于 {{ formatDate(new Date().toISOString()) }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nav-back {
  font-size: 14px; color: var(--primary); cursor: pointer;
  margin-bottom: 8px; padding: 4px 0;
}
.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.title-row .page-title {
  margin: 0;
  flex: 1;
}
.btn-export {
  flex-shrink: 0;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-light);
  border: 1px solid var(--primary);
  border-radius: 10px;
  cursor: pointer;
}
.btn-export:active {
  opacity: 0.85;
}
.btn-export:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.capture-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.card-shot-overview {
  padding-top: 14px;
}
.shot-overview-head {
  padding-bottom: 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.shot-overview-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 10px;
  line-height: 1.3;
}
.shot-id-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.shot-id-label {
  font-size: 12px;
  color: var(--text-secondary);
}
.shot-id-value {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  word-break: break-all;
  overflow-wrap: anywhere;
}
.capture-footer {
  font-size: 11px;
  color: #94a3b8;
  text-align: center;
  margin: 12px 0 4px;
  padding: 10px 8px 0;
  border-top: 1px dashed var(--border);
}
.replace-line {
  font-size: 14px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}
.replace-line:last-child {
  border-bottom: none;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}
.detail-row:last-child {
  border-bottom: none;
}
.label {
  flex-shrink: 0;
  color: var(--text-secondary);
  max-width: 42%;
}
.value {
  text-align: right;
  font-weight: 600;
  color: var(--text);
  min-width: 0;
  word-break: break-word;
}
.value-em {
  color: var(--primary);
}
.detail-row-remark {
  align-items: flex-start;
}
.value-remark {
  font-weight: 500;
  white-space: pre-wrap;
}
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
