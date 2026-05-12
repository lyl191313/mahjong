<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { supabase } from "../../lib/supabase.js";
import { getTier, TIER_RULES } from "../../lib/tier.js";
import { getDataDrivenFortune } from "../../lib/fortune.js";

const loading = ref(true);
const players = ref([]);
const activeTab = ref("score");
const showDetail = ref(false);
const detailPlayer = ref(null);
const detailRecentGames = ref([]);
const detailRecentLoading = ref(false);

const fortunePlayerId = ref(null);
const fortuneRecentRows = ref([]);
const fortuneRecentLoading = ref(false);

const seatLabels = { east: "东", south: "南", west: "西", north: "北" };

const tabs = [
  { key: "score", label: "总分" },
  { key: "record", label: "战绩" },
  { key: "tier", label: "段位" },
  { key: "expense", label: "收益" },
];

const todayKey = computed(() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
});

const fortunePlayer = computed(() =>
  players.value.find((p) => p.id === fortunePlayerId.value)
);

const fortune = computed(() => {
  const p = fortunePlayer.value;
  if (!p) return null;
  return getDataDrivenFortune({
    player: p,
    recentGames: fortuneRecentRows.value.map((r) => ({
      score: Number(r.score) || 0,
      settlement_amount: r.settlement_amount,
      seat: r.seat,
    })),
    dateKey: todayKey.value,
  });
});

async function loadRecentFinishedGames(playerId, limit = 5) {
  if (!playerId) return [];
  const { data, error } = await supabase
    .from("game_players")
    .select("score, settlement_amount, seat, games!inner(id, ended_at, status)")
    .eq("player_id", playerId)
    .eq("games.status", "finished");
  if (error) return [];
  return (data || [])
    .filter((r) => r.games?.ended_at)
    .sort(
      (a, b) =>
        new Date(b.games.ended_at).getTime() -
        new Date(a.games.ended_at).getTime()
    )
    .slice(0, limit);
}

async function refreshFortuneRecent() {
  const pid = fortunePlayerId.value;
  if (!pid) {
    fortuneRecentRows.value = [];
    return;
  }
  fortuneRecentLoading.value = true;
  fortuneRecentRows.value = await loadRecentFinishedGames(pid, 5);
  fortuneRecentLoading.value = false;
}

onMounted(async () => {
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("is_deleted", false);
  players.value = data || [];
  if (players.value.length) fortunePlayerId.value = players.value[0].id;
  loading.value = false;
});

watch(
  fortunePlayerId,
  () => {
    refreshFortuneRecent();
  },
  { immediate: true }
);

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

async function openDetail(player) {
  if (activeTab.value !== "record") return;
  detailPlayer.value = player;
  showDetail.value = true;
  detailRecentLoading.value = true;
  detailRecentGames.value = [];
  detailRecentGames.value = await loadRecentFinishedGames(player.id, 5);
  detailRecentLoading.value = false;
}

function formatGameDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatMoney(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  return (v >= 0 ? "+" : "") + v.toFixed(2) + " 元";
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">榜单S1</h1>

    <div v-if="!loading && players.length" class="card fortune-card">
      <div class="fortune-head">
        <span class="fortune-title">今日运势</span>
        <span class="fortune-date">{{ todayKey }}</span>
      </div>
      <label class="fortune-field-label" for="fortune-player-select">选择人物</label>
      <select
        id="fortune-player-select"
        v-model="fortunePlayerId"
        class="input fortune-field-select"
      >
        <option v-for="p in players" :key="p.id" :value="p.id">
          {{ p.nickname }}
        </option>
      </select>
      <p v-if="fortuneRecentLoading" class="fortune-sync">正在同步近期战绩…</p>
      <template v-if="fortune">
        <div class="fortune-level">
          <span class="fortune-label-text">{{ fortune.level }}</span>
          <span class="fortune-stars">{{ "★".repeat(fortune.stars) }}{{ "☆".repeat(5 - fortune.stars) }}</span>
        </div>
        <p class="fortune-mood">{{ fortune.mood }} · 幸运方位「{{ fortune.luckySeat }}」· 吉利数 {{ fortune.luckyNum }}</p>
        <p class="fortune-tip">{{ fortune.tip }}</p>
        <p v-if="fortune.dataHint" class="fortune-data-hint">{{ fortune.dataHint }}</p>
        <p class="fortune-disclaimer">根据生涯与近 5 场已结束对局生成，仅供娱乐</p>
      </template>
    </div>

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
        <h3 class="modal-title">{{ detailPlayer.nickname }} 的最近对局</h3>
        <div class="detail-summary">
          生涯 {{ detailPlayer.total_games || 0 }} 局，胜率
          {{
            detailPlayer.total_games
              ? Math.round(
                  (detailPlayer.win_games / detailPlayer.total_games) * 100
                )
              : 0
          }}% · 下列为最近 5 场已结束对局
        </div>
        <div v-if="detailRecentLoading" class="detail-recent-loading">加载中...</div>
        <div v-else-if="detailRecentGames.length === 0" class="detail-recent-empty">
          暂无已结束对局记录
        </div>
        <div v-else class="recent-games">
          <div
            v-for="(row, idx) in detailRecentGames"
            :key="row.games?.id ?? idx"
            class="recent-game-row"
          >
            <div class="recent-game-top">
              <span class="recent-date">{{ formatGameDate(row.games?.ended_at) }}</span>
              <span
                class="recent-result"
                :class="{ win: row.score > 0, lose: row.score < 0, draw: row.score === 0 }"
              >
                {{ row.score > 0 ? "胜" : row.score < 0 ? "负" : "平" }}
              </span>
            </div>
            <div class="recent-game-meta">
              <span>{{ seatLabels[row.seat] || "—" }}家</span>
              <span class="recent-score" :class="{ win: row.score > 0, lose: row.score < 0 }">
                {{ row.score > 0 ? "+" : "" }}{{ row.score ?? 0 }} 分
              </span>
              <span class="recent-money" :class="{ pos: (row.settlement_amount || 0) >= 0, neg: (row.settlement_amount || 0) < 0 }">
                本场 {{ formatMoney(row.settlement_amount) }}
              </span>
            </div>
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
.fortune-card {
  margin-bottom: 16px;
}
.fortune-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.fortune-title {
  font-size: 16px;
  font-weight: 700;
}
.fortune-date {
  font-size: 12px;
  color: var(--text-secondary);
}
.fortune-field-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.fortune-field-select {
  margin-bottom: 10px;
}
.fortune-sync {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 10px;
}
.fortune-data-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 8px;
  line-height: 1.45;
}
.fortune-level {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.fortune-label-text {
  font-size: 18px;
  font-weight: 800;
  color: var(--primary);
}
.fortune-stars {
  color: #f59e0b;
  letter-spacing: 2px;
  font-size: 14px;
}
.fortune-mood {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 8px;
  line-height: 1.5;
}
.fortune-tip {
  font-size: 14px;
  margin: 0 0 8px;
  line-height: 1.55;
}
.fortune-disclaimer {
  font-size: 11px;
  color: #94a3b8;
  margin: 0;
}
.detail-recent-loading,
.detail-recent-empty {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
  font-size: 14px;
}
.recent-games {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.recent-game-row {
  padding: 12px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid var(--border);
}
.recent-game-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.recent-date {
  font-size: 13px;
  color: var(--text-secondary);
}
.recent-result {
  font-size: 13px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  background: #e2e8f0;
  color: #64748b;
}
.recent-result.win {
  background: #dcfce7;
  color: #15803d;
}
.recent-result.lose {
  background: #fee2e2;
  color: #b91c1c;
}
.recent-result.draw {
  background: #f1f5f9;
  color: #64748b;
}
.recent-game-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 13px;
  align-items: center;
}
.recent-score.win {
  color: var(--success);
  font-weight: 700;
}
.recent-score.lose {
  color: var(--danger);
  font-weight: 700;
}
.recent-money.pos {
  color: var(--success);
  font-weight: 600;
}
.recent-money.neg {
  color: var(--danger);
  font-weight: 600;
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
