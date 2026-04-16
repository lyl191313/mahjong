<script setup>
import { ref, computed, onMounted } from "vue";
import { usePlayersStore } from "../../stores/players.js";
import { getTier } from "../../lib/tier.js";

const store = usePlayersStore();
const searchQuery = ref("");
const showAddModal = ref(false);
const showEditModal = ref(false);
const newNickname = ref("");
const editingPlayer = ref(null);
const editNickname = ref("");

onMounted(() => {
  store.fetchPlayers();
});

const filteredPlayers = computed(() => {
  let list = [...store.players];
  if (searchQuery.value) {
    list = list.filter((p) =>
      p.nickname.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }
  return list.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
});

function getAvatar(player) {
  if (player.avatar) return player.avatar;
  const colors = [
    "#4361ee",
    "#ef4444",
    "#22c55e",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
  ];
  const idx = player.nickname.charCodeAt(0) % colors.length;
  return colors[idx];
}

async function addPlayer() {
  if (!newNickname.value.trim()) return;
  await store.addPlayer(newNickname.value.trim());
  newNickname.value = "";
  showAddModal.value = false;
}

function openEdit(player) {
  editingPlayer.value = player;
  editNickname.value = player.nickname;
  showEditModal.value = true;
}

async function saveEdit() {
  if (!editNickname.value.trim() || !editingPlayer.value) return;
  await store.updatePlayer(editingPlayer.value.id, {
    nickname: editNickname.value.trim(),
  });
  showEditModal.value = false;
  editingPlayer.value = null;
}

async function confirmDelete(player) {
  if (confirm(`确定删除牌友「${player.nickname}」吗？历史对局记录仍会保留。`)) {
    await store.deletePlayer(player.id);
  }
}

function winRate(player) {
  if (!player.total_games) return "0%";
  return Math.round((player.win_games / player.total_games) * 100) + "%";
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">牌友库</h1>

    <div class="search-bar">
      <input
        v-model="searchQuery"
        class="input"
        placeholder="搜索牌友昵称..."
      />
    </div>

    <div v-if="store.loading" class="loading">加载中...</div>

    <div v-else-if="filteredPlayers.length === 0" class="empty">
      <p>{{ searchQuery ? "未找到匹配的牌友" : "还没有牌友，添加一个吧！" }}</p>
    </div>

    <div v-else class="player-list">
      <div
        v-for="player in filteredPlayers"
        :key="player.id"
        class="card player-card"
      >
        <div class="player-info">
          <div class="avatar" :style="{ background: getAvatar(player) }">
            {{ player.nickname.charAt(0) }}
          </div>
          <div class="player-detail">
            <div class="player-name">
              {{ player.nickname }}
              <span class="tier-badge" :style="{ background: getTier(player.total_score).color }">
                {{ getTier(player.total_score).label }}
              </span>
            </div>
            <div class="player-stats">
              <span>{{ player.total_games || 0 }}局</span>
              <span>胜率 {{ winRate(player) }}</span>
              <span>总分 {{ player.total_score || 0 }}</span>
            </div>
          </div>
        </div>
        <div class="player-actions">
          <button class="btn btn-sm btn-outline" @click="openEdit(player)">
            编辑
          </button>
          <button class="btn btn-sm btn-danger" @click="confirmDelete(player)">
            删除
          </button>
        </div>
      </div>
    </div>

    <button class="fab" @click="showAddModal = true">+</button>

    <!-- 新增弹窗 -->
    <div
      v-if="showAddModal"
      class="modal-overlay"
      @click.self="showAddModal = false"
    >
      <div class="modal">
        <h3 class="modal-title">新增牌友</h3>
        <input
          v-model="newNickname"
          class="input"
          placeholder="请输入昵称"
          @keyup.enter="addPlayer"
          autofocus
        />
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showAddModal = false">
            取消
          </button>
          <button class="btn btn-primary" @click="addPlayer">确认</button>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <div
      v-if="showEditModal"
      class="modal-overlay"
      @click.self="showEditModal = false"
    >
      <div class="modal">
        <h3 class="modal-title">编辑牌友</h3>
        <input
          v-model="editNickname"
          class="input"
          placeholder="请输入昵称"
          @keyup.enter="saveEdit"
          autofocus
        />
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showEditModal = false">
            取消
          </button>
          <button class="btn btn-primary" @click="saveEdit">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-bar {
  margin-bottom: 16px;
}
.player-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.player-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.player-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}
.player-detail {
  min-width: 0;
}
.player-name {
  font-weight: 600;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tier-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}
.player-stats {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.player-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}
.loading {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}
.fab {
  position: fixed;
  bottom: 90px;
  right: 10px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  font-size: 28px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(67, 97, 238, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.fab:active {
  opacity: 0.8;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
}
.modal {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 360px;
}
.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
}
.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  justify-content: flex-end;
}
</style>
