/**
 * Company Data Cleanup Script
 *
 * Purpose: Remove all companies and their associated data EXCEPT 'Bushels' (bushelsenergy.com).
 *          Also resets racks assigned to deleted companies.
 * Database: PipeVault Production
 * Author: Antigravity Agent
 * Date: 2025-11-19
 *
 * Usage:
 *   1. Run discovery: npx tsx scripts/cleanup-companies.ts discover
 *   2. Run cleanup:   npx tsx scripts/cleanup-companies.ts cleanup
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const KEEP_DOMAIN = 'bushelsenergy.com';

// Create Supabase client with service role key to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface DiscoveryReport {
  companiesToDelete: any[];
  usersToDelete: any[];
  storageRequests: any[];
  truckingLoads: any[];
  truckingDocuments: any[];
  inventory: any[];
  conversations: any[];
  documents: any[];
  shipments: any[];
  shipmentTrucks: any[];
  dockAppointments: any[];
  shipmentDocuments: any[];
  shipmentItems: any[];
  notifications: any[];
  racksToReset: any[];
}

async function discoverData(): Promise<DiscoveryReport> {
  console.log('\n========================================');
  console.log('PHASE 1: DISCOVERING DATA TO DELETE');
  console.log('========================================\n');

  const report: DiscoveryReport = {
    companiesToDelete: [],
    usersToDelete: [],
    storageRequests: [],
    truckingLoads: [],
    truckingDocuments: [],
    inventory: [],
    conversations: [],
    documents: [],
    shipments: [],
    shipmentTrucks: [],
    dockAppointments: [],
    shipmentDocuments: [],
    shipmentItems: [],
    notifications: [],
    racksToReset: [],
  };

  // 1. Identify Companies to Delete
  console.log(`1. Finding companies (keeping ${KEEP_DOMAIN})...`);
  const { data: allCompanies, error: companiesError } = await supabase
    .from('companies')
    .select('*');

  if (companiesError) {
    console.error('Error fetching companies:', companiesError);
    return report;
  }

  report.companiesToDelete = allCompanies.filter(c => c.domain !== KEEP_DOMAIN);
  const companiesToKeep = allCompanies.filter(c => c.domain === KEEP_DOMAIN);

  console.log(`   Found ${allCompanies.length} total companies.`);
  console.log(`   Keeping: ${companiesToKeep.map(c => c.name).join(', ')}`);
  console.log(`   Deleting: ${report.companiesToDelete.length} companies`);

  if (report.companiesToDelete.length === 0) {
    console.log('   No companies to delete. Exiting.');
    return report;
  }

  const companyIds = report.companiesToDelete.map(c => c.id);

  // 2. Find Users linked to these companies
  console.log('2. Finding linked users...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (!authError) {
    report.usersToDelete = authUsers.users.filter(u => 
      u.user_metadata?.company_id && companyIds.includes(u.user_metadata.company_id)
    );
    console.log(`   Found ${report.usersToDelete.length} users to delete`);
  }
  const userIds = report.usersToDelete.map(u => u.id);

  // 3. Find Storage Requests
  console.log('3. Finding storage requests...');
  const { data: requests, error: reqError } = await supabase
    .from('storage_requests')
    .select('*')
    .in('company_id', companyIds);
  
  if (!reqError) {
    report.storageRequests = requests || [];
    console.log(`   Found ${report.storageRequests.length} requests`);
  }
  const requestIds = report.storageRequests.map(r => r.id);

  // 4. Find Trucking Loads
  if (requestIds.length > 0) {
    console.log('4. Finding trucking loads...');
    const { data: loads, error: loadError } = await supabase
      .from('trucking_loads')
      .select('*')
      .in('storage_request_id', requestIds);
    
    if (!loadError) {
      report.truckingLoads = loads || [];
      console.log(`   Found ${report.truckingLoads.length} loads`);
    }
    const loadIds = report.truckingLoads.map(l => l.id);

    // 5. Find Trucking Documents
    if (loadIds.length > 0) {
      console.log('5. Finding trucking documents...');
      const { data: docs, error: docError } = await supabase
        .from('trucking_documents')
        .select('*')
        .in('trucking_load_id', loadIds);
      
      if (!docError) {
        report.truckingDocuments = docs || [];
        console.log(`   Found ${report.truckingDocuments.length} trucking documents`);
      }
    }
  }

  // 6. Find Inventory
  console.log('6. Finding inventory...');
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('*')
    .in('company_id', companyIds);
  
  if (!invError) {
    report.inventory = inventory || [];
    console.log(`   Found ${report.inventory.length} inventory items`);
  }

  // 7. Find Shipments
  console.log('7. Finding shipments...');
  const { data: shipments, error: shipError } = await supabase
    .from('shipments')
    .select('*')
    .in('company_id', companyIds);
  
  if (!shipError) {
    report.shipments = shipments || [];
    console.log(`   Found ${report.shipments.length} shipments`);
  }
  const shipmentIds = report.shipments.map(s => s.id);

  if (shipmentIds.length > 0) {
    // 8. Find Shipment Trucks
    console.log('8. Finding shipment trucks...');
    const { data: trucks, error: truckError } = await supabase
      .from('shipment_trucks')
      .select('*')
      .in('shipment_id', shipmentIds);
    if (!truckError) report.shipmentTrucks = trucks || [];

    // 9. Find Dock Appointments
    console.log('9. Finding dock appointments...');
    const { data: appts, error: apptError } = await supabase
      .from('dock_appointments')
      .select('*')
      .in('shipment_id', shipmentIds);
    if (!apptError) report.dockAppointments = appts || [];

    // 10. Find Shipment Documents
    console.log('10. Finding shipment documents...');
    const { data: shipDocs, error: shipDocError } = await supabase
      .from('shipment_documents')
      .select('*')
      .in('shipment_id', shipmentIds);
    if (!shipDocError) report.shipmentDocuments = shipDocs || [];

    // 11. Find Shipment Items
    console.log('11. Finding shipment items...');
    const { data: items, error: itemError } = await supabase
      .from('shipment_items')
      .select('*')
      .in('shipment_id', shipmentIds);
    if (!itemError) report.shipmentItems = items || [];
  }

  // 12. Find Conversations
  console.log('12. Finding conversations...');
  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .in('company_id', companyIds);
  if (!convError) {
    report.conversations = convs || [];
    console.log(`   Found ${report.conversations.length} conversations`);
  }

  // 13. Find Documents (General)
  console.log('13. Finding general documents...');
  const { data: docs, error: docError } = await supabase
    .from('documents')
    .select('*')
    .in('company_id', companyIds);
  if (!docError) {
    report.documents = docs || [];
    console.log(`   Found ${report.documents.length} documents`);
  }

  // 14. Find Notifications
  console.log('14. Finding notifications...');
  if (userIds.length > 0 || companyIds.length > 0) {
    const { data: notifs, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.in.(${userIds.join(',')}),company_id.in.(${companyIds.join(',')})`);
    if (!notifError) {
      report.notifications = notifs || [];
      console.log(`   Found ${report.notifications.length} notifications`);
    }
  }

  // 15. Find Racks to Reset
  console.log('15. Finding racks to reset...');
  const { data: racks, error: rackError } = await supabase
    .from('racks')
    .select('*')
    .in('company_id', companyIds);
  
  if (!rackError) {
    report.racksToReset = racks || [];
    console.log(`   Found ${report.racksToReset.length} racks to reset`);
  }

  return report;
}

async function cleanupData(report: DiscoveryReport) {
  console.log('\n========================================');
  console.log('PHASE 2: EXECUTING CLEANUP');
  console.log('========================================\n');

  console.log('⚠️  WARNING: Deleting data in 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const companyIds = report.companiesToDelete.map(c => c.id);
  const requestIds = report.storageRequests.map(r => r.id);
  const shipmentIds = report.shipments.map(s => s.id);
  const loadIds = report.truckingLoads.map(l => l.id);
  const userIds = report.usersToDelete.map(u => u.id);

  // 1. Notifications
  if (report.notifications.length > 0) {
    console.log('Deleting notifications...');
    await supabase.from('notifications').delete().or(`user_id.in.(${userIds.join(',')}),company_id.in.(${companyIds.join(',')})`);
  }

  // 2. Shipment Children
  if (shipmentIds.length > 0) {
    console.log('Deleting shipment children...');
    await supabase.from('shipment_items').delete().in('shipment_id', shipmentIds);
    await supabase.from('shipment_documents').delete().in('shipment_id', shipmentIds);
    await supabase.from('dock_appointments').delete().in('shipment_id', shipmentIds);
    await supabase.from('shipment_trucks').delete().in('shipment_id', shipmentIds);
  }

  // 3. Shipments
  if (shipmentIds.length > 0) {
    console.log('Deleting shipments...');
    await supabase.from('shipments').delete().in('id', shipmentIds);
  }

  // 4. Trucking Documents
  if (loadIds.length > 0) {
    console.log('Deleting trucking documents...');
    await supabase.from('trucking_documents').delete().in('trucking_load_id', loadIds);
  }

  // 5. Inventory
  if (report.inventory.length > 0) {
    console.log('Deleting inventory...');
    await supabase.from('inventory').delete().in('company_id', companyIds);
  }

  // 6. Trucking Loads
  if (loadIds.length > 0) {
    console.log('Deleting trucking loads...');
    await supabase.from('trucking_loads').delete().in('id', loadIds);
  }

  // 7. Conversations
  if (report.conversations.length > 0) {
    console.log('Deleting conversations...');
    await supabase.from('conversations').delete().in('company_id', companyIds);
  }

  // 8. Documents
  if (report.documents.length > 0) {
    console.log('Deleting documents...');
    await supabase.from('documents').delete().in('company_id', companyIds);
  }

  // 9. Storage Requests
  if (report.storageRequests.length > 0) {
    console.log('Deleting storage requests...');
    await supabase.from('storage_requests').delete().in('company_id', companyIds);
  }

  // 10. Reset Racks
  if (report.racksToReset.length > 0) {
    console.log('Resetting racks...');
    const rackIds = report.racksToReset.map(r => r.id);
    // @ts-ignore
    await supabase.from('racks').update({
      company_id: null,
      status: 'AVAILABLE',
      utilization_percentage: 0,
      current_joints: 0,
      current_length_ft: 0,
      current_weight_lbs: 0,
      updated_at: new Date().toISOString()
    }).in('id', rackIds);
  }

  // 11. Companies
  if (companyIds.length > 0) {
    console.log('Deleting companies...');
    await supabase.from('companies').delete().in('id', companyIds);
  }

  // 12. Auth Users
  if (userIds.length > 0) {
    console.log('Deleting auth users...');
    for (const id of userIds) {
      await supabase.auth.admin.deleteUser(id);
    }
  }

  console.log('\n✅ Cleanup complete!');
}

async function main() {
  const command = process.argv[2];
  
  if (command === 'cleanup') {
    const report = await discoverData();
    if (report.companiesToDelete.length > 0) {
      await cleanupData(report);
    } else {
      console.log('Nothing to clean up.');
    }
  } else {
    await discoverData();
    console.log('\nTo execute cleanup, run: npx tsx scripts/cleanup-companies.ts cleanup');
  }
}

main().catch(console.error);
