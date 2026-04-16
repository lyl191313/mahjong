import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase.js'

export const usePlayersStore = defineStore('players', {
  state: () => ({
    players: [],
    loading: false,
  }),
  getters: {
    activePlayers: (state) => state.players.filter(p => !p.is_deleted),
  },
  actions: {
    async fetchPlayers() {
      this.loading = true
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      this.players = data || []
      this.loading = false
    },

    async addPlayer(nickname, avatar = null) {
      const { data, error } = await supabase
        .from('players')
        .insert({
          nickname,
          avatar,
          total_score: 0,
          total_games: 0,
          win_games: 0,
          seat_win_rate: {
            east: { wins: 0, total: 0 },
            south: { wins: 0, total: 0 },
            west: { wins: 0, total: 0 },
            north: { wins: 0, total: 0 },
          },
          total_expense: 0,
          is_deleted: false,
        })
        .select()
        .single()
      if (error) throw error
      this.players.unshift(data)
      return data
    },

    async updatePlayer(id, updates) {
      const { data, error } = await supabase
        .from('players')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      const idx = this.players.findIndex(p => p.id === id)
      if (idx !== -1) this.players[idx] = data
      return data
    },

    async deletePlayer(id) {
      const { error } = await supabase
        .from('players')
        .update({ is_deleted: true })
        .eq('id', id)
      if (error) throw error
      this.players = this.players.filter(p => p.id !== id)
    },

    async fetchAllPlayers() {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      this.players = data || []
      return data || []
    },
  },
})
