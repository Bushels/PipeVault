/**
 * Create Admin User Accounts
 *
 * This script uses Supabase Admin API to create accounts for Nathan and Tyrel.
 * They'll receive email invitations to set their passwords.
 *
 * Usage:
 * 1. Set SUPABASE_SERVICE_ROLE_KEY in your .env file
 * 2. Run: node create-admin-users.js
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL' // e.g., https://xxxxx.supabase.co
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // From Supabase Dashboard → Settings → API

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUsers() {
  const admins = [
    {
      email: 'nathan@mpsgroup.ca',
      password: 'MPS2025!Nathan', // They can change this after first login
      user_metadata: {
        first_name: 'Nathan',
        last_name: 'Turchyn',
        company: 'MPS Group',
        role: 'admin'
      }
    },
    {
      email: 'tyrel@mpsgroup.ca',
      password: 'MPS2025!Tyrel', // They can change this after first login
      user_metadata: {
        first_name: 'Tyrel',
        last_name: 'Turchyn',
        company: 'MPS Group',
        role: 'admin'
      }
    }
  ]

  console.log('Creating admin accounts...\n')

  for (const admin of admins) {
    try {
      // Create auth user
      const { data: user, error: authError } = await supabase.auth.admin.createUser({
        email: admin.email,
        password: admin.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: admin.user_metadata
      })

      if (authError) {
        console.error(`❌ Failed to create ${admin.email}:`, authError.message)
        continue
      }

      console.log(`✅ Created auth user: ${admin.email} (ID: ${user.user.id})`)

      // Grant admin privileges
      const { error: adminError } = await supabase
        .from('admin_users')
        .insert({ email: admin.email })

      if (adminError) {
        console.error(`⚠️  Failed to grant admin privileges to ${admin.email}:`, adminError.message)
      } else {
        console.log(`✅ Granted admin privileges to ${admin.email}`)
      }

      console.log(`\n📧 Login credentials for ${admin.email}:`)
      console.log(`   Email: ${admin.email}`)
      console.log(`   Password: ${admin.password}`)
      console.log(`   (They should change this after first login)\n`)

    } catch (error) {
      console.error(`❌ Unexpected error for ${admin.email}:`, error)
    }
  }

  console.log('\n✅ Admin user creation complete!')
  console.log('\nNext steps:')
  console.log('1. Send Nathan and Tyrel their login credentials')
  console.log('2. Ask them to change their passwords after first login')
  console.log('3. Have them test the app using TESTING_GUIDE.md')
}

createAdminUsers()
