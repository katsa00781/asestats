import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

// Típusok a Supabase táblákhoz
export type Database = {
  public: {
    Tables: {
      games: {
        Row: {
          id: string
          date: string
          opponent: string
          home_away: 'home' | 'away'
          our_score: number
          opp_score: number
          result: 'win' | 'loss'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['games']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['games']['Insert']>
      }
      players: {
        Row: {
          id: string
          name: string
          number: number
          position: 'G' | 'F' | 'C'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      player_game_stats: {
        Row: {
          id: string
          game_id: string
          player_id: string
          minutes: number
          points: number
          close_made: number
          close_attempted: number
          mid_made: number
          mid_attempted: number
          three_made: number
          three_attempted: number
          free_throw_made: number
          free_throw_attempted: number
          offensive_rebounds: number
          defensive_rebounds: number
          total_rebounds: number
          assists: number
          steals: number
          blocks: number
          turnovers: number
          fouls_committed: number
          fouls_drawn: number
          blocks_suffered: number
          blocks_given: number
          plus_minus: number
          valuation: number
          offensive_rating: number
          defensive_rating: number
          true_shooting_percentage: number
          effective_field_goal_percentage: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['player_game_stats']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['player_game_stats']['Insert']>
      }
      game_text_reports: {
        Row: {
          id: string
          game_id: string
          report_type: 'pregame' | 'postgame' | 'combined'
          narrative: string
          pregame_snapshot: Json | null
          postgame_snapshot: Json | null
          generated_by: string | null
          generated_at: string
          updated_at: string
        }
        Insert: {
          game_id: string
          report_type: 'pregame' | 'postgame' | 'combined'
          narrative: string
          pregame_snapshot?: Json | null
          postgame_snapshot?: Json | null
          generated_by?: string | null
          generated_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['game_text_reports']['Insert']>
      }
    }
    Views: {
      player_season_stats: {
        Row: {
          id: string
          name: string
          number: number
          position: string
          games_played: number
          total_points: number
          total_minutes: number
          close_made: number
          close_attempted: number
          mid_made: number
          mid_attempted: number
          three_made: number
          three_attempted: number
          free_throw_made: number
          free_throw_attempted: number
          offensive_rebounds: number
          defensive_rebounds: number
          total_rebounds: number
          assists: number
          steals: number
          blocks: number
          blocks_suffered: number
          blocks_given: number
          turnovers: number
          fouls_committed: number
          fouls_drawn: number
          valuation: number
          avg_offensive_rating: number
          avg_defensive_rating: number
          avg_true_shooting_pct: number
          avg_effective_fg_pct: number
        }
      }
    }
  }
}
