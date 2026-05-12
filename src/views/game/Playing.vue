<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'
import { usePlayersStore } from '../../stores/players.js'
import { getAvatarStyle, showAvatarLetter } from '../../lib/avatarDisplay.js'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const playersStore = usePlayersStore()
const gameId = route.params.gameId
const loading = ref(true)
const showReplace = ref(false)
const replaceSeat = ref(null)
const replaceOutPlayer = ref(null)
const availablePlayers = ref([])
const selectedReplacer = ref(null)
const frozenScore = ref(0)

const seatLabels = { east: '东', south: '南', west: '西', north: '北' }

onMounted(async () => {
  await gameStore.loadGame(gameId)
  loading.value = false
})

function getName(gp) {
  return gp.players?.nickname || '未知'
}

function getPlayerBySeat(seat) {
  return gameStore.gamePlayers.find(p => p.seat === seat && !p.is_replaced)
}

function endGame() {
  router.push(`/score/${gameId}`)
}

async function openReplace(seat) {
  const gp = getPlayerBySeat(seat)
  if (!gp) return
  replaceOutPlayer.value = gp
  replaceSeat.value = seat
  frozenScore.value = gp.score || 0
  await playersStore.fetchAllPlayers()
  const currentIds = gameStore.gamePlayers.filter(p => !p.is_replaced).map(p => p.player_id)
  availablePlayers.value = playersStore.players.filter(p => !currentIds.includes(p.id))
  showReplace.value = true
}

async function confirmReplace() {
  if (!selectedReplacer.value) return
  await gameStore.replacePlayer(
    gameId,
    replaceOutPlayer.value.player_id,
    selectedReplacer.value,
    frozenScore.value,
    replaceSeat.value
  )
  await gameStore.loadGame(gameId)
  showReplace.value = false
  selectedReplacer.value = null
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">对局进行中</h1>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else>
      <div class="table-container">
        <div class="mahjong-table">
          <div v-for="seat in ['north', 'west', 'east', 'south']" :key="seat"
            class="seat-slot" :class="seat">
            <template v-if="getPlayerBySeat(seat)">
              <div class="seat-avatar" :style="getAvatarStyle(getPlayerBySeat(seat))">
                <span v-if="showAvatarLetter(getPlayerBySeat(seat))">{{ getName(getPlayerBySeat(seat)).charAt(0) }}</span>
              </div>
              <div class="seat-name">{{ getName(getPlayerBySeat(seat)) }}</div>
              <div class="seat-score">{{ getPlayerBySeat(seat).score || 0 }}分</div>
              <button class="btn btn-sm btn-outline replace-btn" @click="openReplace(seat)">替换</button>
            </template>
            <div class="seat-label">{{ seatLabels[seat] }}</div>
          </div>
          <div class="table-center">牌桌</div>
        </div>
      </div>

      <button class="btn btn-danger btn-block" @click="endGame" style="margin-top: 24px;">
        结束对局
      </button>
    </template>

    <!-- 替换弹窗 -->
    <div v-if="showReplace" class="modal-overlay" @click.self="showReplace = false">
      <div class="modal">
        <h3 class="modal-title">替换玩家</h3>
        <p class="replace-info">
          将 <strong>{{ getName(replaceOutPlayer) }}</strong> 替换下场
        </p>
        <div class="form-row">
          <label>冻结分数</label>
          <input v-model.number="frozenScore" type="number" class="input" placeholder="输入当前得分" />
        </div>
        <div class="replace-list">
          <div v-for="p in availablePlayers" :key="p.id"
            class="replace-item" :class="{ selected: selectedReplacer === p.id }"
            @click="selectedReplacer = p.id">
            <span>{{ p.nickname }}</span>
          </div>
          <div v-if="availablePlayers.length === 0" class="empty-hint">没有可替换的玩家</div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showReplace = false">取消</button>
          <button class="btn btn-primary" :disabled="!selectedReplacer" @click="confirmReplace">确认替换</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-container { padding: 20px 0; }
.mahjong-table {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: auto auto auto; gap: 12px;
  max-width: 340px; margin: 0 auto;
}
.seat-slot {
  display: flex; flex-direction: column; align-items: center;
  gap: 4px; padding: 12px 8px;
  background: var(--primary-light); border-radius: 12px;
}
.seat-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 18px; font-weight: 700;
  overflow: hidden;
}
.seat-name { font-size: 14px; font-weight: 600; }
.seat-score { font-size: 13px; color: var(--text-secondary); }
.seat-label { font-size: 11px; color: var(--text-secondary); }
.replace-btn { margin-top: 4px; font-size: 11px; padding: 2px 8px; }
.north { grid-column: 2; grid-row: 1; }
.west { grid-column: 1; grid-row: 2; }
.table-center {
  grid-column: 2; grid-row: 2;
  background: var(--primary); color: #fff;
  border-radius: 12px; display: flex;
  align-items: center; justify-content: center;
  font-weight: 700; font-size: 16px;
}
.east { grid-column: 3; grid-row: 2; }
.south { grid-column: 2; grid-row: 3; }
.loading { text-align: center; padding: 40px; color: var(--text-secondary); }
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 20px;
}
.modal {
  background: #fff; border-radius: 16px; padding: 24px;
  width: 100%; max-width: 360px;
}
.modal-title { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
.replace-info { font-size: 14px; margin-bottom: 12px; color: var(--text-secondary); }
.replace-list { max-height: 200px; overflow-y: auto; margin-bottom: 16px; }
.replace-item {
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--border); margin-bottom: 6px;
}
.replace-item.selected { border-color: var(--primary); background: var(--primary-light); }
.empty-hint { text-align: center; padding: 20px; color: var(--text-secondary); font-size: 14px; }
.form-row { margin-bottom: 12px; }
.form-row label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
