/**
 * Show all companies in detail
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function showCompanies() {
  console.log('\n========================================');
  console.log('ALL COMPANIES IN DATABASE');
  console.log('========================================\n');

  const { data: companies, error } = await supabase.from('companies').select('*');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Total: ${companies?.length || 0}\n`);
  
  companies?.forEach((c, idx) => {
    console.log(`Company #${idx + 1}:`);
    console.log(`  Name: ${c.name}`);
    console.log(`  Domain: ${c.domain}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Created: ${c.created_at}`);
    console.log('');
  });
  
  // Identify which to keep/delete
  const keepDomain = 'bushelsenergy.com';
  const toKeep = companies?.filter(c => c.domain === keepDomain) || [];
  const toDelete = companies?.filter(c => c.domain !== keepDomain) || [];
  
  if (toDelete.length > 0) {
    console.log('⚠️  Companies that should be DELETED:');
    toDelete.forEach(c => {
      console.log(`  ✗ ${c.name} (${c.domain}) - ID: ${c.id}`);
    });
    console.log('');
  }
  
  if (toKeep.length > 0) {
    console.log('✅ Companies to KEEP:');
    toKeep.forEach(c => {
      console.log(`  ✓ ${c.name} (${c.domain}) - ID: ${c.id}`);
    });
  }
  
  console.log('\n========================================\n');
}

showCompanies().catch(console.error);
