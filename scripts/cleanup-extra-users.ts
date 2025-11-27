/**
 * Cleanup remaining auth users except kyle@bushelsenergy.com
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const KEEP_EMAIL = 'kyle@bushelsenergy.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanupUsers() {
  console.log('\n========================================');
  console.log('AUTH USER CLEANUP');
  console.log('========================================\n');

  // Get all users
  const { data: authData } = await supabase.auth.admin.listUsers();
  const allUsers = authData?.users || [];
  
  console.log(`Total auth users: ${allUsers.length}\n`);
  
  // Identify users to delete
  const usersToDelete = allUsers.filter(u => u.email !== KEEP_EMAIL);
  const usersToKeep = allUsers.filter(u => u.email === KEEP_EMAIL);
  
  console.log('Users to KEEP:');
  usersToKeep.forEach(u => {
    console.log(`  ✓ ${u.email} (ID: ${u.id})`);
  });
  
  console.log('\nUsers to DELETE:');
  usersToDelete.forEach(u => {
    console.log(`  ✗ ${u.email} (ID: ${u.id})`);
  });
  
  if (usersToDelete.length === 0) {
    console.log('\n✅ No users to delete. Database is clean!');
    return;
  }
  
  console.log(`\n⚠️  Deleting ${usersToDelete.length} users in 5 seconds...`);
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  for (const user of usersToDelete) {
    console.log(`Deleting: ${user.email}...`);
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`  ❌ Error:`, error);
    } else {
      console.log(`  ✅ Deleted`);
    }
  }
  
  console.log('\n✅ User cleanup complete!');
  console.log('========================================\n');
}

cleanupUsers().catch(console.error);
