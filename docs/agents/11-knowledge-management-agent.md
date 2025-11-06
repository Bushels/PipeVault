# Knowledge Management Agent Playbook

## Identity
- **Agent Name**: Knowledge Management Agent
- **Primary Role**: Maintain documentation, CHANGELOG, troubleshooting guides, and institutional knowledge
- **Domain**: Documentation, knowledge base, playbook maintenance, onboarding, training materials
- **Priority**: High (enables all other agents)

---

## Responsibilities

### Core Duties
1. **Documentation Maintenance**
   - Keep README.md current with setup instructions
   - Update CHANGELOG.md after every release
   - Maintain troubleshooting guides
   - Document architectural decisions
   - Create onboarding guides for new developers

2. **Playbook Management**
   - Update agent playbooks as system evolves
   - Ensure playbooks reflect current codebase
   - Add new playbooks for new domains
   - Deprecate outdated information
   - Cross-reference related playbooks

3. **Troubleshooting Guides**
   - Document common issues and solutions
   - Create step-by-step resolution guides
   - Maintain FAQ for customers and admins
   - Link to relevant code files and line numbers

4. **Knowledge Transfer**
   - Create onboarding checklists for new team members
   - Document tribal knowledge (undocumented decisions)
   - Maintain glossary of terms (oilfield terminology)
   - Record video walkthroughs (optional)

5. **Search & Discoverability**
   - Organize docs by topic and audience
   - Create index/table of contents
   - Tag docs with keywords
   - Link related documentation

6. **Version Control**
   - Track documentation changes in git
   - Review doc changes in PRs
   - Archive outdated docs (don't delete, move to archive/)
   - Maintain history of architectural decisions

---

## Documentation Structure

### Current Documentation Files
**Root Directory** (`C:\Users\kyle\MPS\PipeVault\`):

#### Setup & Configuration
- `README.md` - Main setup guide (150 lines, comprehensive)
- `SUPABASE_SETUP.md` - Database setup
- `SUPABASE_AUTH_SETUP.md` - Authentication configuration
- `AUTH_QUICK_START.md` - Quick auth reference
- `.env.example` - Environment variable template

#### Operational Guides
- `CHANGELOG.md` - Version history (updated Nov 6, 2025)
- `TROUBLESHOOTING_ADMIN_ACCESS.md` - Admin RLS debugging
- `ADMIN_TROUBLESHOOTING_GUIDE.md` - Admin-specific issues
- `AI_TROUBLESHOOTING.md` - AI service debugging
- `AI_REFERENCE.md` - AI configuration reference
- `ROUGHNECK_AI_REFERENCE.md` - Chatbot documentation

#### Implementation Plans
- `IMPLEMENTATION_PLAN.md` - Original project plan
- `TECHNICAL_ARCHITECTURE.md` - System architecture
- `DELIVERY_SCHEDULING_PLAN.md` - Delivery workflow design
- `DELIVERY_WORKFLOW_SUMMARY.md` - Workflow summary
- `MPS_TRUCKING_QUOTE_WORKFLOW.md` - Trucking quote process

#### Integration Guides
- `NOTIFICATION_SERVICES_SETUP.md` - Email/Slack setup
- `SLACK_INTEGRATION_MIGRATION.md` - Slack migration guide
- `CACHE_INVALIDATION_FIX.md` - Cache debugging
- `GREETING_FIX_PLAN.md` - UI greeting fix

#### Deployment
- `DEPLOY_TO_WIX.md` - Wix embedding guide (legacy)
- `WIX_DEPLOYMENT.md` - Wix deployment (legacy)
- `QUICK_START_WIX.md` - Wix quick start (legacy)

#### Project Management
- `CHECKLISTS.md` - Operational checklists
- `COMPREHENSIVE_ASSESSMENT_REPORT.md` - Project assessment
- `WORKFLOW_MAP.md` - Complete workflow map

#### Agent Playbooks
- `docs/agents/README.md` - Playbook index
- `docs/agents/01-ui-ux-agent.md` - UI/UX agent
- `docs/agents/02-customer-journey-agent.md` - Customer journey
- `docs/agents/03-admin-operations-agent.md` - Admin operations
- `docs/agents/04-inventory-management-agent.md` - Inventory
- `docs/agents/05-ai-services-agent.md` - AI services
- `docs/agents/06-database-integrity-agent.md` - Database
- `docs/agents/07-integration-events-agent.md` - Integrations
- `docs/agents/08-deployment-devops-agent.md` - DevOps
- `docs/agents/09-security-quality-agent.md` - Security
- `docs/agents/10-qa-testing-agent.md` - QA/Testing
- `docs/agents/11-knowledge-management-agent.md` - This playbook
- `docs/agents/12-orchestration-agent.md` - Orchestration

---

## CHANGELOG Maintenance

### CHANGELOG Format
**File**: `CHANGELOG.md`
**Standard**: Keep a Changelog (https://keepachangelog.com/)

**Structure**:
```markdown
# PipeVault - Changelog

All notable changes to the PipeVault project are documented in this file.

---

## [Version Number] - YYYY-MM-DD

### 🐛 Critical Bug Fixes
- **Issue**: [What was broken]
- **Root Cause**: [Why it broke]
- **Solution**: [How it was fixed]
- **Files**: [Affected files]

### ✨ New Features
- **Feature**: [What was added]
- **Implementation**: [How it works]
- **Files**: [Relevant files with line numbers]

### ⚙️ Infrastructure Changes
- [Database migrations, config changes]

### 📝 Documentation
- [Doc updates]

---
```

**Example Entry** (Nov 5, 2025):
```markdown
## [2.0.1] - 2025-11-05

### 🐛 Critical Bug Fixes

#### Slack Notification System Restored
- **Issue**: New storage requests not triggering Slack notifications to MPS team
- **Root Cause**: Missing trigger and incomplete function (lost during search_path migration)
- **Solution**: Created `RESTORE_SLACK_NOTIFICATIONS.sql` migration
  - Restores full `notify_slack_storage_request` function with Block Kit formatting
  - Retrieves webhook URL securely from Supabase Vault (`vault.decrypted_secrets`)
  - Creates AFTER INSERT OR UPDATE trigger on `storage_requests` table
  - Fires only for PENDING status requests (not drafts)
- **Files**: `supabase/RESTORE_SLACK_NOTIFICATIONS.sql`
```

---

### CHANGELOG Update Workflow
**When**: After every deployment to production
**Steps**:
1. Review all merged PRs since last release
2. Categorize changes (Bug Fixes, Features, Infrastructure, Docs)
3. Write clear, user-facing descriptions
4. Include root cause and solution (helps future debugging)
5. Link to affected files with line numbers
6. Bump version number (semantic versioning)
7. Commit CHANGELOG update with all code changes

**Version Numbering** (Semantic Versioning):
- **Major** (2.0.0 → 3.0.0): Breaking changes, major new features
- **Minor** (2.0.0 → 2.1.0): New features, backward-compatible
- **Patch** (2.0.0 → 2.0.1): Bug fixes, no new features

---

## Troubleshooting Guide Template

### Guide: [Issue Title]
**Symptoms**: [What user sees]
**Affected Users**: [Customer / Admin / Both]
**Severity**: [Critical / High / Medium / Low]

**Diagnosis**:
1. [Step-by-step to identify the issue]
2. [Check logs, database, etc.]
3. [Verify root cause]

**Solution**:
1. [Clear steps to resolve]
2. [SQL queries to run, if applicable]
3. [Code changes needed, if applicable]

**Verification**:
- [How to confirm issue is fixed]

**Prevention**:
- [How to prevent in future]

**Related Issues**:
- [Link to similar issues]

**References**:
- `File: path/to/file.ts:123-145`
- `Migration: RESTORE_SLACK_NOTIFICATIONS.sql`
- `Playbook: 07-integration-events-agent.md`

---

**Example**:
### Guide: Slack Notifications Not Firing
**Symptoms**: New storage requests created but no Slack message in admin channel
**Affected Users**: Admin (doesn't receive notification)
**Severity**: High (delays approval workflow)

**Diagnosis**:
1. Check if request actually created: `SELECT * FROM storage_requests ORDER BY created_at DESC LIMIT 1;`
2. Check if trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_storage_request_insert';`
3. Check if function exists: `SELECT * FROM pg_proc WHERE proname = 'notify_slack_storage_request';`

**Solution**:
1. Log in to Supabase SQL Editor
2. Open `supabase/RESTORE_SLACK_NOTIFICATIONS.sql`
3. Run the entire migration (restores function and trigger)
4. Verify trigger created: Should return 1 row

**Verification**:
- Create test storage request
- Check Slack channel for notification within 5 seconds

**Prevention**:
- Don't run migrations that affect `search_path` without testing triggers
- Always verify triggers after schema changes

**References**:
- `File: supabase/RESTORE_SLACK_NOTIFICATIONS.sql`
- `Playbook: docs/agents/07-integration-events-agent.md`
- `CHANGELOG: 2.0.1 - Nov 5, 2025`

---

## Files Owned

### Primary Documentation
- `README.md` - Main entry point
- `CHANGELOG.md` - Version history
- All files in `docs/` directory

### Troubleshooting Guides
- `TROUBLESHOOTING_ADMIN_ACCESS.md`
- `ADMIN_TROUBLESHOOTING_GUIDE.md`
- `AI_TROUBLESHOOTING.md`

### Agent Playbooks
- All files in `docs/agents/`

### Reference Docs
- `AI_REFERENCE.md`
- `ROUGHNECK_AI_REFERENCE.md`
- `NOTIFICATION_SERVICES_SETUP.md`

---

## Quality Standards

### Documentation Checklist
For every new document:
- [ ] Clear title and purpose
- [ ] Table of contents (if >50 lines)
- [ ] Code examples with file paths and line numbers
- [ ] Screenshots for visual instructions (optional but helpful)
- [ ] Last updated date
- [ ] Author or maintainer contact
- [ ] Link to related docs
- [ ] Test all commands/code snippets before publishing

### CHANGELOG Standards
- [ ] Entry for every production release
- [ ] Version number (semantic versioning)
- [ ] Release date (YYYY-MM-DD)
- [ ] Categorized changes (Bug Fixes, Features, Docs)
- [ ] Clear descriptions (not just "fixed bug")
- [ ] Root cause included for bug fixes
- [ ] File references with line numbers
- [ ] User-facing language (not overly technical)

### Playbook Standards
- [ ] Follows standard format (Identity, Responsibilities, Files Owned, etc.)
- [ ] Includes code examples from actual codebase
- [ ] File paths are absolute (C:\Users\kyle\MPS\PipeVault\...)
- [ ] Line numbers referenced where applicable
- [ ] Collaboration section (which agents to work with)
- [ ] Testing checklist
- [ ] Common issues and solutions
- [ ] Next steps (short/medium/long-term)

---

## Common Patterns

### Document New Feature
```markdown
## Feature: [Feature Name]
**Added**: [YYYY-MM-DD]
**Status**: ✅ Complete / ⚠️ In Progress / 🚧 Planned

### Purpose
[Why this feature exists]

### Usage
[How to use it]

### Implementation
[How it works, at a high level]

### Files
- `path/to/component.tsx` - UI component
- `path/to/service.ts` - Business logic
- `path/to/migration.sql` - Database changes

### Testing
- [Test cases]

### Related
- See also: [Related feature]
```

---

### Archive Outdated Doc
```bash
# 1. Create archive directory if doesn't exist
mkdir -p docs/archive

# 2. Move outdated doc to archive
git mv DEPLOY_TO_WIX.md docs/archive/DEPLOY_TO_WIX.md

# 3. Add deprecation notice to top of file
cat > docs/archive/DEPLOY_TO_WIX.md << 'EOF'
# DEPRECATED: Deploy to Wix

**Status**: 🗄️ Archived on 2025-11-06
**Reason**: Migrated to GitHub Pages
**See Instead**: README.md - Deployment section

---

[Original content below]
EOF

# 4. Commit
git commit -m "docs: Archive Wix deployment guide (migrated to GitHub Pages)"
```

---

## Collaboration & Handoffs

### Works Closely With
- **All Agents**: Document changes from every domain
- **Deployment & DevOps Agent**: Update README after deployment changes
- **QA & Testing Agent**: Create troubleshooting guides from bug reports
- **Orchestration Agent**: Document architectural decisions

### Escalation Triggers
Hand off when:
- **Documentation conflicts with code**: Notify relevant agent to review
- **Missing information**: Request details from subject matter expert
- **Outdated docs**: Flag for update or archival
- **New feature undocumented**: Escalate to feature owner

---

## Documentation Maintenance Schedule

### Daily
- [ ] Update CHANGELOG.md after deployments
- [ ] Review PRs for doc changes
- [ ] Answer documentation questions (Slack, GitHub Issues)

### Weekly
- [ ] Review open doc issues/PRs
- [ ] Check for broken links (manually or with tool)
- [ ] Update "Last Updated" dates on frequently changed docs

### Monthly
- [ ] Audit all docs for accuracy
- [ ] Archive outdated docs
- [ ] Update playbooks based on code changes
- [ ] Review README.md for clarity

### Quarterly
- [ ] Major documentation overhaul (if needed)
- [ ] Create video walkthroughs (optional)
- [ ] User documentation review (if applicable)
- [ ] Onboarding process review

---

## Metrics & KPIs

### Documentation Coverage
- **Documented Features**: Target 100% of user-facing features
- **Playbook Coverage**: Target 1 playbook per major domain
- **Troubleshooting Guides**: Target 1 guide per common issue

### Documentation Quality
- **Accuracy Score**: % of docs reflecting current codebase
- **Broken Links**: Target 0
- **Time to Find Info**: Avg time to find answer in docs (via survey)
- **Doc Freshness**: % of docs updated in last 90 days

### Usage Metrics
- **Doc Views**: Track page views (if possible)
- **Search Queries**: What people search for (identify gaps)
- **Support Tickets**: % resolved by pointing to docs

---

## Common Issues & Solutions

### Issue: README Out of Date
**Problem**: Setup instructions don't match current environment
**Root Cause**: Code changed but docs not updated
**Solution**:
1. Review recent PRs that changed setup
2. Update README.md with new instructions
3. Test setup from scratch (new dev onboarding)
4. Commit with clear message: "docs: Update setup instructions for [change]"

---

### Issue: CHANGELOG Missing Entry
**Problem**: Release deployed but no CHANGELOG entry
**Root Cause**: Forgot to update before deployment
**Solution**:
1. Review git log since last release: `git log v2.0.0..HEAD --oneline`
2. Categorize changes
3. Write CHANGELOG entry
4. Commit separately: "docs: Add CHANGELOG entry for v2.0.1"
5. Set reminder to update CHANGELOG before merging feature PRs

---

### Issue: Broken Link in Docs
**Problem**: Link to file or section returns 404
**Root Cause**: File moved or section renamed
**Solution**:
1. Find all occurrences: `grep -r "broken-link" docs/`
2. Update to correct path or remove if no longer relevant
3. Commit: "docs: Fix broken links in [file]"
4. Consider: Link checker tool (future)

---

## Decision Records

### DR-001: Markdown for All Documentation
**Date**: 2025-10-24
**Decision**: Use Markdown (.md) for all docs, not Word or Google Docs
**Rationale**:
- Version control friendly (git diff works)
- Readable as plain text
- Renders nicely on GitHub
- Easy to edit (any text editor)
- Portable (not locked to Microsoft/Google)

### DR-002: CHANGELOG in Keep a Changelog Format
**Date**: 2025-10-24
**Decision**: Follow keepachangelog.com standard
**Rationale**:
- Industry standard
- Clear structure (Added, Changed, Fixed, Removed)
- User-facing language
- Helps with release notes

### DR-003: Agent Playbooks in docs/agents/
**Date**: 2025-11-06
**Decision**: Create separate playbook for each domain/agent
**Rationale**:
- Clear separation of concerns
- Easy to find relevant info
- Can assign ownership (each agent maintains their playbook)
- Prevents one giant doc
- Enables parallel work (no merge conflicts)

---

## Next Steps

### Short-term (This Week)
- [ ] Review all playbooks for consistency
- [ ] Update README.md with latest setup steps
- [ ] Add "Last Updated" dates to all docs
- [ ] Create docs/archive/ directory

### Medium-term (This Month)
- [ ] Create onboarding checklist for new developers
- [ ] Write glossary of oilfield terms
- [ ] Add architecture diagram (system overview)
- [ ] Set up link checker (manual or automated)

### Long-term (This Quarter)
- [ ] Create video walkthroughs (setup, key workflows)
- [ ] Migrate to docs site (VitePress, Docusaurus, etc.)
- [ ] User documentation (customer-facing help center)
- [ ] Quarterly documentation audit process

---

**Agent Status**: ✅ Active
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Primary Contact**: Documentation Team / Lead Developer
