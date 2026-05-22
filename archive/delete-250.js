require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== 250-es játékos törlése ===');
  
  // Először megkeressük
  const { data: player250, error: findError } = await supabase
    .from('players')
    .select('*')
    .eq('number', 87)
    .eq('name', '250')
    .single();
  
  if (findError) {
    console.error('Nem található:', findError.message);
    return;
  }
  
  console.log('Találat:', player250);
  
  // Töröljük
  const { error: deleteError } = await supabase
    .from('players')
    .delete()
    .eq('id', player250.id);
  
  if (deleteError) {
    console.error('Törlési hiba:', deleteError.message);
  } else {
    console.log('✓ Sikeresen törölve a 87. számú "250" játékos');
  }
  
  // Ellenőrzés
  const { data: check } = await supabase
    .from('players')
    .select('name, number')
    .eq('id', player250.id);
  
  console.log('Ellenőrzés (üres kell legyen):', check);
})();
