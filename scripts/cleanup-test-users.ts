/**
 * Test User Data Cleanup Script
 *
 * Purpose: Safely remove all test data for kyle@bushelsenergy.com and kyle@ibelievefit.com
 * Database: PipeVault Production (cvevhvjxnklbbhtqzyvw.supabase.co)
 * Author: Database Integrity Guardian Agent
 * Date: 2025-11-18
 *
 * IMPORTANT: This script performs permanent deletions. Review the discovery report
 * before executing the cleanup phase.
 *
 * Usage:
 *   1. Run discovery phase: node scripts/cleanup-test-users.ts discover
 *   2. Review the report
 *   3. Run cleanup phase: node scripts/cleanup-test-users.ts cleanup
 *   4. Verify cleanup: node scripts/cleanup-test-users.ts verify
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_EMAILS = ['kyle@bushelsenergy.com', 'kyle@ibelievefit.com'];
const TEST_DOMAINS = ['bushelsenergy.com', 'ibelievefit.com'];

// Create Supabase client with service role key to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface DiscoveryReport {
  authUsers: any[];
  authSessions: any[];
  companies: any[];
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
  notificationQueue: any[];
  filesToDelete: { table: string; path: string; fileName: string }[];
}

/**
 * Phase 1: Discover all data associated with test users
 */
async function discoverTestUserData(): Promise<DiscoveryReport> {
  console.log('\n========================================');
  console.log('PHASE 1: DISCOVERING TEST USER DATA');
  console.log('========================================\n');

  const report: DiscoveryReport = {
    authUsers: [],
    authSessions: [],
    companies: [],
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
    notificationQueue: [],
    filesToDelete: [],
  };

  // 1. Find auth users
  console.log('1. Querying auth.users...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error fetching auth users:', authError);
  } else {
    report.authUsers = authUsers.users.filter(u => TEST_EMAILS.includes(u.email || ''));
    console.log(`   Found ${report.authUsers.length} auth users`);
  }

  const userIds = report.authUsers.map(u => u.id);
  const companyIdsFromMeta = report.authUsers
    .map(u => u.user_metadata?.company_id)
    .filter(Boolean);

  // 2. Find companies
  console.log('2. Querying companies...');
  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('*')
    .or(`domain.in.(${TEST_DOMAINS.join(',')}),id.in.(${companyIdsFromMeta.join(',')})`);

  if (companiesError) {
    console.error('Error fetching companies:', companiesError);
  } else {
    report.companies = companies || [];
    console.log(`   Found ${report.companies.length} companies`);
  }

  const companyIds = report.companies.map(c => c.id);

  if (companyIds.length === 0) {
    console.log('\n⚠️  No companies found. Skipping company-dependent queries.');
    return report;
  }

  // 3. Find storage requests
  console.log('3. Querying storage_requests...');
  const { data: storageRequests, error: requestsError } = await supabase
    .from('storage_requests')
    .select('*')
    .or(`company_id.in.(${companyIds.join(',')}),user_email.in.(${TEST_EMAILS.join(',')})`);

  if (requestsError) {
    console.error('Error fetching storage requests:', requestsError);
  } else {
    report.storageRequests = storageRequests || [];
    console.log(`   Found ${report.storageRequests.length} storage requests`);
  }

  const requestIds = report.storageRequests.map(r => r.id);

  if (requestIds.length === 0) {
    console.log('   No storage requests found. Skipping request-dependent queries.');
  } else {
    // 4. Find trucking loads
    console.log('4. Querying trucking_loads...');
    const { data: truckingLoads, error: loadsError } = await supabase
      .from('trucking_loads')
      .select('*')
      .in('storage_request_id', requestIds);

    if (loadsError) {
      console.error('Error fetching trucking loads:', loadsError);
    } else {
      report.truckingLoads = truckingLoads || [];
      console.log(`   Found ${report.truckingLoads.length} trucking loads`);
    }

    const loadIds = report.truckingLoads.map(l => l.id);

    if (loadIds.length > 0) {
      // 5. Find trucking documents
      console.log('5. Querying trucking_documents...');
      const { data: truckingDocs, error: docsError } = await supabase
        .from('trucking_documents')
        .select('*')
        .in('trucking_load_id', loadIds);

      if (docsError) {
        console.error('Error fetching trucking documents:', docsError);
      } else {
        report.truckingDocuments = truckingDocs || [];
        console.log(`   Found ${report.truckingDocuments.length} trucking documents`);

        // Track files to delete
        report.truckingDocuments.forEach(doc => {
          report.filesToDelete.push({
            table: 'trucking_documents',
            path: doc.storage_path,
            fileName: doc.file_name,
          });
        });
      }
    }

    // 6. Find shipments
    console.log('6. Querying shipments...');
    const { data: shipments, error: shipmentsError } = await supabase
      .from('shipments')
      .select('*')
      .or(`request_id.in.(${requestIds.join(',')}),company_id.in.(${companyIds.join(',')})`);

    if (shipmentsError) {
      console.error('Error fetching shipments:', shipmentsError);
    } else {
      report.shipments = shipments || [];
      console.log(`   Found ${report.shipments.length} shipments`);
    }

    const shipmentIds = report.shipments.map(s => s.id);

    if (shipmentIds.length > 0) {
      // 7. Find shipment trucks
      console.log('7. Querying shipment_trucks...');
      const { data: shipmentTrucks, error: trucksError } = await supabase
        .from('shipment_trucks')
        .select('*')
        .in('shipment_id', shipmentIds);

      if (trucksError) {
        console.error('Error fetching shipment trucks:', trucksError);
      } else {
        report.shipmentTrucks = shipmentTrucks || [];
        console.log(`   Found ${report.shipmentTrucks.length} shipment trucks`);
      }

      // 8. Find dock appointments
      console.log('8. Querying dock_appointments...');
      const { data: appointments, error: appointmentsError } = await supabase
        .from('dock_appointments')
        .select('*')
        .in('shipment_id', shipmentIds);

      if (appointmentsError) {
        console.error('Error fetching dock appointments:', appointmentsError);
      } else {
        report.dockAppointments = appointments || [];
        console.log(`   Found ${report.dockAppointments.length} dock appointments`);
      }

      // 9. Find shipment documents
      console.log('9. Querying shipment_documents...');
      const { data: shipmentDocs, error: shipmentDocsError } = await supabase
        .from('shipment_documents')
        .select('*')
        .in('shipment_id', shipmentIds);

      if (shipmentDocsError) {
        console.error('Error fetching shipment documents:', shipmentDocsError);
      } else {
        report.shipmentDocuments = shipmentDocs || [];
        console.log(`   Found ${report.shipmentDocuments.length} shipment documents`);
      }

      // 10. Find shipment items
      console.log('10. Querying shipment_items...');
      const { data: shipmentItems, error: itemsError } = await supabase
        .from('shipment_items')
        .select('*')
        .in('shipment_id', shipmentIds);

      if (itemsError) {
        console.error('Error fetching shipment items:', itemsError);
      } else {
        report.shipmentItems = shipmentItems || [];
        console.log(`   Found ${report.shipmentItems.length} shipment items`);
      }
    }

    // 11. Find conversations
    console.log('11. Querying conversations...');
    const { data: conversations, error: convsError } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_email.in.(${TEST_EMAILS.join(',')}),request_id.in.(${requestIds.join(',')}),company_id.in.(${companyIds.join(',')})`);

    if (convsError) {
      console.error('Error fetching conversations:', convsError);
    } else {
      report.conversations = conversations || [];
      console.log(`   Found ${report.conversations.length} conversations`);
    }

    // 12. Find documents
    console.log('12. Querying documents...');
    const { data: documents, error: documentsError } = await supabase
      .from('documents')
      .select('*')
      .or(`request_id.in.(${requestIds.join(',')}),company_id.in.(${companyIds.join(',')})`);

    if (documentsError) {
      console.error('Error fetching documents:', documentsError);
    } else {
      report.documents = documents || [];
      console.log(`   Found ${report.documents.length} documents`);

      // Track files to delete
      report.documents.forEach(doc => {
        report.filesToDelete.push({
          table: 'documents',
          path: doc.storage_path,
          fileName: doc.file_name,
        });
      });
    }
  }

  // 13. Find inventory
  console.log('13. Querying inventory...');
  const { data: inventory, error: inventoryError } = await supabase
    .from('inventory')
    .select('*')
    .in('company_id', companyIds);

  if (inventoryError) {
    console.error('Error fetching inventory:', inventoryError);
  } else {
    report.inventory = inventory || [];
    console.log(`   Found ${report.inventory.length} inventory items`);
  }

  // 14. Find notifications
  console.log('14. Querying notifications...');
  if (userIds.length > 0) {
    const { data: notifications, error: notifsError } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.in.(${userIds.join(',')}),company_id.in.(${companyIds.join(',')})`);

    if (notifsError) {
      console.error('Error fetching notifications:', notifsError);
    } else {
      report.notifications = notifications || [];
      console.log(`   Found ${report.notifications.length} notifications`);
    }
  }

  // 15. Find notification queue
  console.log('15. Querying notification_queue...');
  const { data: notifQueue, error: queueError } = await supabase
    .from('notification_queue')
    .select('*')
    .in('recipient_email', TEST_EMAILS);

  if (queueError) {
    console.error('Error fetching notification queue:', queueError);
  } else {
    report.notificationQueue = notifQueue || [];
    console.log(`   Found ${report.notificationQueue.length} notification queue entries`);
  }

  return report;
}

/**
 * Print discovery report
 */
function printDiscoveryReport(report: DiscoveryReport): void {
  console.log('\n========================================');
  console.log('DISCOVERY REPORT SUMMARY');
  console.log('========================================\n');

  console.log('Test Users:', TEST_EMAILS.join(', '));
  console.log('Test Domains:', TEST_DOMAINS.join(', '));
  console.log('');

  console.log('Data Found:');
  console.log(`  - Auth Users:           ${report.authUsers.length}`);
  console.log(`  - Auth Sessions:        ${report.authSessions.length}`);
  console.log(`  - Companies:            ${report.companies.length}`);
  console.log(`  - Storage Requests:     ${report.storageRequests.length}`);
  console.log(`  - Trucking Loads:       ${report.truckingLoads.length}`);
  console.log(`  - Trucking Documents:   ${report.truckingDocuments.length}`);
  console.log(`  - Inventory Items:      ${report.inventory.length}`);
  console.log(`  - Conversations:        ${report.conversations.length}`);
  console.log(`  - Documents:            ${report.documents.length}`);
  console.log(`  - Shipments:            ${report.shipments.length}`);
  console.log(`  - Shipment Trucks:      ${report.shipmentTrucks.length}`);
  console.log(`  - Dock Appointments:    ${report.dockAppointments.length}`);
  console.log(`  - Shipment Documents:   ${report.shipmentDocuments.length}`);
  console.log(`  - Shipment Items:       ${report.shipmentItems.length}`);
  console.log(`  - Notifications:        ${report.notifications.length}`);
  console.log(`  - Notification Queue:   ${report.notificationQueue.length}`);
  console.log(`  - Files to Delete:      ${report.filesToDelete.length}`);
  console.log('');

  if (report.companies.length > 0) {
    console.log('Companies:');
    report.companies.forEach(c => {
      console.log(`  - ${c.name} (${c.domain}) - ID: ${c.id}`);
    });
    console.log('');
  }

  if (report.filesToDelete.length > 0) {
    console.log('Files to Delete from Storage:');
    report.filesToDelete.forEach(f => {
      console.log(`  - [${f.table}] ${f.path}`);
    });
    console.log('');
  }

  console.log('========================================\n');
}

/**
 * Phase 2: Delete data in correct order (respecting FK constraints)
 */
async function cleanupTestUserData(report: DiscoveryReport): Promise<void> {
  console.log('\n========================================');
  console.log('PHASE 2: CLEANUP TEST USER DATA');
  console.log('========================================\n');

  console.log('⚠️  WARNING: This will PERMANENTLY delete all test data!');
  console.log('Press Ctrl+C within 5 seconds to abort...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const companyIds = report.companies.map(c => c.id);
  const requestIds = report.storageRequests.map(r => r.id);
  const loadIds = report.truckingLoads.map(l => l.id);
  const shipmentIds = report.shipments.map(s => s.id);
  const userIds = report.authUsers.map(u => u.id);

  // Deletion order (children first, parents last):
  // 1. Notification queue
  // 2. Notifications
  // 3. Shipment items
  // 4. Shipment documents
  // 5. Dock appointments
  // 6. Shipment trucks
  // 7. Shipments
  // 8. Trucking documents
  // 9. Inventory
  // 10. Trucking loads
  // 11. Conversations
  // 12. Documents
  // 13. Storage requests
  // 14. Companies
  // 15. Auth sessions
  // 16. Auth users
  // 17. Storage files

  let totalDeleted = 0;

  // 1. Delete notification queue entries
  if (report.notificationQueue.length > 0) {
    console.log('1. Deleting notification_queue entries...');
    const { error } = await supabase
      .from('notification_queue')
      .delete()
      .in('recipient_email', TEST_EMAILS);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.notificationQueue.length} notification queue entries`);
      totalDeleted += report.notificationQueue.length;
    }
  }

  // 2. Delete notifications
  if (report.notifications.length > 0 && userIds.length > 0) {
    console.log('2. Deleting notifications...');
    const { error } = await supabase
      .from('notifications')
      .delete()
      .or(`user_id.in.(${userIds.join(',')}),company_id.in.(${companyIds.join(',')})`);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.notifications.length} notifications`);
      totalDeleted += report.notifications.length;
    }
  }

  // 3. Delete shipment items
  if (report.shipmentItems.length > 0) {
    console.log('3. Deleting shipment_items...');
    const { error } = await supabase
      .from('shipment_items')
      .delete()
      .in('shipment_id', shipmentIds);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.shipmentItems.length} shipment items`);
      totalDeleted += report.shipmentItems.length;
    }
  }

  // 4. Delete shipment documents
  if (report.shipmentDocuments.length > 0) {
    console.log('4. Deleting shipment_documents...');
    const { error } = await supabase
      .from('shipment_documents')
      .delete()
      .in('shipment_id', shipmentIds);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.shipmentDocuments.length} shipment documents`);
      totalDeleted += report.shipmentDocuments.length;
    }
  }

  // 5. Delete dock appointments
  if (report.dockAppointments.length > 0) {
    console.log('5. Deleting dock_appointments...');
    const { error } = await supabase
      .from('dock_appointments')
      .delete()
      .in('shipment_id', shipmentIds);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.dockAppointments.length} dock appointments`);
      totalDeleted += report.dockAppointments.length;
    }
  }

  // 6. Delete shipment trucks
  if (report.shipmentTrucks.length > 0) {
    console.log('6. Deleting shipment_trucks...');
    const { error } = await supabase
      .from('shipment_trucks')
      .delete()
      .in('shipment_id', shipmentIds);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.shipmentTrucks.length} shipment trucks`);
      totalDeleted += report.shipmentTrucks.length;
    }
  }

  // 7. Delete shipments
  if (report.shipments.length > 0) {
    console.log('7. Deleting shipments...');
    const { error } = await supabase
      .from('shipments')
      .delete()
      .or(`request_id.in.(${requestIds.join(',')}),company_id.in.(${companyIds.join(',')})`);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.shipments.length} shipments`);
      totalDeleted += report.shipments.length;
    }
  }

  // 8. Delete trucking documents (CASCADE should handle, but explicit is safer)
  if (report.truckingDocuments.length > 0) {
    console.log('8. Deleting trucking_documents...');
    const { error } = await supabase
      .from('trucking_documents')
      .delete()
      .in('trucking_load_id', loadIds);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.truckingDocuments.length} trucking documents`);
      totalDeleted += report.truckingDocuments.length;
    }
  }

  // 9. Delete inventory (must happen before trucking_loads due to FK)
  if (report.inventory.length > 0) {
    console.log('9. Deleting inventory...');
    const { error } = await supabase
      .from('inventory')
      .delete()
      .in('company_id', companyIds);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.inventory.length} inventory items`);
      totalDeleted += report.inventory.length;
    }
  }

  // 10. Delete trucking loads
  if (report.truckingLoads.length > 0) {
    console.log('10. Deleting trucking_loads...');
    const { error } = await supabase
      .from('trucking_loads')
      .delete()
      .in('storage_request_id', requestIds);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.truckingLoads.length} trucking loads`);
      totalDeleted += report.truckingLoads.length;
    }
  }

  // 11. Delete conversations
  if (report.conversations.length > 0) {
    console.log('11. Deleting conversations...');
    const { error } = await supabase
      .from('conversations')
      .delete()
      .or(`user_email.in.(${TEST_EMAILS.join(',')}),request_id.in.(${requestIds.join(',')}),company_id.in.(${companyIds.join(',')})`);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.conversations.length} conversations`);
      totalDeleted += report.conversations.length;
    }
  }

  // 12. Delete documents
  if (report.documents.length > 0) {
    console.log('12. Deleting documents...');
    const { error } = await supabase
      .from('documents')
      .delete()
      .or(`request_id.in.(${requestIds.join(',')}),company_id.in.(${companyIds.join(',')})`);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.documents.length} documents`);
      totalDeleted += report.documents.length;
    }
  }

  // 13. Delete storage requests
  if (report.storageRequests.length > 0) {
    console.log('13. Deleting storage_requests...');
    const { error } = await supabase
      .from('storage_requests')
      .delete()
      .or(`company_id.in.(${companyIds.join(',')}),user_email.in.(${TEST_EMAILS.join(',')})`);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.storageRequests.length} storage requests`);
      totalDeleted += report.storageRequests.length;
    }
  }

  // 14. Delete companies
  if (report.companies.length > 0) {
    console.log('14. Deleting companies...');
    const { error } = await supabase
      .from('companies')
      .delete()
      .or(`domain.in.(${TEST_DOMAINS.join(',')}),id.in.(${companyIds.join(',')})`);

    if (error) {
      console.error('   ❌ Error:', error);
    } else {
      console.log(`   ✅ Deleted ${report.companies.length} companies`);
      totalDeleted += report.companies.length;
    }
  }

  // 15 & 16. Delete auth users (sessions will cascade)
  if (report.authUsers.length > 0) {
    console.log('15. Deleting auth users (sessions will cascade)...');
    for (const user of report.authUsers) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        console.error(`   ❌ Error deleting user ${user.email}:`, error);
      } else {
        console.log(`   ✅ Deleted user: ${user.email}`);
        totalDeleted++;
      }
    }
  }

  // 17. Delete storage files
  if (report.filesToDelete.length > 0) {
    console.log('16. Deleting storage files...');
    for (const file of report.filesToDelete) {
      // Extract bucket and path from storage_path
      // Typical format: "company_id/folder/filename" or just the path
      const pathParts = file.path.split('/');
      const bucket = pathParts[0]; // Assuming first part is bucket or company folder

      // Try to delete from common buckets
      const bucketsToTry = ['trucking-documents', 'documents', 'public'];

      for (const bucketName of bucketsToTry) {
        const { error } = await supabase.storage
          .from(bucketName)
          .remove([file.path]);

        if (!error) {
          console.log(`   ✅ Deleted file: ${file.path} from bucket: ${bucketName}`);
          break;
        }
      }
    }
  }

  console.log(`\n✅ Cleanup complete! Total records deleted: ${totalDeleted}`);
}

/**
 * Phase 3: Verify cleanup was successful
 */
async function verifyCleanup(): Promise<void> {
  console.log('\n========================================');
  console.log('PHASE 3: VERIFYING CLEANUP');
  console.log('========================================\n');

  const report = await discoverTestUserData();

  const totalRemaining =
    report.authUsers.length +
    report.companies.length +
    report.storageRequests.length +
    report.truckingLoads.length +
    report.truckingDocuments.length +
    report.inventory.length +
    report.conversations.length +
    report.documents.length +
    report.shipments.length +
    report.shipmentTrucks.length +
    report.dockAppointments.length +
    report.shipmentDocuments.length +
    report.shipmentItems.length +
    report.notifications.length +
    report.notificationQueue.length;

  if (totalRemaining === 0) {
    console.log('✅ SUCCESS: All test user data has been cleaned up!');
    console.log('✅ No orphaned records found.');
  } else {
    console.log('⚠️  WARNING: Some data still remains:');
    printDiscoveryReport(report);
  }

  console.log('\n========================================\n');
}

/**
 * Main execution
 */
async function main() {
  const command = process.argv[2];

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables:');
    console.error('   VITE_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
    console.error('\nPlease set SUPABASE_SERVICE_ROLE_KEY in your .env file.');
    process.exit(1);
  }

  switch (command) {
    case 'discover':
      const report = await discoverTestUserData();
      printDiscoveryReport(report);
      console.log('💡 Next step: Review the report above, then run:');
      console.log('   node scripts/cleanup-test-users.ts cleanup');
      break;

    case 'cleanup':
      const cleanupReport = await discoverTestUserData();
      printDiscoveryReport(cleanupReport);
      await cleanupTestUserData(cleanupReport);
      await verifyCleanup();
      break;

    case 'verify':
      await verifyCleanup();
      break;

    default:
      console.log('Usage:');
      console.log('  node scripts/cleanup-test-users.ts discover  - Discover test user data');
      console.log('  node scripts/cleanup-test-users.ts cleanup   - Clean up test user data');
      console.log('  node scripts/cleanup-test-users.ts verify    - Verify cleanup success');
      process.exit(1);
  }
}

main().catch(console.error);
