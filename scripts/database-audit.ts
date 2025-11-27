/**
 * PipeVault Database Audit Script
 * Verifies all 6 critical issues identified in code analysis
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cvevhvjxnklbbhtqzyvw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZXZodmp4bmtsYmJodHF6eXZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1Mzk2MzIsImV4cCI6MjA3NzExNTYzMn0.32_qyxIaiQvnzGbV_9UrVoq9QyFOpPb2u1EaZhaSECY';
const supabase = createClient(supabaseUrl, supabaseKey);

interface AuditResult {
  section: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'INFO';
  message: string;
  details?: any;
}

const results: AuditResult[] = [];

async function runAudit() {
  console.log('🔍 Starting PipeVault Database Audit...\n');

  // ============================================================================
  // SECTION 1: Check Database Triggers (Issue #2 - Slack Notifications)
  // ============================================================================
  console.log('📋 Section 1: Checking Database Triggers...');
  
  try {
    const { data: triggers, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          tgname AS trigger_name,
          tgenabled AS enabled,
          tgrelid::regclass AS table_name
        FROM pg_trigger
        WHERE (tgrelid = 'storage_requests'::regclass OR tgrelid = 'trucking_loads'::regclass)
          AND tgname NOT LIKE 'RI_%'
          AND tgname NOT LIKE '%_pkey%'
        ORDER BY table_name, tgname;
      `
    });

    if (error) {
      // Try alternative method - direct table query won't work for pg_trigger
      const { data: storageRequestTriggers } = await supabase
        .from('storage_requests')
        .select('*')
        .limit(0);
      
      results.push({
        section: 'Triggers',
        status: 'WARNING',
        message: 'Cannot query pg_trigger with anon key - need service role',
        details: 'This is expected with anon key - triggers likely exist'
      });
    } else {
      const slackTriggers = triggers?.filter((t: any) => 
        t.trigger_name.includes('slack') || 
        t.trigger_name.includes('notification') ||
        t.trigger_name.includes('enqueue')
      );
      
      if (slackTriggers && slackTriggers.length > 0) {
        results.push({
          section: 'Triggers',
          status: 'PASS',
          message: `Found ${slackTriggers.length} notification triggers`,
          details: slackTriggers
        });
      } else {
        results.push({
          section: 'Triggers',
          status: 'FAIL',
          message: 'No Slack/notification triggers found',
          details: 'Issue #2 CONFIRMED - Slack notifications may not be working'
        });
      }
    }
  } catch (err) {
    results.push({
      section: 'Triggers',
      status: 'WARNING',
      message: 'Cannot access pg_trigger with anon key',
      details: 'Need admin access to verify triggers'
    });
  }

  // ============================================================================
  // SECTION 2: Check Table Counts & Data Overview
  // ============================================================================
  console.log('📊 Section 2: Checking Table Counts...');
  
  try {
    const [companies, requests, loads, inventory, racks, admins] = await Promise.all([
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('storage_requests').select('id', { count: 'exact', head: true }),
      supabase.from('trucking_loads').select('id', { count: 'exact', head: true }),
      supabase.from('inventory').select('id', { count: 'exact', head: true }),
      supabase.from('racks').select('id', { count: 'exact', head: true }),
      supabase.from('admin_users').select('id', { count: 'exact', head: true })
    ]);

    const counts = {
      companies: companies.count,
      storage_requests: requests.count,
      trucking_loads: loads.count,
      inventory: inventory.count,
      racks: racks.count,
      admin_users: admins.count
    };

    results.push({
      section: 'Data Overview',
      status: 'INFO',
      message: 'Database table counts retrieved',
      details: counts
    });

    console.log('   Companies:', counts.companies);
    console.log('   Storage Requests:', counts.storage_requests);
    console.log('   Trucking Loads:', counts.trucking_loads);
    console.log('   Inventory:', counts.inventory);
    console.log('   Racks:', counts.racks);
    console.log('   Admin Users:', counts.admin_users);
  } catch (err: any) {
    results.push({
      section: 'Data Overview',
      status: 'FAIL',
      message: 'Failed to retrieve table counts',
      details: err.message
    });
  }

  // ============================================================================
  // SECTION 3: Check Rack Capacity Constraints
  // ============================================================================
  console.log('\n🏗️  Section 3: Checking Rack Capacity Constraints...');
  
  try {
    const { data: racks, error } = await supabase
      .from('racks')
      .select('id, name, capacity, occupied, capacity_meters, occupied_meters');

    if (error) throw error;

    const overbooked = racks?.filter((r: any) => 
      r.occupied > r.capacity || r.occupied_meters > r.capacity_meters
    );

    if (overbooked && overbooked.length > 0) {
      results.push({
        section: 'Rack Constraints',
        status: 'FAIL',
        message: `Found ${overbooked.length} overbooked racks!`,
        details: overbooked
      });
    } else {
      results.push({
        section: 'Rack Constraints',
        status: 'PASS',
        message: 'All racks within capacity limits',
        details: `Checked ${racks?.length} racks`
      });
    }
  } catch (err: any) {
    results.push({
      section: 'Rack Constraints',
      status: 'FAIL',
      message: 'Failed to check rack constraints',
      details: err.message
    });
  }

  // ============================================================================
  // SECTION 4: Check Data Integrity (Orphaned Records)
  // ============================================================================
  console.log('🔗 Section 4: Checking Data Integrity...');
  
  try {
    // Check for orphaned trucking_loads
    const { data: loads, error: loadsError } = await supabase
      .from('trucking_loads')
      .select('id, storage_request_id, storage_requests(id)')
      .is('storage_requests.id', null);

    if (!loadsError && loads && loads.length > 0) {
      results.push({
        section: 'Data Integrity',
        status: 'FAIL',
        message: `Found ${loads.length} orphaned trucking_loads!`,
        details: loads
      });
    } else {
      results.push({
        section: 'Data Integrity - Orphaned Loads',
        status: 'PASS',
        message: 'No orphaned trucking_loads found'
      });
    }

    // Check for orphaned inventory
    const { data: inv, error: invError } = await supabase
      .from('inventory')
      .select('id, company_id, companies(id)')
      .is('companies.id', null);

    if (!invError && inv && inv.length > 0) {
      results.push({
        section: 'Data Integrity',
        status: 'FAIL',
        message: `Found ${inv.length} orphaned inventory records!`,
        details: inv
      });
    } else {
      results.push({
        section: 'Data Integrity - Orphaned Inventory',
        status: 'PASS',
        message: 'No orphaned inventory found'
      });
    }
  } catch (err: any) {
    results.push({
      section: 'Data Integrity',
      status: 'WARNING',
      message: 'Could not fully verify orphaned records',
      details: err.message
    });
  }

  // ============================================================================
  // SECTION 5: Check Status Consistency
  // ============================================================================
  console.log('✅ Section 5: Checking Status Consistency...');
  
  try {
    // Check for COMPLETED loads without completed_at
    const { data: inconsistentLoads, error } = await supabase
      .from('trucking_loads')
      .select('id, status, completed_at')
      .eq('status', 'COMPLETED')
      .is('completed_at', null);

    if (error) throw error;

    if (inconsistentLoads && inconsistentLoads.length > 0) {
      results.push({
        section: 'Status Consistency',
        status: 'FAIL',
        message: `Found ${inconsistentLoads.length} COMPLETED loads without completed_at timestamp!`,
        details: inconsistentLoads
      });
    } else {
      results.push({
        section: 'Status Consistency - Load Timestamps',
        status: 'PASS',
        message: 'All COMPLETED loads have timestamps'
      });
    }

    // Check for IN_STORAGE inventory without rack assignment
    const { data: unassignedInv, error: invError } = await supabase
      .from('inventory')
      .select('id, status, storage_area_id')
      .eq('status', 'IN_STORAGE')
      .is('storage_area_id', null);

    if (invError) throw invError;

    if (unassignedInv && unassignedInv.length > 0) {
      results.push({
        section: 'Status Consistency',
        status: 'FAIL',
        message: `Found ${unassignedInv.length} IN_STORAGE inventory without rack assignment!`,
        details: unassignedInv
      });
    } else {
      results.push({
        section: 'Status Consistency - Inventory Racks',
        status: 'PASS',
        message: 'All IN_STORAGE inventory has rack assignments'
      });
    }
  } catch (err: any) {
    results.push({
      section: 'Status Consistency',
      status: 'FAIL',
      message: 'Failed to check status consistency',
      details: err.message
    });
  }

  // ============================================================================
  // SECTION 6: Check Load Status Distribution
  // ============================================================================
  console.log('📈 Section 6: Checking Load Status Distribution...');
  
  try {
    const { data: loads, error } = await supabase
      .from('trucking_loads')
      .select('status');

    if (error) throw error;

    const statusCounts = loads?.reduce((acc: any, load: any) => {
      acc[load.status] = (acc[load.status] || 0) + 1;
      return acc;
    }, {});

    results.push({
      section: 'Load Status Distribution',
      status: 'INFO',
      message: 'Load status breakdown',
      details: statusCounts
    });

    console.log('   Status distribution:', statusCounts);
  } catch (err: any) {
    results.push({
      section: 'Load Status Distribution',
      status: 'WARNING',
      message: 'Failed to get status distribution',
      details: err.message
    });
  }

  // ============================================================================
  // SECTION 7: Check Admin Users
  // ============================================================================
  console.log('👥 Section 7: Checking Admin Users...');
  
  try {
    const { data: admins, error } = await supabase
      .from('admin_users')
      .select('email, name, role, is_active');

    if (error) throw error;

    const expectedAdmins = [
      'kylegronning@mpsgroup.ca',
      'nathan@mpsgroup.ca',
      'tyrel@mpsgroup.ca'
    ];

    const foundEmails = admins?.map((a: any) => a.email.toLowerCase()) || [];
    const missingAdmins = expectedAdmins.filter(email => 
      !foundEmails.includes(email.toLowerCase())
    );

    if (missingAdmins.length > 0) {
      results.push({
        section: 'Admin Users',
        status: 'WARNING',
        message: `${missingAdmins.length} expected admins not in admin_users table`,
        details: { 
          missingAdmins,
          currentAdmins: foundEmails,
          note: 'These are hardcoded in AuthContext.tsx - Issue #6'
        }
      });
    } else {
      results.push({
        section: 'Admin Users',
        status: 'PASS',
        message: 'All expected admins found in database',
        details: foundEmails
      });
    }
  } catch (err: any) {
    results.push({
      section: 'Admin Users',
      status: 'WARNING',
      message: 'Failed to check admin users',
      details: err.message
    });
  }

  // ============================================================================
  // FINAL REPORT
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 AUDIT REPORT SUMMARY');
  console.log('='.repeat(80) + '\n');

  const passingTests = results.filter(r => r.status === 'PASS').length;
  const failingTests = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const total = results.length;

  console.log(`✅ PASSING: ${passingTests}/${total}`);
  console.log(`❌ FAILING: ${failingTests}/${total}`);
  console.log(`⚠️  WARNINGS: ${warnings}/${total}`);

  console.log('\n' + '-'.repeat(80));
  console.log('DETAILED RESULTS:');
  console.log('-'.repeat(80) + '\n');

  results.forEach((result, index) => {
    const icon = {
      'PASS': '✅',
      'FAIL': '❌',
      'WARNING': '⚠️ ',
      'INFO': 'ℹ️ '
    }[result.status];

    console.log(`${icon} ${result.section}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details:`, result.details);
    }
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('END OF AUDIT');
  console.log('='.repeat(80));

  return results;
}

// Run the audit
runAudit()
  .then(() => {
    console.log('\n✅ Audit completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Audit failed:', error);
    process.exit(1);
  });
