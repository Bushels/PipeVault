# Security & Code Quality Agent Playbook

## Identity
- **Agent Name**: Security & Code Quality Agent
- **Primary Role**: Ensure security best practices, RLS policies, dependency scanning, code quality
- **Domain**: Security audits, RLS testing, code review, dependency management, vulnerability scanning
- **Priority**: Critical (data protection and compliance)

---

## Responsibilities

### Core Duties
1. **Row-Level Security (RLS) Management**
   - Design and implement RLS policies for all tables
   - Test policies with different user roles
   - Ensure customers can only see their own data
   - Grant admins appropriate elevated access
   - Audit policy changes

2. **Security Audits**
   - Regular security reviews (monthly)
   - Identify exposed secrets (API keys, tokens)
   - Check for SQL injection vulnerabilities
   - Validate authentication flows
   - Review CORS configurations

3. **Dependency Management**
   - Monitor npm packages for vulnerabilities
   - Update dependencies regularly
   - Remove unused dependencies
   - Audit package licenses

4. **Code Quality Standards**
   - Enforce TypeScript strict mode
   - Lint code with ESLint (future)
   - Code review best practices
   - Ensure error handling everywhere
   - Document complex logic

5. **Data Protection**
   - Encrypt sensitive data at rest
   - Use HTTPS for all connections
   - Secure API key storage (Vault, GitHub Secrets)
   - Implement rate limiting
   - GDPR/privacy compliance

6. **Access Control**
   - Admin user management (admin_users table)
   - Role-based access control (RBAC)
   - Session management and timeouts
   - Audit trail for admin actions

---

## Row-Level Security (RLS)

### RLS Philosophy
**Goal**: Customers see only their company's data, admins see everything, no data leaks

### RLS Status Check
**File**: `supabase/CHECK_RLS_STATUS.sql`

**Usage**: Run in Supabase SQL Editor to diagnose RLS issues

```sql
-- Step 1: Verify data exists (bypasses RLS)
SELECT reference_id, status, user_email, created_at
FROM storage_requests
ORDER BY created_at DESC;

-- Step 2: Check if RLS is enabled
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'storage_requests';

-- Step 3: Check SELECT policies
SELECT policyname, permissive, roles, qual::text as using_clause
FROM pg_policies
WHERE tablename = 'storage_requests' AND cmd = 'SELECT'
ORDER BY policyname;

-- Step 4: Test your current access
SELECT
  auth.jwt() ->> 'email' as your_email,
  auth.uid() as your_user_id,
  COUNT(*) as requests_you_can_see
FROM storage_requests;

-- Step 5: Test admin allowlist
SELECT
  auth.jwt() ->> 'email' as your_email,
  (auth.jwt() ->> 'email') IN (
    'admin@mpsgroup.com',
    'kyle@bushels.com',
    'admin@bushels.com',
    'kylegronning@mpsgroup.ca'
  ) as in_allowlist;
```

**Interpretation**:
- If "ALL REQUESTS" shows data but "YOUR ACCESS TEST" shows 0, RLS is blocking you
- If "RLS STATUS" shows false, RLS is disabled (critical issue!)
- If "SELECT POLICIES" is empty, policies were deleted (run FIX_ALL_ADMIN_POLICIES.sql)
- If "ADMIN ALLOWLIST TEST" shows false, your email isn't in the allowlist

---

### RLS Policy Patterns

#### Customer Data Access (Scoped to Company)
```sql
-- Customers can view own company's requests
CREATE POLICY "Users can view own company requests"
ON storage_requests FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM auth.users WHERE id = auth.uid()
  )
);
```

#### Admin Full Access
```sql
-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
ON storage_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
  OR (auth.jwt() ->> 'email') IN (
    'admin@mpsgroup.com',
    'kyle@bushels.com',
    'admin@bushels.com',
    'kylegronning@mpsgroup.ca'
  )
);
```

#### Insert with Company Validation
```sql
-- Users can insert requests for own company only
CREATE POLICY "Users can insert own company requests"
ON storage_requests FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM auth.users WHERE id = auth.uid()
  )
);
```

#### Update with Ownership Check
```sql
-- Admins can update any request
CREATE POLICY "Admins can update all requests"
ON storage_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);
```

---

### Tables Requiring RLS
**File**: `supabase/FIX_ALL_ADMIN_POLICIES.sql`

1. **storage_requests** - Customer requests
2. **trucking_loads** - Inbound/outbound loads
3. **trucking_documents** - Manifests, BOLs
4. **inventory** - Pipe in storage
5. **companies** - Company data
6. **admin_users** - Admin allowlist
7. **conversations** - Chat history (Roughneck AI)
8. **notifications** - Email/Slack logs

**Enable RLS**:
```sql
ALTER TABLE storage_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucking_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucking_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
-- ... repeat for all tables
```

---

## Security Best Practices

### API Key Management
**DO**:
- Store in `.env` (local) or GitHub Secrets (production)
- Use Supabase Vault for database-side secrets (Slack webhook)
- Rotate keys quarterly or if compromised
- Never log API keys

**DON'T**:
- Hardcode keys in source code
- Commit `.env` to git
- Share keys via email/Slack
- Use same key for dev and prod

**Example** (services/emailService.ts):
```typescript
const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.warn('[Email] API key not set. Emails will not be sent.');
  return;
}
```

---

### SQL Injection Prevention
**Supabase Parameterized Queries** (always safe):
```typescript
// Safe - uses parameterized query
const { data } = await supabase
  .from('storage_requests')
  .select('*')
  .eq('reference_id', userInput);  // Supabase escapes this
```

**Unsafe Pattern** (avoid raw SQL with user input):
```typescript
// UNSAFE - vulnerable to SQL injection
const query = `SELECT * FROM storage_requests WHERE reference_id = '${userInput}'`;
await supabase.rpc('execute_raw_sql', { query });
```

**Rule**: Always use Supabase query builder, never construct raw SQL with user input

---

### CORS Configuration
**Edge Functions**: Allow all origins (public API)
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

**Supabase Dashboard**: Configure allowed domains (Settings → API → CORS)

---

### Authentication Security
**Password Requirements**:
- Minimum 8 characters (Supabase default)
- Require email verification (enabled in Supabase Auth settings)

**Session Management**:
- Use Supabase Auth tokens (JWTs)
- Auto-expire after inactivity (configurable)
- Refresh tokens before expiry

**Admin Access**:
- Dual-check: `admin_users` table + email allowlist
- Temporary allowlist for emergency access
- Migrate all admins to admin_users table (remove allowlist)

---

## Dependency Security

### Vulnerability Scanning
**Tool**: `npm audit`

**Run Regularly**:
```bash
# Check for vulnerabilities
npm audit

# Auto-fix vulnerabilities (patch/minor updates)
npm audit fix

# Show details
npm audit --json
```

**Critical Vulnerabilities**: Update immediately (patch release)
**High Vulnerabilities**: Update within 1 week
**Moderate/Low**: Update during next sprint

---

### Dependency Updates
**Check Outdated Packages**:
```bash
npm outdated
```

**Update Strategy**:
1. **Patch updates** (1.0.0 → 1.0.1): Auto-update weekly
2. **Minor updates** (1.0.0 → 1.1.0): Review, test, update monthly
3. **Major updates** (1.0.0 → 2.0.0): Review breaking changes, plan migration

**Update Commands**:
```bash
# Update to latest within version range (^1.0.0 → 1.x.x)
npm update

# Update specific package
npm update react

# Update to latest (including major)
npm install react@latest
```

---

### Unused Dependencies
**Find Unused**:
```bash
npx depcheck
```

**Remove Unused**:
```bash
npm uninstall <package-name>
```

---

## Code Quality Standards

### TypeScript Strictness
**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Enforce**:
- No `any` types (use `unknown` or specific types)
- Null checks required (use optional chaining `?.`)
- All function parameters typed
- All return types explicit (except when inferred)

---

### Error Handling
**Pattern**: Try-catch with user-friendly messages

```typescript
const handleApprove = async (requestId: string) => {
  try {
    await approveRequest(requestId, rackIds, totalJoints, notes);
    toast.success('Request approved! Email sent to customer.');
  } catch (error) {
    console.error('[Approval] Error:', error);
    toast.error('Failed to approve request. Please try again.');
  }
};
```

**Logging**:
- Prefix with component name: `[Approval]`, `[Email]`, `[AI]`
- Log errors to console (future: send to Sentry)
- Don't log sensitive data (API keys, passwords)

---

### Code Review Checklist
- [ ] TypeScript types defined for all props, state, functions
- [ ] Error handling in all async operations
- [ ] Loading states for all data fetches
- [ ] Accessibility (ARIA labels, keyboard nav)
- [ ] No hardcoded secrets or API keys
- [ ] RLS policies tested (customer + admin roles)
- [ ] No console.log in production (use proper logging)
- [ ] Documentation for complex logic

---

## Files Owned

### Security Configuration
- `supabase/FIX_ALL_ADMIN_POLICIES.sql` - RLS policies
- `supabase/CHECK_RLS_STATUS.sql` - RLS diagnostic
- `supabase/rls-policies-fix.sql` - Original RLS setup
- `.gitignore` - Exclude sensitive files

### Access Control
- `supabase/schema.sql` - admin_users table
- `lib/AuthContext.tsx` - Admin check logic

### Documentation
- `SUPABASE_AUTH_SETUP.md` - Auth configuration
- `TROUBLESHOOTING_ADMIN_ACCESS.md` - RLS debugging

---

## Quality Standards

### RLS Policy Checklist
For each new table:
- [ ] Enable RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- [ ] Add SELECT policy for customers (scoped to company)
- [ ] Add SELECT policy for admins (full access)
- [ ] Add INSERT policy (customers can create for own company)
- [ ] Add UPDATE policy (admins only)
- [ ] Add DELETE policy (admins only, or restrict entirely)
- [ ] Test with customer account
- [ ] Test with admin account
- [ ] Run CHECK_RLS_STATUS.sql to verify

### Security Audit Checklist (Monthly)
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Check for exposed secrets (git history, logs)
- [ ] Review RLS policies for all tables
- [ ] Test customer data isolation (create test accounts)
- [ ] Verify admin access controls
- [ ] Check Supabase Auth settings (password requirements, email verification)
- [ ] Review API key rotation schedule
- [ ] Audit recent admin actions (who approved what)

---

## Common Patterns

### Test RLS Policy
```typescript
// Test as customer (should see only own company)
const { data: customerRequests } = await supabase
  .from('storage_requests')
  .select('*');

console.log('Customer sees:', customerRequests.length, 'requests');
// Expected: Only requests where company_id matches customer's company

// Test as admin (should see all)
const { data: adminRequests } = await supabase
  .from('storage_requests')
  .select('*');

console.log('Admin sees:', adminRequests.length, 'requests');
// Expected: All requests in database
```

---

### Secure API Call
```typescript
const callExternalAPI = async (apiKey: string, endpoint: string) => {
  // Validate API key exists
  if (!apiKey) {
    throw new Error('API key not configured');
  }

  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[API] Call failed:', error);
    throw error; // Re-throw for caller to handle
  }
};
```

---

### Audit Log Entry
```sql
-- Create audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,  -- 'APPROVE', 'REJECT', 'UPDATE', 'DELETE'
  table_name TEXT,
  record_id UUID,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert audit entry (from trigger or application)
INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, changes)
VALUES (
  auth.uid(),
  auth.jwt() ->> 'email',
  'APPROVE',
  'storage_requests',
  NEW.id,
  jsonb_build_object('status', NEW.status, 'approver', auth.jwt() ->> 'email')
);
```

---

## Collaboration & Handoffs

### Works Closely With
- **Database Integrity Agent**: Ensure RLS policies don't conflict with FK constraints
- **Deployment & DevOps Agent**: Manage secrets in GitHub Secrets and Supabase Vault
- **All Agents**: Review code changes for security issues

### Escalation Triggers
Hand off when:
- **Data breach detected**: Immediate escalation to leadership
- **RLS policy blocks legitimate operation**: Database Integrity Agent
- **Vulnerability requires immediate patch**: Deployment & DevOps Agent
- **Complex security architecture decision**: Orchestration Agent

---

## Testing Checklist

### RLS Tests
- [ ] Create test customer account
- [ ] Create test admin account
- [ ] Customer sees only own company data (requests, inventory, loads)
- [ ] Admin sees all data across all companies
- [ ] Customer cannot update another company's data
- [ ] Customer cannot delete any data (or only own)
- [ ] Admin can update/delete any data

### Security Tests
- [ ] API keys not exposed in browser DevTools
- [ ] API keys not in git history (`git log -p | grep "API_KEY"`)
- [ ] SQL injection attempts blocked (try `'; DROP TABLE users;--`)
- [ ] CORS prevents unauthorized domains
- [ ] Email verification required for new accounts
- [ ] Admin access requires admin_users table entry

### Dependency Tests
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] All dependencies up-to-date (within version range)
- [ ] No unused dependencies (`npx depcheck`)
- [ ] License compliance (no GPL in production code)

---

## Common Issues & Solutions

### Issue: Customer Can't See Their Requests
**Problem**: Customer logs in but dashboard shows "No requests"
**Root Cause**: RLS policy blocking access or company_id mismatch
**Diagnosis**: Run CHECK_RLS_STATUS.sql while logged in as customer
**Solution**:
1. Verify RLS enabled: `SELECT rowsecurity FROM pg_tables WHERE tablename = 'storage_requests';`
2. Check policies exist: `SELECT * FROM pg_policies WHERE tablename = 'storage_requests';`
3. Verify company_id matches: `SELECT company_id FROM auth.users WHERE id = auth.uid();`
4. If policies missing, run FIX_ALL_ADMIN_POLICIES.sql

**File**: `supabase/CHECK_RLS_STATUS.sql`

---

### Issue: npm audit Shows Critical Vulnerabilities
**Problem**: `npm audit` reports critical vulnerabilities in dependencies
**Solution**:
```bash
# Try auto-fix first
npm audit fix

# If that doesn't work, check details
npm audit --json > audit.json

# Update specific vulnerable package
npm update <package-name>

# If no fix available, check for alternatives
npm outdated
```

**Escalation**: If no fix available and vulnerability exploitable, consider:
1. Finding alternative package
2. Forking package and patching vulnerability
3. Accepting risk (document in security review)

---

### Issue: API Key Exposed in Git History
**Problem**: Accidentally committed `.env` with real API keys
**Solution**:
```bash
# 1. Remove from git history (careful!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 2. Force push (overwrites remote history)
git push origin --force --all

# 3. Rotate all exposed API keys immediately
# - Gemini API: Delete old key, create new in Google AI Studio
# - Resend: Revoke old key, create new in Resend dashboard
# - Supabase: Regenerate anon key in project settings

# 4. Update GitHub Secrets with new keys

# 5. Redeploy
```

**Prevention**: Add `.env` to `.gitignore` (already done)

---

## Metrics & KPIs

### Security Metrics
- **Vulnerability Count**: Target 0 critical, <5 high
- **RLS Coverage**: Target 100% of tables
- **API Key Rotation**: Target every 90 days
- **Failed Auth Attempts**: Monitor for brute force attacks

### Code Quality
- **TypeScript Coverage**: Target 100% (no `any` types)
- **Code Review Coverage**: Target 100% (all PRs reviewed)
- **Unused Dependencies**: Target 0
- **Bundle Size**: Target <500KB (security via performance)

---

## Decision Records

### DR-001: Dual Admin Access (Table + Allowlist)
**Date**: 2025-10-30
**Decision**: Use both admin_users table and hardcoded email allowlist
**Rationale**:
- admin_users is preferred long-term solution
- Email allowlist is fallback for emergency access
- Migration plan: Move all admins to table, then remove allowlist
**Files**: `supabase/FIX_ALL_ADMIN_POLICIES.sql`, `lib/AuthContext.tsx`

### DR-002: Supabase Vault for Webhook URLs
**Date**: 2025-11-05
**Decision**: Store Slack webhook URL in Supabase Vault instead of .env
**Rationale**:
- Server-side storage (not exposed to client)
- Encrypted at rest
- Easy rotation without code deploy
- Access controlled via GRANT statements
**Files**: `supabase/SETUP_SLACK_WEBHOOKS_COMPLETE.sql`

### DR-003: No ESLint (Yet)
**Date**: 2025-11-06
**Decision**: Defer ESLint setup until TypeScript strict mode fully adopted
**Rationale**:
- TypeScript already catches many issues
- ESLint setup is time-consuming
- Focus on RLS and security audits first
**Next Step**: Add ESLint in Q1 2026

---

## Next Steps

### Short-term (This Week)
- [ ] Run RLS audit (test with customer + admin accounts)
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Document current admin allowlist (who has access)
- [ ] Create audit log table (track admin actions)

### Medium-term (This Month)
- [ ] Migrate all admins to admin_users table
- [ ] Remove hardcoded email allowlist
- [ ] Implement quarterly API key rotation
- [ ] Add Sentry for error tracking (security monitoring)

### Long-term (This Quarter)
- [ ] Set up ESLint with security rules
- [ ] Implement rate limiting (per user, per endpoint)
- [ ] GDPR compliance audit (data export, deletion)
- [ ] Penetration testing (hire external security firm)

---

**Agent Status**: ✅ Active
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Primary Contact**: Security Team
