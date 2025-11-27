/**
 * Create Admin Users Script
 * 
 * Creates 3 admin users with @mpsgroup.ca emails and adds them to admin_users table
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ADMIN_USERS = [
  {
    email: 'kylegronning@mpsgroup.ca',
    name: 'Kyle Gronning',
    password: 'TempPass123!KG' // Temporary password - must be changed on first login
  },
  {
    email: 'nathan@mpsgroup.ca',
    name: 'Nathan',
    password: 'TempPass123!N' // Temporary password - must be changed on first login
  },
  {
    email: 'tyrel@mpsgroup.ca',
    name: 'Tyrel',
    password: 'TempPass123!T' // Temporary password - must be changed on first login
  }
];

async function createAdminUsers() {
  console.log('\n========================================');
  console.log('CREATING ADMIN USERS');
  console.log('========================================\n');

  for (const admin of ADMIN_USERS) {
    console.log(`Processing: ${admin.email}...`);

    // Check if user already exists in auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === admin.email);

    let userId: string;

    if (existingUser) {
      console.log(`  ✓ Auth user already exists (ID: ${existingUser.id})`);
      userId = existingUser.id;
    } else {
      // Create auth user
      console.log(`  Creating auth user...`);
      const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
        email: admin.email,
        password: admin.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: admin.name
        }
      });

      if (authError || !newUser.user) {
        console.error(`  ❌ Failed to create auth user:`, authError);
        continue;
      }

      userId = newUser.user.id;
      console.log(`  ✓ Auth user created (ID: ${userId})`);
      console.log(`  📧 Temporary password: ${admin.password}`);
    }

    // Check if user is already in admin_users table
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingAdmin) {
      console.log(`  ✓ Already in admin_users table`);
    } else {
      // Add to admin_users table
      const { error: insertError } = await supabase
        .from('admin_users')
        .insert({
          user_id: userId,
          email: admin.email,
          name: admin.name,
          is_active: true
        });

      if (insertError) {
        console.error(`  ❌ Failed to add to admin_users:`, insertError);
      } else {
        console.log(`  ✓ Added to admin_users table`);
      }
    }

    console.log('');
  }

  console.log('========================================');
  console.log('✅ Admin user setup complete!');
  console.log('\nNext steps:');
  console.log('1. Share temporary passwords with each admin');
  console.log('2. Admins should change passwords on first login');
  console.log('3. Test admin access at the Admin Dashboard');
  console.log('========================================\n');
}

createAdminUsers().catch(console.error);
