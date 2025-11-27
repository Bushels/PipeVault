/**
 * Delete specific test users and their associated data
 * Run with: npx tsx scripts/delete-test-users.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const usersToDelete = [
  'kyle@bushelsenergy.com',
  'kyle@ibelievefit.com'
];

async function deleteTestUsers() {
  console.log('🧹 Starting cleanup of test users...\n');

  for (const email of usersToDelete) {
    console.log(`\n📧 Processing ${email}...`);

    try {
      // 1. Find the user by email
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

      if (listError) {
        console.error(`❌ Error listing users:`, listError);
        continue;
      }

      const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (!user) {
        console.log(`⚠️  User ${email} not found, skipping...`);
        continue;
      }

      console.log(`✓ Found user: ${user.id}`);
      const userId = user.id;

      // 2. Get user's company domain
      const domain = email.split('@')[1];
      console.log(`  Domain: ${domain}`);

      // 3. Check if there are other users from the same domain
      const otherUsers = users.filter(u =>
        u.email?.endsWith(`@${domain}`) &&
        u.id !== userId
      );
      console.log(`  Other users from ${domain}: ${otherUsers.length}`);

      // 4. Delete user's storage requests and associated data
      const { data: requests, error: requestsError } = await supabase
        .from('storage_requests')
        .select('id')
        .eq('user_id', userId);

      if (requestsError) {
        console.error(`  ❌ Error fetching requests:`, requestsError);
      } else if (requests && requests.length > 0) {
        console.log(`  Found ${requests.length} storage request(s)`);

        // Delete trucking loads first (foreign key constraint)
        for (const request of requests) {
          const { error: loadsError } = await supabase
            .from('trucking_loads')
            .delete()
            .eq('storage_request_id', request.id);

          if (loadsError) {
            console.error(`  ❌ Error deleting trucking loads:`, loadsError);
          }
        }

        // Delete storage requests
        const { error: deleteRequestsError } = await supabase
          .from('storage_requests')
          .delete()
          .eq('user_id', userId);

        if (deleteRequestsError) {
          console.error(`  ❌ Error deleting requests:`, deleteRequestsError);
        } else {
          console.log(`  ✓ Deleted storage requests`);
        }
      } else {
        console.log(`  No storage requests found`);
      }

      // 5. Delete company if no other users
      if (otherUsers.length === 0) {
        const { error: companyError } = await supabase
          .from('companies')
          .delete()
          .eq('domain', domain);

        if (companyError) {
          console.error(`  ⚠️  Error deleting company:`, companyError.message);
        } else {
          console.log(`  ✓ Deleted company record for ${domain}`);
        }
      } else {
        console.log(`  ℹ️  Keeping company (${otherUsers.length} other user(s) remain)`);
      }

      // 6. Delete the auth user
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteUserError) {
        console.error(`  ❌ Error deleting user:`, deleteUserError);
      } else {
        console.log(`  ✓ Deleted auth user ${email}`);
      }

      console.log(`✅ Cleanup complete for ${email}`);

    } catch (error) {
      console.error(`❌ Unexpected error processing ${email}:`, error);
    }
  }

  console.log('\n\n🎉 Cleanup completed!');
  console.log('\nRemaining users can be verified with:');
  console.log('  npx tsx scripts/show-companies.ts');
}

deleteTestUsers().catch(console.error);
