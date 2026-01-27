import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Töltsd be a .env.local fájlt
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function migrateData() {
  console.log('🚀 JSON adatok migrálása Supabase-be...\n')

  // JSON fájl beolvasása
  const jsonPath = path.join(process.cwd(), 'public', 'data', 'games.json')
  const gamesData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  for (const game of gamesData) {
    console.log(`📊 Meccs feldolgozása: ${game.opponent} (${game.date})`)

    // 1. Meccs beszúrása
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .insert({
        date: game.date,
        opponent: game.opponent,
        home_away: game.homeAway,
        our_score: game.ourScore,
        opp_score: game.oppScore,
        result: game.result,
      })
      .select()
      .single()

    if (gameError) {
      console.error('❌ Hiba a meccs beszúrásakor:', gameError)
      continue
    }

    console.log(`✅ Meccs mentve, ID: ${gameData.id}`)

    // 2. Játékosok feldolgozása
    for (const player of game.players) {
      // Ellenőrizzük, létezik-e már a játékos
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('number', player.number)
        .single()

      let playerId: string

      if (existingPlayer) {
        playerId = existingPlayer.id
        console.log(`  ⚡ Meglévő játékos: ${player.name} (#${player.number})`)
      } else {
        // Játékos beszúrása
        const { data: newPlayer, error: playerError } = await supabase
          .from('players')
          .insert({
            name: player.name,
            number: player.number,
            position: player.position,
          })
          .select()
          .single()

        if (playerError) {
          console.error(`  ❌ Hiba a játékos beszúrásakor (${player.name}):`, playerError)
          continue
        }

        playerId = newPlayer.id
        console.log(`  ✅ Új játékos: ${player.name} (#${player.number})`)
      }

      // 3. Játékos teljesítmény beszúrása
      const { error: statsError } = await supabase
        .from('player_game_stats')
        .insert({
          game_id: gameData.id,
          player_id: playerId,
          minutes: player.minutes,
          points: player.points,
          close_made: player.shooting.close.made,
          close_attempted: player.shooting.close.attempted,
          mid_made: player.shooting.mid.made,
          mid_attempted: player.shooting.mid.attempted,
          three_made: player.shooting.three.made,
          three_attempted: player.shooting.three.attempted,
          free_throw_made: player.shooting.freeThrow.made,
          free_throw_attempted: player.shooting.freeThrow.attempted,
          offensive_rebounds: player.rebounds.offensive,
          defensive_rebounds: player.rebounds.defensive,
          total_rebounds: player.rebounds.total,
          assists: player.assists,
          steals: player.steals,
          blocks: player.blocks,
          turnovers: player.turnovers,
          fouls_committed: player.fouls,
          plus_minus: player.plusMinus,
          valuation: player.valuation,
          offensive_rating: player.advanced.offensiveRating,
          defensive_rating: player.advanced.defensiveRating,
          true_shooting_percentage: player.advanced.trueShootingPercentage,
          effective_field_goal_percentage: player.advanced.effectiveFieldGoalPercentage,
        })

      if (statsError) {
        console.error(`  ❌ Hiba a statisztika beszúrásakor (${player.name}):`, statsError)
      }
    }

    console.log(`✅ Meccs teljes feldolgozása kész!\n`)
  }

  console.log('🎉 Migráció befejezve!')
}

// Szkript futtatása
migrateData().catch(console.error)
