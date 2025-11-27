/**
 * Verification Script - Check cleanup results
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  console.log('\n========================================');
  console.log('VERIFICATION REPORT');
  console.log('========================================\n');

  // Check companies
  const { data: companies } = await supabase.from('companies').select('*');
  console.log(`Companies remaining: ${companies?.length || 0}`);
  companies?.forEach(c => console.log(`  - ${c.name} (${c.domain})`));

  // Check storage requests
  const { data: requests } = await supabase.from('storage_requests').select('*');
  console.log(`\nStorage Requests: ${requests?.length || 0}`);

  // Check inventory
  const { data: inventory } = await supabase.from('inventory').select('*');
  console.log(`Inventory Items: ${inventory?.length || 0}`);

  // Check shipments
  const { data: shipments } = await supabase.from('shipments').select('*');
  console.log(`Shipments: ${shipments?.length || 0}`);

  // Check racks
  const { data: allRacks } = await supabase.from('racks').select('*');
  const assignedRacks = allRacks?.filter(r => r.company_id) || [];
  const availableRacks = allRacks?.filter(r => !r.company_id) || [];
  
  console.log(`\nRacks Total: ${allRacks?.length || 0}`);
  console.log(`  - Available: ${availableRacks.length}`);
  console.log(`  - Assigned: ${assignedRacks.length}`);
  
  if (assignedRacks.length > 0) {
    console.log('\n  Assigned to:');
    assignedRacks.forEach(r => {
      const company = companies?.find(c => c.id === r.company_id);
      console.log(`    - ${r.name}: ${company?.name || 'Unknown'}`);
    });
  }

  console.log('\n========================================\n');
  console.log('✅ Verification complete!');
}

verify().catch(console.error);
