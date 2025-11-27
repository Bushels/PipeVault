/**
 * Delete Mpsgroup company and all associated data
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function deleteMpsgroup() {
  console.log('\n========================================');
  console.log('DELETING MPSGROUP COMPANY');
  console.log('========================================\n');

  // Find Mpsgroup company
  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .neq('domain', 'bushelsenergy.com');
  
  if (!companies || companies.length === 0) {
    console.log('✅ No companies to delete!');
    return;
  }
  
  console.log('Found companies to delete:');
  companies.forEach(c => {
    console.log(`  - ${c.name} (${c.domain})`);
  });
  
  const companyIds = companies.map(c => c.id);
  
  console.log('\n⚠️  Deleting in 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Delete in order
  console.log('\n1. Finding and deleting storage requests...');
  const { data: requests } = await supabase
    .from('storage_requests')
    .select('id')
    .in('company_id', companyIds);
  const requestIds = requests?.map(r => r.id) || [];
  
  if (requestIds.length > 0) {
    // Delete trucking loads
    const { data: loads } = await supabase
      .from('trucking_loads')
      .select('id')
      .in('storage_request_id', requestIds);
    const loadIds = loads?.map(l => l.id) || [];
    
    if (loadIds.length > 0) {
      await supabase.from('trucking_documents').delete().in('trucking_load_id', loadIds);
      await supabase.from('trucking_loads').delete().in('id', loadIds);
    }
    
    // Delete shipments
    const { data: shipments } = await supabase
      .from('shipments')
      .select('id')
      .in('company_id', companyIds);
    const shipmentIds = shipments?.map(s => s.id) || [];
    
    if (shipmentIds.length > 0) {
      await supabase.from('shipment_items').delete().in('shipment_id', shipmentIds);
      await supabase.from('shipment_documents').delete().in('shipment_id', shipmentIds);
      await supabase.from('dock_appointments').delete().in('shipment_id', shipmentIds);
      await supabase.from('shipment_trucks').delete().in('shipment_id', shipmentIds);
      await supabase.from('shipments').delete().in('id', shipmentIds);
    }
    
    await supabase.from('inventory').delete().in('company_id', companyIds);
    await supabase.from('conversations').delete().in('company_id', companyIds);
    await supabase.from('documents').delete().in('company_id', companyIds);
    await supabase.from('storage_requests').delete().in('id', requestIds);
  }
  
  // Reset racks
  console.log('2. Resetting racks...');
  // @ts-ignore
  await supabase.from('racks').update({
    company_id: null,
    status: 'AVAILABLE',
    utilization_percentage: 0,
    current_joints: 0,
    current_length_ft: 0,
    current_weight_lbs: 0
  }).in('company_id', companyIds);
  
  // Delete company
  console.log('3. Deleting company...');
  await supabase.from('companies').delete().in('id', companyIds);
  
  // Delete users
  console.log('4. Deleting associated users...');
  const { data: authData } = await supabase.auth.admin.listUsers();
  const usersToDelete = authData?.users.filter(u => 
    u.user_metadata?.company_id && companyIds.includes(u.user_metadata.company_id)
  ) || [];
  
  for (const user of usersToDelete) {
    await supabase.auth.admin.deleteUser(user.id);
  }
  
  console.log('\n✅ Mpsgroup deleted successfully!');
  console.log('========================================\n');
}

deleteMpsgroup().catch(console.error);
