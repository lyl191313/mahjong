const SEATS = ['east', 'south', 'west', 'north']
const SEAT_LABEL = { east: '东', south: '南', west: '西', north: '北' }

function hashSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}

/** 座位历史里胜率最高且样本足够的方位 */
function bestSeatFromHistory(seatWinRate) {
  const swr = seatWinRate || {}
  let best = null
  let bestScore = -1
  for (const seat of SEATS) {
    const d = swr[seat]
    if (!d || d.total < 1) continue
    const rate = d.wins / d.total
    const weight = d.total >= 3 ? rate : rate * 0.85
    if (weight > bestScore) {
      bestScore = weight
      best = seat
    }
  }
  return best
}

/** 近几场里赢局出现最多的座位 */
function bestSeatFromRecent(recentGames) {
  const wins = (recentGames || []).filter((r) => r.score > 0)
  if (!wins.length) return null
  const counts = {}
  for (const w of wins) {
    if (!w.seat) continue
    counts[w.seat] = (counts[w.seat] || 0) + 1
  }
  let best = null
  let max = 0
  for (const seat of SEATS) {
    const c = counts[seat] || 0
    if (c > max) {
      max = c
      best = seat
    }
  }
  return best
}

/**
 * 根据玩家汇总数据 + 近几场战绩生成运势（娱乐向）。
 * @param {object} opts
 * @param {object} opts.player  players 表一行
 * @param {Array<{ score: number, settlement_amount?: number, seat?: string }>} opts.recentGames 已按时间新→旧，建议最多 5 条
 * @param {string} opts.dateKey YYYY-MM-DD，仅用于吉利数等日级点缀
 */
export function getDataDrivenFortune({ player, recentGames = [], dateKey }) {
  const id = player.id || ''
  const seed = hashSeed(`${id}|${dateKey || ''}`)
  const luckyNum = (seed % 9) + 1

  const totalGames = player.total_games || 0
  const winGames = player.win_games || 0
  const winRate = totalGames > 0 ? winGames / totalGames : 0
  const recent = recentGames || []
  const recentLen = recent.length
  const recentWins = recent.filter((r) => r.score > 0).length
  const recentWinRate = recentLen > 0 ? recentWins / recentLen : winRate

  let streak = 0
  let streakType = null
  for (const r of recent) {
    if (r.score > 0) {
      if (streakType === 'lose') break
      streakType = 'win'
      streak++
    } else if (r.score < 0) {
      if (streakType === 'win') break
      streakType = 'lose'
      streak++
    } else break
  }

  const recentMoney = recent.reduce((s, r) => s + (Number(r.settlement_amount) || 0), 0)
  const expense = Number(player.total_expense) || 0

  let histSeat = bestSeatFromHistory(player.seat_win_rate)
  const recentSeat = bestSeatFromRecent(recent)
  if (!histSeat || (player.seat_win_rate?.[histSeat]?.total || 0) < 3) {
    histSeat = recentSeat || histSeat
  }
  const luckySeat = histSeat ? SEAT_LABEL[histSeat] : SEAT_LABEL[SEATS[seed % 4]]

  if (totalGames === 0) {
    return {
      level: '新手上路',
      stars: 3,
      mood: '宜先热身',
      tip: '还没有对局记录，多打几局后再看会更准。',
      luckySeat,
      luckyNum,
      dateKey,
      dataHint: '暂无战绩样本',
    }
  }

  let luckPoints = Math.round(winRate * 38 + recentWinRate * 42)
  if (recent[0]) {
    if (recent[0].score > 0) luckPoints += 10
    else if (recent[0].score < 0) luckPoints -= 10
  }
  if (streakType === 'win' && streak >= 3) luckPoints += 12
  else if (streakType === 'win' && streak >= 2) luckPoints += 6
  if (streakType === 'lose' && streak >= 3) luckPoints -= 12
  else if (streakType === 'lose' && streak >= 2) luckPoints -= 6
  if (recentMoney > 30) luckPoints += 6
  else if (recentMoney < -30) luckPoints -= 6
  luckPoints = Math.max(5, Math.min(99, luckPoints))

  const stars =
    luckPoints >= 78 ? 5 : luckPoints >= 62 ? 4 : luckPoints >= 46 ? 3 : luckPoints >= 30 ? 2 : 1
  const level =
    stars >= 5
      ? '手感火热'
      : stars === 4
        ? '稳中有升'
        : stars === 3
          ? '平平常常'
          : stars === 2
            ? '宜收敛'
            : '调整期'

  let mood = '宜平常心'
  if (streakType === 'win' && streak >= 2) mood = '宜乘势推进'
  else if (streakType === 'lose' && streak >= 2) mood = '宜防守观望'
  else if (winRate >= 0.55) mood = '宜主动出击'
  else if (winRate <= 0.35) mood = '宜小胡即安'
  else if (expense > 80) mood = '宜见好就收'
  else if (expense < -80) mood = '宜控风险'

  const tipParts = []
  tipParts.push(
    `生涯 ${totalGames} 局、胜率约 ${Math.round(winRate * 100)}%`
  )
  if (recentLen) {
    tipParts.push(`；近 ${recentLen} 场胜 ${recentWins} 场`)
    if (streakType && streak >= 2) {
      tipParts.push(
        streakType === 'win' ? `，当前连胜 ${streak} 场` : `，近期连负 ${streak} 场`
      )
    }
  }
  tipParts.push('。')
  if (Math.abs(expense) > 30) {
    tipParts.push(
      expense >= 0
        ? '累计收益为正，注意落袋与账目。'
        : '累计水下较深，适合放慢节奏、减少大额冒险。'
    )
  } else {
    tipParts.push('保持节奏与算清台费，比玄学更管用。')
  }

  return {
    level,
    stars,
    mood,
    tip: tipParts.join(''),
    luckySeat,
    luckyNum,
    dateKey,
    dataHint: recentLen ? `已参考最近 ${recentLen} 场已结束对局` : '暂无近期已结束对局，主要依据生涯数据',
  }
}

export { SEAT_LABEL }
