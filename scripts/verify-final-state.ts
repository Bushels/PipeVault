/**
 * Detailed Verification - Show exact current state
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  console.log('\n========================================');
  console.log('CURRENT DATABASE STATE');
  console.log('========================================\n');

  // Check companies
  const { data: companies } = await supabase.from('companies').select('*');
  console.log('📊 COMPANIES:');
  console.log(`   Total: ${companies?.length || 0}\n`);
  companies?.forEach(c => {
    console.log(`   ✓ Name: ${c.name}`);
    console.log(`     Domain: ${c.domain}`);
    console.log(`     ID: ${c.id}\n`);
  });

  // Check auth users
  const { data: authData } = await supabase.auth.admin.listUsers();
  console.log('👤 AUTH USERS:');
  console.log(`   Total: ${authData?.users?.length || 0}\n`);
  authData?.users?.forEach(u => {
    console.log(`   ✓ Email: ${u.email}`);
    console.log(`     ID: ${u.id}`);
    console.log(`     Company ID: ${u.user_metadata?.company_id || 'None'}\n`);
  });

  // Check storage requests
  const { data: requests } = await supabase.from('storage_requests').select('*');
  console.log('📝 STORAGE REQUESTS: ' + (requests?.length || 0));

  // Check inventory
  const { data: inventory } = await supabase.from('inventory').select('*');
  console.log('📦 INVENTORY ITEMS: ' + (inventory?.length || 0));

  // Check shipments
  const { data: shipments } = await supabase.from('shipments').select('*');
  console.log('🚚 SHIPMENTS: ' + (shipments?.length || 0));

  // Check trucking loads
  const { data: loads } = await supabase.from('trucking_loads').select('*');
  console.log('🚛 TRUCKING LOADS: ' + (loads?.length || 0));

  // Check conversations
  const { data: convs } = await supabase.from('conversations').select('*');
  console.log('💬 CONVERSATIONS: ' + (convs?.length || 0));

  // Check racks
  const { data: allRacks } = await supabase.from('racks').select('*');
  const assignedRacks = allRacks?.filter(r => r.company_id) || [];
  const availableRacks = allRacks?.filter(r => !r.company_id) || [];
  
  console.log('\n🏢 RACKS:');
  console.log(`   Total: ${allRacks?.length || 0}`);
  console.log(`   Available: ${availableRacks.length}`);
  console.log(`   Assigned: ${assignedRacks.length}`);
  
  if (assignedRacks.length > 0) {
    console.log('\n   Assigned Racks:');
    assignedRacks.forEach(r => {
      const company = companies?.find(c => c.id === r.company_id);
      console.log(`     - ${r.name} → ${company?.name || 'Unknown Company'}`);
    });
  }

  console.log('\n========================================');
  
  // Validation
  const expectedCompanyName = 'Bushels';
  const expectedDomain = 'bushelsenergy.com';
  const expectedEmail = 'kyle@bushelsenergy.com';
  
  const hasOnlyBushels = companies?.length === 1 && 
                         companies[0].name === expectedCompanyName && 
                         companies[0].domain === expectedDomain;
  
  const hasOnlyKyle = authData?.users?.length === 1 && 
                      authData.users[0].email === expectedEmail;

  if (hasOnlyBushels && hasOnlyKyle) {
    console.log('\n✅ SUCCESS: Database is in expected state!');
    console.log(`   - Company: ${expectedCompanyName} (${expectedDomain})`);
    console.log(`   - User: ${expectedEmail}`);
  } else {
    console.log('\n⚠️  WARNING: Unexpected state detected:');
    if (!hasOnlyBushels) {
      console.log(`   - Expected 1 company named "${expectedCompanyName}""`);
      console.log(`     Found: ${companies?.length || 0} companies`);
    }
    if (!hasOnlyKyle) {
      console.log(`   - Expected 1 user: ${expectedEmail}`);
      console.log(`     Found: ${authData?.users?.length || 0} users`);
    }
  }
  
  console.log('\n========================================\n');
}

verify().catch(console.error);
