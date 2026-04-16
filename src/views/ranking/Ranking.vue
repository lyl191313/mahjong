<script setup>
import { ref, computed, onMounted } from "vue";
import { supabase } from "../../lib/supabase.js";
import { getTier, TIER_RULES } from "../../lib/tier.js";

const loading = ref(true);
const players = ref([]);
const activeTab = ref("score");
const showDetail = ref(false);
const detailPlayer = ref(null);

const seatLabels = { east: "东", south: "南", west: "西", north: "北" };
const seatKeys = ["east", "south", "west", "north"];

const tabs = [
  { key: "score", label: "总分" },
  { key: "record", label: "战绩" },
  { key: "tier", label: "段位" },
  { key: "expense", label: "收益" },
];

onMounted(async () => {
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("is_deleted", false);
  players.value = data || [];
  loading.value = false;
});

const rankedPlayers = computed(() => {
  const list = [...players.value];
  switch (activeTab.value) {
    case "score":
      return list.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
    case "record":
      return list
        .filter((p) => p.total_games > 0)
        .sort(
          (a, b) => b.win_games / b.total_games - a.win_games / a.total_games
        );
    case "tier":
      return list.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
    case "expense":
      return list.sort(
        (a, b) => (b.total_expense || 0) - (a.total_expense || 0)
      );
    default:
      return list;
  }
});

function getAvatar(player) {
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

function getValue(player) {
  switch (activeTab.value) {
    case "score":
      return (player.total_score || 0) + " 分";
    case "record": {
      const games = player.total_games || 0;
      const rate = games ? Math.round((player.win_games / games) * 100) : 0;
      return `${games}局 | 胜率${rate}%`;
    }
    case "expense": {
      const v = player.total_expense || 0;
      return (v > 0 ? "+" : "") + v.toFixed(2) + " 元";
    }
    default:
      return "";
  }
}

function getMedal(index) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return index + 1;
}

function openDetail(player) {
  if (activeTab.value !== "record") return;
  detailPlayer.value = player;
  showDetail.value = true;
}

function getSeatStat(player, seat) {
  const d = player.seat_win_rate?.[seat];
  if (!d || !d.total) return { total: 0, rate: "0%" };
  return { total: d.total, rate: Math.round((d.wins / d.total) * 100) + "%" };
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">榜单S1</h1>

    <div class="tab-switch">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="rankedPlayers.length === 0" class="empty">暂无数据</div>

    <div v-else class="rank-list">
      <div
        v-for="(player, index) in rankedPlayers"
        :key="player.id"
        class="card rank-card"
        :class="{ clickable: activeTab === 'record' }"
        @click="openDetail(player)"
      >
        <div class="rank-num" :class="{ top3: index < 3 }">
          {{ getMedal(index) }}
        </div>
        <div class="rank-info">
          <div class="avatar" :style="{ background: getAvatar(player) }">
            {{ player.nickname.charAt(0) }}
          </div>
          <div class="rank-name">{{ player.nickname }}</div>
        </div>
        <div
          v-if="activeTab === 'tier'"
          class="tier-badge"
          :style="{ background: getTier(player.total_score).color }"
        >
          {{ getTier(player.total_score).label }}
        </div>
        <div
          v-else
          class="rank-value"
          :class="{
            win: activeTab === 'expense' && (player.total_expense || 0) > 0,
            lose: activeTab === 'expense' && (player.total_expense || 0) < 0,
          }"
        >
          {{ getValue(player) }}
        </div>
      </div>
    </div>

    <!-- 段位规则说明 -->
    <div v-if="activeTab === 'tier'" class="card tier-rules">
      <div class="rules-title">段位规则</div>
      <div class="rules-desc">
        根据个人总分匹配段位，每个大段位分为 I~IV 四个小段
      </div>
      <div class="rules-list">
        <div v-for="rule in TIER_RULES" :key="rule.name" class="rule-row">
          <span class="rule-badge" :style="{ background: rule.color }">{{
            rule.name
          }}</span>
          <span class="rule-range">
            <template v-if="rule.end === null">{{ rule.start }}+ 分</template>
            <template v-else
              >{{ rule.start }}~{{ rule.end }} 分（每{{
                rule.subSize
              }}分一小段）</template
            >
          </span>
        </div>
      </div>
    </div>

    <!-- 战绩详情弹窗 -->
    <div
      v-if="showDetail"
      class="modal-overlay"
      @click.self="showDetail = false"
    >
      <div class="modal">
        <h3 class="modal-title">{{ detailPlayer.nickname }} 的方位战绩</h3>
        <div class="detail-summary">
          总计 {{ detailPlayer.total_games || 0 }} 局，胜率
          {{
            detailPlayer.total_games
              ? Math.round(
                  (detailPlayer.win_games / detailPlayer.total_games) * 100
                )
              : 0
          }}%
        </div>
        <div class="seat-stats">
          <div v-for="seat in seatKeys" :key="seat" class="seat-stat-row">
            <span class="seat-label">{{ seatLabels[seat] }}</span>
            <span class="seat-games"
              >{{ getSeatStat(detailPlayer, seat).total }} 局</span
            >
            <div class="seat-bar-wrap">
              <div
                class="seat-bar"
                :style="{ width: getSeatStat(detailPlayer, seat).rate }"
              ></div>
            </div>
            <span class="seat-rate">{{
              getSeatStat(detailPlayer, seat).rate
            }}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showDetail = false">
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-switch {
  display: flex;
  gap: 0;
  background: var(--primary-light);
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 16px;
}
.tab-btn {
  flex: 1;
  padding: 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text-secondary);
}
.tab-btn.active {
  background: var(--primary);
  color: #fff;
}
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.rank-card {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rank-num {
  width: 32px;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-secondary);
}
.rank-num.top3 {
  font-size: 22px;
}
.rank-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}
.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
}
.rank-name {
  font-weight: 600;
  font-size: 15px;
}
.rank-value {
  font-weight: 700;
  font-size: 15px;
  color: var(--primary);
}
.rank-value.win {
  color: var(--success);
}
.rank-value.lose {
  color: var(--danger);
}
.tier-badge {
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}
.tier-rules {
  margin-top: 16px;
}
.rules-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 6px;
}
.rules-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}
.rules-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rule-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rule-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  min-width: 72px;
  text-align: center;
}
.rule-range {
  font-size: 12px;
  color: var(--text-secondary);
}
.rank-card.clickable {
  cursor: pointer;
}
.rank-card.clickable:active {
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
  margin-bottom: 8px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
.detail-summary {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}
.seat-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.seat-stat-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.seat-label {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: var(--primary-light);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.seat-games {
  font-size: 13px;
  color: var(--text-secondary);
  width: 36px;
  text-align: right;
}
.seat-bar-wrap {
  flex: 1;
  height: 8px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}
.seat-bar {
  height: 100%;
  background: var(--primary);
  border-radius: 4px;
  transition: width 0.3s;
}
.seat-rate {
  font-size: 13px;
  font-weight: 700;
  width: 36px;
  text-align: right;
}
.loading {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}
.empty {
  text-align: center;
  padding: 60px;
  color: var(--text-secondary);
}
</style>
