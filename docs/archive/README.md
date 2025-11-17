# Archived Documentation

This folder contains historical documentation that is no longer actively maintained but preserved for reference.

---

## 📅 Archive Date
**2025-11-16** - Major documentation reorganization

---

## 🎯 Why Archive Instead of Delete?

- **Historical Context:** Understand design decisions and evolution
- **Reference Material:** Learn from past implementations
- **Legal/Compliance:** Record keeping for audits
- **Avoid Breaking Links:** Preserve URLs in case of external references
- **Knowledge Preservation:** Onboarding and training resource

---

## 📁 Archive Structure (2025-11)

### Admin Redesign Iterations (12 files)
**Path:** `2025-11/admin-redesign/`

Multiple iterations of admin dashboard redesign:
- Architecture summaries
- Component diagrams
- Wireframes
- Implementation checklists
- Redesign analysis and summaries

**Why Archived:** Feature complete and stable. Final implementation documented in README.md and CHANGELOG.md.

---

### Trucking Workflow Development (8 files)
**Path:** `2025-11/trucking-workflow/`

Development history of trucking and delivery features:
- Workflow analysis and implementation plans
- Delivery scheduling specifications
- Outbound workflow architecture
- MPS trucking quote workflow

**Why Archived:** Features implemented and working in production. Current docs in docs/architecture/STATE_MACHINES.md and docs/architecture/DATA_FLOW.md.

---

### Bug Fixes & Hotfixes (25 files)
**Path:** `2025-11/fixes/`

Detailed fix documentation for resolved issues:
- Cache invalidation fix
- Ghost tiles elimination
- Modal blank screen fixes
- Schema alignment fixes
- Load detail modal fixes
- And 20 more...

**Why Archived:** Bugs fixed and verified. Summary information preserved in CHANGELOG.md. Detailed forensics no longer needed for daily work.

---

### Old Agent Playbook System (16 files)
**Path:** `2025-11/agents-old/`

Previous agent coordination system:
- 12 agent playbooks (old version)
- Report templates
- Coordination logs
- Weekly reports

**Why Archived:** Replaced by `.claude/agents/` system. Old playbooks kept for historical reference.

---

### Obsolete Setup & Deployment Guides (36 files)
**Path:** `2025-11/obsolete/`

Outdated documentation:
- Old setup guides (AUTH_QUICK_START, SUPABASE_SETUP duplicates)
- Wix deployment guides (feature abandoned)
- Phase completion summaries (B, C, E)
- Testing checklists (consolidated into docs/guides/TESTING_GUIDE.md)
- Troubleshooting guides (consolidated into TROUBLESHOOTING.md)
- Implementation summaries (info in CHANGELOG.md)

**Why Archived:** Replaced by consolidated docs in new structure. Content preserved for reference but no longer maintained.

---

## 📊 Archive Statistics

| Category | Files | Status |
|----------|-------|--------|
| Admin Redesign | 12 | Archived |
| Trucking Workflow | 8 | Archived |
| Bug Fixes | 25 | Archived |
| Old Agent System | 16 | Archived |
| Obsolete Docs | 36 | Archived |
| **TOTAL** | **97** | **Archived** |

**Active Documentation:** 15 core files (see [DOCUMENTATION_INDEX.md](../../DOCUMENTATION_INDEX.md))
**Token Reduction:** 82% (from ~300,000 to ~55,000 tokens)

---

## 🔍 Finding Archived Information

### By Topic
| What You Need | Check Archive Folder |
|---------------|---------------------|
| Admin dashboard design history | `2025-11/admin-redesign/` |
| Trucking feature development | `2025-11/trucking-workflow/` |
| Specific bug fix details | `2025-11/fixes/` → Search by date or keywords |
| Old agent playbooks | `2025-11/agents-old/` |
| Historical setup guides | `2025-11/obsolete/` |

### By Date
All filenames include dates where applicable:
- `CRITICAL_FIXES_2025-11-09.md` → Bug fixes from Nov 9, 2025
- `CRITICAL_FIXES_LOAD_DETAIL_MODAL_2025-11-13.md` → Nov 13, 2025
- Search pattern: `*2025-11-*` for November 2025 docs

### By Git History
```bash
# Find when file was moved to archive:
git log --follow -- docs/archive/2025-11/[category]/[filename].md

# View file at specific commit:
git show [commit-hash]:path/to/file.md
```

---

## 📝 Current Documentation (Not Archived)

**If you're looking for current docs, go here instead:**

| Doc Type | Location |
|----------|----------|
| **Main README** | [README.md](../../README.md) |
| **Quick Navigation** | [DOCUMENTATION_INDEX.md](../../DOCUMENTATION_INDEX.md) |
| **Troubleshooting** | [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) |
| **Setup Guides** | [docs/setup/](../setup/) |
| **Architecture** | [docs/architecture/](../architecture/) |
| **Testing & Deployment** | [docs/guides/](../guides/) |
| **AI & Components** | [docs/reference/](../reference/) |
| **Planning Docs** | [docs/planning/](../planning/) |

---

## ⚠️ Using Archived Documentation

**When referencing archived docs:**

1. ✅ **Historical Context:** "We tried approach X in Nov 2025 (see archive), but switched to Y because..."
2. ✅ **Learning:** "Previous implementation shows we need to handle edge case Z"
3. ✅ **Design Decisions:** "Here's why we chose pattern A over pattern B"

**Don't:**

1. ❌ **Copy code directly:** May be outdated or replaced
2. ❌ **Follow as current guide:** Use current docs instead
3. ❌ **Assume still valid:** Verify with CHANGELOG.md or current README

---

## 🗑️ Future Archiving

**Criteria for archiving:**
- Feature complete and stable (>3 months)
- Bug fixed and verified (>1 month)
- Content superseded by new documentation
- No active references in current codebase

**Process:**
1. Create new archive folder: `docs/archive/YYYY-MM/`
2. Move files to appropriate subfolder
3. Update this README with new category
4. Update DOCUMENTATION_INDEX.md if needed
5. Commit with message: `docs: Archive obsolete docs from [period]`

---

## 📞 Questions About Archives?

**"I can't find information about X"**
→ Check [DOCUMENTATION_INDEX.md](../../DOCUMENTATION_INDEX.md) first (current docs)
→ Then search this archive folder

**"Why was this archived?"**
→ See "Why Archived" section under each category above

**"Can I un-archive a document?"**
→ Yes! If it's useful again, move it back to active docs and update DOCUMENTATION_INDEX.md

**"Should I archive my new doc?"**
→ Only if it's obsolete. Active docs stay in `docs/setup/`, `docs/guides/`, etc.

---

**Archive Maintained By:** Development Team
**Last Updated:** 2025-11-16
**Next Review:** Monthly (check for new docs to archive)
