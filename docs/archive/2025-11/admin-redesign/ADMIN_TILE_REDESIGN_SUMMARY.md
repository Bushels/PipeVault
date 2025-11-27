# Admin Dashboard Tile Redesign - Executive Summary

**Date:** 2025-11-08
**Author:** Admin Operations Orchestrator Agent
**Status:** Planning Complete, Ready for Implementation

---

## Quick Links

- **Full Analysis:** [ADMIN_TILE_REDESIGN_ANALYSIS.md](./ADMIN_TILE_REDESIGN_ANALYSIS.md)
- **Implementation Checklist:** [ADMIN_TILE_IMPLEMENTATION_CHECKLIST.md](./ADMIN_TILE_IMPLEMENTATION_CHECKLIST.md)
- **Database Migration:** [../supabase/migrations/20251108000001_add_project_summaries_function.sql](../supabase/migrations/20251108000001_add_project_summaries_function.sql)

---

## What's Changing?

### Current System (Week 1)
```
One tile per COMPANY
├─ Summary stats (counts only)
├─ No project-level detail
├─ No load information
└─ Non-functional approval buttons
```

### New System (Week 2-3)
```
One tile per PROJECT REFERENCE
├─ Company grouping with vertical stacking
├─ Full project details
├─ Expandable load sections
├─ AI-parsed manifest data
├─ Functional approval workflow
└─ Document access
```

---

## Visual Comparison

### Before
```
[ACME Corp]          [Vendor Inc]         [Client Co]
Pending: 5           Pending: 2           Pending: 0
Approved: 10         Approved: 5          Approved: 3
Loads: 15            Loads: 7             Loads: 3
Inventory: 500       Inventory: 200       Inventory: 100
```

### After
```
[ACME Corp]                    [Vendor Inc]              [Client Co]
├─ REF-001                     ├─ REF-005                ├─ REF-008
│  Status: Waiting Load #1     │  Status: In Storage     │  Status: Approved
│  > Load #1 (INBOUND)         │  Inventory: 100 joints  │  > Load #1 (INBOUND)
│  > Load #2 (INBOUND)         │  Rack: A-B1-05         │     Status: Scheduled
│  [Approve] [Reject]          │                          │     Rack: A-B1-06
│                              │                          │
├─ REF-002                     └─ REF-006                └─ REF-009
│  Status: In Storage             Status: Pickup Ready      Status: Pending Approval
└─ REF-003
   Status: Approved
```

---

## Key Changes

### 1. Data Model
- **New RPC:** `get_project_summaries_by_company()`
- **Returns:** Project-level data with nested loads
- **Performance:** <500ms for 200 projects

### 2. Components
- **12 new components** (~2,500 lines)
- **4 deleted components** (~332 lines)
- **1 modified component** (CompanyTileCarousel → CompanyGroupCarousel)

### 3. Features
- **Vertical stacking** - Multiple projects per company
- **Load details** - Expandable sections for each trucking load
- **Manifest viewing** - AI-parsed data from documents
- **Functional approvals** - Actually triggers database updates
- **Rack assignment** - Shows assigned storage locations
- **Contact info** - Quick access to submitter details

---

## Implementation Timeline

### Week 2 (Days 1-5)
- **Day 1:** Database foundation (RPC function, indexes)
- **Day 2:** TypeScript types and hooks
- **Day 3:** Core components (ProjectTile, LoadCard)
- **Day 4:** Detail components (manifest viewer, approval modal)
- **Day 5:** Carousel integration (horizontal + vertical scroll)

### Week 3 (Days 1-5)
- **Day 1:** Approval workflow integration
- **Day 2:** Rejection workflow
- **Day 3:** Comprehensive testing
- **Day 4:** Bug fixes and polish
- **Day 5:** Deployment and monitoring

**Total:** 10 days, 62 hours

---

## Files Created

### Database
```
supabase/migrations/
└── 20251108000001_add_project_summaries_function.sql  (NEW)
```

### Hooks
```
hooks/
├── useProjectSummaries.ts                              (NEW)
├── useApprovalWorkflow.ts                              (NEW)
└── useWorkflowState.ts                                 (NEW)
```

### Components
```
components/admin/tiles/
├── CompanyGroupCarousel.tsx                            (MODIFIED from CompanyTileCarousel)
├── CompanyGroup.tsx                                    (NEW)
├── ProjectTile.tsx                                     (NEW)
├── ProjectHeader.tsx                                   (NEW)
├── PipeRequestDetails.tsx                              (NEW)
├── LoadsSection.tsx                                    (NEW)
├── LoadCard.tsx                                        (NEW)
├── LoadSummary.tsx                                     (NEW)
├── LoadDetails.tsx                                     (NEW)
├── ManifestTable.tsx                                   (NEW)
├── DocumentViewer.tsx                                  (NEW - extracted from existing)
├── StorageSection.tsx                                  (NEW)
├── ApprovalActions.tsx                                 (NEW)
└── ApprovalModal.tsx                                   (NEW)
```

### Types
```
types/
└── projectSummary.ts                                   (NEW)
```

### Utilities
```
utils/
├── workflowState.ts                                    (NEW)
└── groupProjectsByCompany.ts                           (NEW)
```

---

## Files Deleted (After Testing)

```
components/admin/tiles/
├── CompanyTile.tsx                                     (DELETE)
├── CompanyTileHeader.tsx                               (DELETE)
├── CompanyTileStats.tsx                                (DELETE)
└── CompanyTileActions.tsx                              (DELETE)
```

---

## Critical Fixes Included

### Issue 1: Admin Company Filter
**Problem:** mpsgroup.ca appears in tiles
**Solution:** Database-level filtering in RPC function
```sql
WHERE c.domain != p_exclude_admin_domain
```

### Issue 2: Heading Change
**Problem:** "Company Overview" → "Company Dashboard"
**Solution:** Update heading prop in CompanyGroupCarousel
```typescript
<h2>Company Dashboard</h2>
```

### Issue 3: Non-Functional Approvals
**Problem:** Quick Approve button only does console.log
**Solution:** Full integration with existing approval workflow
- Rack capacity validation
- Atomic database updates
- Email notifications
- Slack webhooks
- Cache invalidation

---

## Status Mapping Reference

### Database → Customer Labels

| Database Status | Load States | Customer Label |
|----------------|-------------|----------------|
| PENDING | - | "Pending Approval" |
| APPROVED | First INBOUND=NEW | "Waiting on Load #1 to MPS" |
| APPROVED | First INBOUND=APPROVED | "Load #1 Scheduled" |
| APPROVED | First INBOUND=IN_TRANSIT | "Load #1 In Transit" |
| APPROVED | All INBOUND=COMPLETED | "In Storage" |
| APPROVED | OUTBOUND=APPROVED | "Pickup Scheduled" |
| APPROVED | OUTBOUND=IN_TRANSIT | "Pickup In Progress" |
| COMPLETED | - | "Project Complete" |
| REJECTED | - | "Rejected" |

---

## Performance Targets

| Metric | Target | Acceptable | Current (Week 1) |
|--------|--------|------------|------------------|
| **Initial Load** | <500ms | <1s | ~150ms |
| **Network Payload** | <200 KB | <500 KB | ~15 KB |
| **Scroll Performance** | 60 FPS | 30 FPS | 60 FPS |
| **Approval Latency** | <500ms | <1s | N/A (broken) |

---

## Migration Strategy

### Phase 1: Parallel Deployment
```typescript
// Feature flag toggle
const ENABLE_NEW_TILES = process.env.NEXT_PUBLIC_FEATURE_NEW_TILES === 'true';

return (
  <div>
    {ENABLE_NEW_TILES ? (
      <CompanyGroupCarousel />  // NEW
    ) : (
      <CompanyTileCarousel />    // OLD
    )}
  </div>
);
```

### Phase 2: Validation
- Deploy with flag=false (old tiles)
- Test new tiles on staging
- Enable flag=true for admins to test
- Monitor for 2-3 days

### Phase 3: Cleanup
- Remove old components
- Remove feature flag
- Update documentation

---

## Rollback Plan

If issues arise:

1. **Immediate:** Set `NEXT_PUBLIC_FEATURE_NEW_TILES=false`
2. **Short-term:** Keep old components for 1 week
3. **Long-term:** Monitor error logs and gather feedback

**No data migration needed** - Schema unchanged, only query pattern different.

---

## Success Criteria

- [ ] Tiles display project-level data correctly
- [ ] Approval workflow updates database atomically
- [ ] Rack occupancy updates correctly
- [ ] Emails sent successfully
- [ ] Slack notifications trigger
- [ ] Performance within targets
- [ ] No critical bugs reported
- [ ] Admins prefer new interface

---

## Next Steps

1. **Review this summary** with team
2. **Get approval** for 10-day timeline
3. **Begin Day 1:** Create database migration
4. **Follow checklist** day-by-day
5. **Test thoroughly** before deployment
6. **Deploy with feature flag** for safe rollout

---

## Questions?

**For technical details:** See [ADMIN_TILE_REDESIGN_ANALYSIS.md](./ADMIN_TILE_REDESIGN_ANALYSIS.md)

**For implementation tasks:** See [ADMIN_TILE_IMPLEMENTATION_CHECKLIST.md](./ADMIN_TILE_IMPLEMENTATION_CHECKLIST.md)

**For database schema:** See migration file in `supabase/migrations/20251108000001_add_project_summaries_function.sql`

---

## Document Metadata

- **Version:** 1.0
- **Created:** 2025-11-08
- **Last Updated:** 2025-11-08
- **Status:** Planning Complete
- **Next Phase:** Implementation (Week 2)
