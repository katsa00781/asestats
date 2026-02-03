import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ HIBA: Hiányzó Supabase környezeti változók!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumns() {
  console.log('Oszlopok hozzáadása...\n');

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS birth_year INTEGER,
      ADD COLUMN IF NOT EXISTS height INTEGER,
      ADD COLUMN IF NOT EXISTS weight INTEGER;
    `
  });

  if (error) {
    console.error('❌ Hiba:', error);
    console.log('\n⚠️  Az oszlopokat manuálisan kell hozzáadni a Supabase SQL editorban:');
    console.log(`
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS birth_year INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS weight INTEGER;
    `);
  } else {
    console.log('✅ Oszlopok sikeresen hozzáadva!');
  }
}

addColumns();
