<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayersStore } from '../../stores/players.js'
import { useGameStore } from '../../stores/game.js'

const route = useRoute()
const router = useRouter()
const playersStore = usePlayersStore()
const gameStore = useGameStore()

const seats = ['east', 'south', 'west', 'north']
const seatLabels = { east: '东', south: '南', west: '西', north: '北' }
const players = ref([]) // { id, nickname, avatar, seat }
const creating = ref(false)
const swapMode = ref(false)
const swapFirst = ref(null)

onMounted(async () => {
  const playerIds = route.query.players?.split(',') || []
  if (playerIds.length !== 4) {
    alert('需要选择4位玩家')
    router.push('/start')
    return
  }
  await playersStore.fetchAllPlayers()
  const selected = playerIds.map(id => playersStore.players.find(p => p.id === id)).filter(Boolean)
  if (selected.length !== 4) {
    alert('玩家数据异常')
    router.push('/start')
    return
  }
  autoAssign(selected)
})

function autoAssign(selectedPlayers) {
  // 智能分配：将胜率高的玩家分配到其不擅长的座位
  const playerScores = selectedPlayers.map(p => {
    const seatRates = {}
    for (const s of seats) {
      const data = p.seat_win_rate?.[s]
      seatRates[s] = data && data.total > 0 ? data.wins / data.total : 0.5
    }
    return { ...p, seatRates, recentTrend: p.total_score || 0 }
  })

  // 按总分降序排列（赢得多的优先分配到弱势座位）
  playerScores.sort((a, b) => b.recentTrend - a.recentTrend)

  const assigned = []
  const usedSeats = new Set()

  for (const p of playerScores) {
    // 找该玩家胜率最低的可用座位
    const available = seats.filter(s => !usedSeats.has(s))
    available.sort((a, b) => p.seatRates[a] - p.seatRates[b])
    const seat = available[0]
    usedSeats.add(seat)
    assigned.push({ id: p.id, nickname: p.nickname, avatar: p.avatar, seat, seatWinRate: p.seat_win_rate })
  }

  players.value = assigned
}

function getAvatar(player) {
  const colors = ['#4361ee', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899']
  const idx = player.nickname.charCodeAt(0) % colors.length
  return colors[idx]
}

function getPlayerBySeat(seat) {
  return players.value.find(p => p.seat === seat)
}

function handleSeatClick(seat) {
  if (!swapMode.value) return
  const player = getPlayerBySeat(seat)
  if (!player) return

  if (!swapFirst.value) {
    swapFirst.value = seat
  } else {
    // 交换两个座位
    const p1 = getPlayerBySeat(swapFirst.value)
    const p2 = getPlayerBySeat(seat)
    if (p1 && p2) {
      p1.seat = seat
      p2.seat = swapFirst.value
    }
    swapFirst.value = null
    swapMode.value = false
  }
}

function toggleSwapMode() {
  swapMode.value = !swapMode.value
  swapFirst.value = null
}

async function confirmStart() {
  if (creating.value) return
  creating.value = true
  try {
    const playerIds = players.value.map(p => p.id)
    const seatAssign = players.value.map(p => p.seat)
    const game = await gameStore.createGame(playerIds, seatAssign)
    router.push(`/playing/${game.id}`)
  } catch (e) {
    alert('创建对局失败：' + e.message)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">座位分配</h1>

    <!-- 牌桌 -->
    <div class="table-container">
      <div class="mahjong-table">
        <!-- 北 -->
        <div class="seat-slot north" :class="{ active: swapFirst === 'north', swapping: swapMode }"
          @click="handleSeatClick('north')">
          <template v-if="getPlayerBySeat('north')">
            <div class="seat-avatar" :style="{ background: getAvatar(getPlayerBySeat('north')) }">
              {{ getPlayerBySeat('north').nickname.charAt(0) }}
            </div>
            <div class="seat-name">{{ getPlayerBySeat('north').nickname }}</div>
          </template>
          <div class="seat-label">北</div>
        </div>

        <!-- 西 -->
        <div class="seat-slot west" :class="{ active: swapFirst === 'west', swapping: swapMode }"
          @click="handleSeatClick('west')">
          <template v-if="getPlayerBySeat('west')">
            <div class="seat-avatar" :style="{ background: getAvatar(getPlayerBySeat('west')) }">
              {{ getPlayerBySeat('west').nickname.charAt(0) }}
            </div>
            <div class="seat-name">{{ getPlayerBySeat('west').nickname }}</div>
          </template>
          <div class="seat-label">西</div>
        </div>

        <!-- 牌桌中心 -->
        <div class="table-center">牌桌</div>

        <!-- 东 -->
        <div class="seat-slot east" :class="{ active: swapFirst === 'east', swapping: swapMode }"
          @click="handleSeatClick('east')">
          <template v-if="getPlayerBySeat('east')">
            <div class="seat-avatar" :style="{ background: getAvatar(getPlayerBySeat('east')) }">
              {{ getPlayerBySeat('east').nickname.charAt(0) }}
            </div>
            <div class="seat-name">{{ getPlayerBySeat('east').nickname }}</div>
          </template>
          <div class="seat-label">东</div>
        </div>

        <!-- 南 -->
        <div class="seat-slot south" :class="{ active: swapFirst === 'south', swapping: swapMode }"
          @click="handleSeatClick('south')">
          <template v-if="getPlayerBySeat('south')">
            <div class="seat-avatar" :style="{ background: getAvatar(getPlayerBySeat('south')) }">
              {{ getPlayerBySeat('south').nickname.charAt(0) }}
            </div>
            <div class="seat-name">{{ getPlayerBySeat('south').nickname }}</div>
          </template>
          <div class="seat-label">南</div>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-outline btn-block" @click="toggleSwapMode"
        :class="{ 'btn-warning': swapMode }">
        {{ swapMode ? (swapFirst ? '点击第二个座位完成交换' : '点击第一个座位') : '手动交换座位' }}
      </button>
      <button class="btn btn-primary btn-block" :disabled="creating" @click="confirmStart">
        {{ creating ? '创建中...' : '确认开局' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.table-container { padding: 20px 0; }
.mahjong-table {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: auto auto auto;
  gap: 12px;
  max-width: 340px;
  margin: 0 auto;
}
.seat-slot {
  display: flex; flex-direction: column; align-items: center;
  gap: 6px; padding: 12px 8px;
  background: var(--primary-light); border: 2px solid transparent;
  border-radius: 12px; cursor: default; transition: all 0.2s;
}
.seat-slot.swapping { cursor: pointer; }
.seat-slot.swapping:hover { border-color: var(--warning); }
.seat-slot.active { border-color: var(--warning); background: #fef3c7; }
.seat-avatar {
  width: 48px; height: 48px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 20px; font-weight: 700;
}
.seat-name { font-size: 14px; font-weight: 600; }
.seat-label { font-size: 12px; color: var(--text-secondary); }
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
.actions { display: flex; flex-direction: column; gap: 12px; margin-top: 24px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
