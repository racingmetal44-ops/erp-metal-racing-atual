import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddohqrwkripaeocnyynu.supabase.co';
const supabaseAnonKey = 'sb_publishable_jzYTkJ6jAwHKBOkUsTEJnw_qfTOXtQc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log('Inserting minimal row into stock_movements...');
  const payload = {
    operator_name: 'inspect_test',
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('stock_movements').insert(payload).select();
  console.log('insert result:', { error: error ? error.message : null, data });
  if (data && data.length > 0) {
    const id = data[0].id;
    console.log('Retrieved row columns:', Object.keys(data[0]));
    const { error: delError } = await supabase.from('stock_movements').delete().eq('id', id);
    console.log('Delete result:', delError ? delError.message : 'deleted');
  }
}

inspect().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
