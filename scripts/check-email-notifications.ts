/**
 * Email Notification Diagnostic Script
 * 
 * Checks the notification queue and storage requests for kyle@bushelsenergy.com
 * to diagnose why approval email was not sent.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('\n📧 Email Notification Diagnostic\n');
  console.log('='.repeat(60));
  
  // Check 1: Storage requests for kyle@bushelsenergy.com
  console.log('\n1️⃣  Checking storage requests for kyle@bushelsenergy.com...\n');
  const { data: requests, error: reqError } = await supabase
    .from('storage_requests')
    .select('id, reference_id, user_email, status, approved_at, approved_by, assigned_location, created_at')
    .eq('user_email', 'kyle@bushelsenergy.com')
    .order('created_at', { ascending: false })
    .limit(5);

  if (reqError) {
    console.error('❌ Error querying storage_requests:', reqError);
  } else if (!requests || requests.length === 0) {
    console.log('⚠️  No storage requests found for kyle@bushelsenergy.com');
  } else {
    console.table(requests);
  }

  // Check 2: Notification queue for kyle@bushelsenergy.com
  console.log('\n2️⃣  Checking notification_queue for kyle@bushelsenergy.com...\n');
  const { data: notifications, error: notifError } = await supabase
    .from('notification_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (notifError) {
    console.error('❌ Error querying notification_queue:', notifError);
  } else if (!notifications || notifications.length === 0) {
    console.log('⚠️  Notification queue is EMPTY - NO EMAILS QUEUED AT ALL');
  } else {
    const filtered = notifications.filter((n: any) => n.payload?.userEmail === 'kyle@bushelsenergy.com');
    
    if (filtered.length === 0) {
      console.log(`⚠️  Found ${notifications.length} notifications total, but NONE for kyle@bushelsenergy.com`);
      console.log('\nRecent notifications (other users):');
      console.table(notifications.slice(0, 5).map((n: any) => ({
        type: n.type,
        recipient: n.payload?.userEmail || 'N/A',
        reference: n.payload?.referenceId || 'N/A',
        processed: n.processed,
        attempts: n.attempts,
        created_at: n.created_at,
      })));
    } else {
      console.log(`✅ Found ${filtered.length} notifications for kyle@bushelsenergy.com:`);
      console.table(filtered.map((n: any) => ({
        id: n.id,
        type: n.type,
        subject: n.payload?.subject || 'N/A',
        processed: n.processed,
        attempts: n.attempts,
        created_at: n.created_at,
        last_attempt_at: n.last_attempt_at,
        processed_at: n.processed_at,
      })));
    }
  }

  // Check 3: Edge function status
  console.log('\n3️⃣  Checking Edge Functions...\n');
  const { data: functions, error: funcError } = await supabase.functions.invoke('email-dispatcher', {
    method: 'GET',
  });

  if (funcError) {
    console.log(`⚠️  email-dispatcher function status:`, funcError.message);
  } else {
    console.log(`✅ email-dispatcher function is reachable`);
  }

  // Check 4: Resend API key configuration
  console.log('\n4️⃣  Checking Email Service Configuration...\n');
  const resendKey = process.env.VITE_RESEND_API_KEY;
  if (!resendKey || resendKey === 'your_resend_key_here') {
    console.log('❌ VITE_RESEND_API_KEY is NOT configured or using placeholder value');
    console.log('   This means emails will log to console but NOT send via Resend API');
  } else if (resendKey.startsWith('re_')) {
    console.log(`✅ VITE_RESEND_API_KEY is configured: ${resendKey.substring(0, 10)}...`);
  } else {
    console.log('⚠️  VITE_RESEND_API_KEY format looks invalid (should start with "re_")');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 DIAGNOSTIC SUMMARY\n');
  
  const approvedRequest = requests?.find(r => r.status === 'APPROVED');
  
  if (!requests || requests.length === 0) {
    console.log('❌ ROOT CAUSE: No storage requests exist for kyle@bushelsenergy.com');
    console.log('   → The approval might have been for a different email or the request was deleted');
  } else if (!approvedRequest) {
    console.log('❌ ROOT CAUSE: Storage request exists but status is NOT "APPROVED"');
    console.log(`   → Current status: ${requests[0].status}`);
    console.log('   → The approve_storage_request_atomic() function may have failed');
  } else if (!notifications || notifications.length === 0) {
    console.log('❌ ROOT CAUSE: Notification queue is COMPLETELY EMPTY');
    console.log('   → The approve_storage_request_atomic() function did NOT queue any notification');
    console.log('   → Possible causes:');
    console.log('      - Database trigger not active');
    console.log('      - Function does not insert into notification_queue');
    console.log('      - Transaction rollback occurred');
  } else {
    const userNotif = notifications.find((n: any) => n.payload?.userEmail === 'kyle@bushelsenergy.com');
    if (!userNotif) {
      console.log('❌ ROOT CAUSE: Notification was NOT queued for kyle@bushelsenergy.com');
      console.log('   → approve_storage_request_atomic() may be using wrong email');
      console.log('   → Check storage_requests.user_email value');
    } else if (!userNotif.processed && userNotif.attempts === 0) {
      console.log('⚠️  PENDING: Notification is queued but has NOT been processed yet');
      console.log('   → Edge function needs to process it (runs every 5 minutes via cron)');
      console.log('   → Or invoke manually with: supabase functions invoke email-dispatcher');
    } else if (!userNotif.processed && userNotif.attempts > 0) {
      console.log('❌ FAILED: Notification attempted but failed to send');
      console.log(`   → Attempts: ${userNotif.attempts}/3`);
      console.log('   → Check Edge function logs for send errors');
    } else {
      console.log('✅ SUCCESS: Notification was processed successfully');
      console.log(`   → Processed at: ${userNotif.processed_at}`);
      console.log('   → Email should have been sent to kyle@bushelsenergy.com');
      console.log('   → Check spam folder or Resend dashboard for delivery status');
    }
  }

  console.log('\n');
}

main().catch(console.error);
