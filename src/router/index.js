import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/players' },
  { path: '/players', component: () => import('../views/player/PlayerList.vue') },
  { path: '/start', component: () => import('../views/game/StartGame.vue') },
  { path: '/seat/:gameId', component: () => import('../views/game/SeatAssign.vue') },
  { path: '/playing/:gameId', component: () => import('../views/game/Playing.vue') },
  { path: '/score/:gameId', component: () => import('../views/game/ScoreInput.vue') },
  { path: '/settle/:gameId', component: () => import('../views/game/Settlement.vue') },
  { path: '/ranking', component: () => import('../views/ranking/Ranking.vue') },
  { path: '/records', component: () => import('../views/record/RecordList.vue') },
  { path: '/records/:gameId', component: () => import('../views/record/RecordDetail.vue') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
