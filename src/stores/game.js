import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase.js'

export const useGameStore = defineStore('game', {
  state: () => ({
    currentGame: null,
    gamePlayers: [],
  }),
  actions: {
    async createGame(playerIds, seats) {
      const { data: game, error } = await supabase
        .from('games')
        .insert({ status: 'playing' })
        .select()
        .single()
      if (error) throw error

      const gamePlayers = playerIds.map((pid, i) => ({
        game_id: game.id,
        player_id: pid,
        seat: seats[i],
      }))
      const { error: gpError } = await supabase.from('game_players').insert(gamePlayers)
      if (gpError) throw gpError

      this.currentGame = game
      return game
    },

    async loadGame(gameId) {
      const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single()
      const { data: gp } = await supabase
        .from('game_players')
        .select('*, players(nickname, avatar)')
        .eq('game_id', gameId)
      this.currentGame = game
      this.gamePlayers = gp || []
      return { game, gamePlayers: gp }
    },

    async finishGame(gameId, scores, mealCost = 0, extraCost = 0, remark = '') {
      const totalWinScore = scores.filter(s => s.score > 0).reduce((sum, s) => sum + s.score, 0)

      for (const s of scores) {
        await supabase
          .from('game_players')
          .update({ score: s.score })
          .eq('game_id', gameId)
          .eq('player_id', s.playerId)
      }

      // 计算结算
      const totalWinAmount = totalWinScore * 5
      const distributable = totalWinAmount - mealCost

      if (distributable > 0) {
        let winnerRatio, loserRatio
        if (distributable < 100) { winnerRatio = 0.5; loserRatio = 0.5 }
        else if (distributable < 200) { winnerRatio = 0.4; loserRatio = 0.6 }
        else { winnerRatio = 0.3; loserRatio = 0.7 }

        const winnerPool = distributable * winnerRatio
        const loserPool = distributable * loserRatio
        const totalLoseScore = Math.abs(scores.filter(s => s.score < 0).reduce((sum, s) => sum + s.score, 0))

        for (const s of scores) {
          let amount = 0
          if (s.score > 0) amount = winnerPool * (s.score / totalWinScore)
          else if (s.score < 0) amount = loserPool * (Math.abs(s.score) / totalLoseScore)
          await supabase
            .from('game_players')
            .update({ settlement_amount: Math.round(amount * 100) / 100 })
            .eq('game_id', gameId)
            .eq('player_id', s.playerId)
        }
      }

      await supabase
        .from('games')
        .update({
          status: 'finished',
          total_win_score: totalWinScore,
          meal_cost: mealCost,
          extra_cost: extraCost,
          remark,
          ended_at: new Date().toISOString(),
        })
        .eq('id', gameId)

      // 更新玩家统计
      for (const s of scores) {
        const { data: player } = await supabase.from('players').select('*').eq('id', s.playerId).single()
        if (!player) continue
        const seatWinRate = player.seat_win_rate || { east: { wins: 0, total: 0 }, south: { wins: 0, total: 0 }, west: { wins: 0, total: 0 }, north: { wins: 0, total: 0 } }
        const gp = this.gamePlayers.find(g => g.player_id === s.playerId)
        if (gp) {
          const seat = gp.seat
          seatWinRate[seat].total += 1
          if (s.score > 0) seatWinRate[seat].wins += 1
        }
        await supabase
          .from('players')
          .update({
            total_score: (player.total_score || 0) + s.score,
            total_games: (player.total_games || 0) + 1,
            win_games: s.score > 0 ? (player.win_games || 0) + 1 : player.win_games || 0,
            seat_win_rate: seatWinRate,
            total_expense: (player.total_expense || 0) + (mealCost / scores.length),
          })
          .eq('id', s.playerId)
      }
    },

    async replacePlayer(gameId, outPlayerId, inPlayerId, frozenScore, seat) {
      await supabase
        .from('game_players')
        .update({ is_replaced: true, score: frozenScore })
        .eq('game_id', gameId)
        .eq('player_id', outPlayerId)

      await supabase.from('game_players').insert({
        game_id: gameId,
        player_id: inPlayerId,
        seat,
        is_replacer: true,
      })

      await supabase.from('replacements').insert({
        game_id: gameId,
        out_player_id: outPlayerId,
        in_player_id: inPlayerId,
        frozen_score: frozenScore,
      })
    },
  },
})
