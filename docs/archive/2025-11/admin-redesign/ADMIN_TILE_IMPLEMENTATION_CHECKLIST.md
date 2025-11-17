# Admin Dashboard Tile Redesign - Implementation Checklist

**Date:** 2025-11-08
**Related:** ADMIN_TILE_REDESIGN_ANALYSIS.md
**Timeline:** 10 days (62 hours)

---

## Phase 1: Backend Foundation (Week 2, Day 1-2)

### Day 1: Database Layer

- [ ] **Migration 1: RPC Function**
  - [ ] Create `20251108000001_add_project_summaries_function.sql`
  - [ ] Add `get_project_summaries_by_company()` function
  - [ ] Add admin company filtering (`mpsgroup.ca`)
  - [ ] Apply migration: `npx supabase db push`
  - [ ] **Validation:** Run `SELECT * FROM get_project_summaries_by_company() LIMIT 10;`

- [ ] **Database Indexes**
  - [ ] Add index on `trucking_loads(storage_request_id)`
  - [ ] Add index on `inventory(reference_id)`
  - [ ] Add index on `companies(domain)`
  - [ ] Add index on `storage_requests(created_at DESC)`
  - [ ] Add index on `trucking_documents(trucking_load_id)`
  - [ ] **Validation:** Run `EXPLAIN ANALYZE` on RPC function

- [ ] **Performance Testing**
  - [ ] Test with 10 companies, 50 projects
  - [ ] Test with 50 companies, 200 projects
  - [ ] Test with 100 companies, 500 projects
  - [ ] **Target:** <500ms execution time
  - [ ] Document results in spreadsheet

- [ ] **Mark Old Function Deprecated**
  - [ ] Add deprecation comment to `get_company_summaries()`
  - [ ] Update function documentation

**Time Estimate:** 6 hours

---

### Day 2: TypeScript Integration

- [ ] **Type Definitions**
  - [ ] Create `types/projectSummary.ts`
  - [ ] Define `ProjectSummary` interface
  - [ ] Define `LoadSummary` interface
  - [ ] Define `WorkflowState` type
  - [ ] **Validation:** TypeScript compiles with no errors

- [ ] **Data Hooks**
  - [ ] Create `hooks/useProjectSummaries.ts`
  - [ ] Implement React Query fetching
  - [ ] Add caching strategy (5 min stale time)
  - [ ] Add error handling
  - [ ] **Validation:** Hook returns typed data

- [ ] **Utility Functions**
  - [ ] Create `utils/workflowState.ts`
  - [ ] Implement `calculateWorkflowState()` function
  - [ ] Implement `getStatusBadgeTheme()` function
  - [ ] Add unit tests for status calculation
  - [ ] **Validation:** Tests pass with 100% coverage

- [ ] **Test with Real Data**
  - [ ] Connect hook to database
  - [ ] Log returned data structure
  - [ ] Verify all fields populated correctly
  - [ ] Check for null/undefined handling

**Time Estimate:** 4 hours

---

## Phase 2: Component Development (Week 2, Day 3-5)

### Day 3: Core Components

- [ ] **ProjectHeader Component**
  - [ ] Create `components/admin/tiles/ProjectHeader.tsx`
  - [ ] Display company name
  - [ ] Display reference ID (REF-XXX)
  - [ ] Display workflow status badge
  - [ ] Display submitter email
  - [ ] Display submitter phone (if available)
  - [ ] **Validation:** Renders correctly with mock data

- [ ] **PipeRequestDetails Component**
  - [ ] Create `components/admin/tiles/PipeRequestDetails.tsx`
  - [ ] Parse `request_details` JSONB
  - [ ] Display pipe type
  - [ ] Display grade
  - [ ] Display outer diameter
  - [ ] Display quantity
  - [ ] Display length (if available)
  - [ ] **Validation:** Handles missing fields gracefully

- [ ] **ProjectTile Container**
  - [ ] Create `components/admin/tiles/ProjectTile.tsx`
  - [ ] Integrate ProjectHeader
  - [ ] Integrate PipeRequestDetails
  - [ ] Add placeholder for LoadsSection
  - [ ] Add placeholder for ApprovalActions
  - [ ] Apply tile styling (600x480px base)
  - [ ] **Validation:** Tile displays correctly

- [ ] **Styling**
  - [ ] Match customer tile aesthetic
  - [ ] Add 3D glow effect on hover
  - [ ] Add status-based background glow
  - [ ] Ensure responsive on mobile
  - [ ] **Validation:** Visual inspection

**Time Estimate:** 8 hours

---

### Day 4: Load Components

- [ ] **LoadSummary Component**
  - [ ] Create `components/admin/tiles/LoadSummary.tsx`
  - [ ] Display load number (e.g., "Load #1")
  - [ ] Display direction badge (INBOUND/OUTBOUND)
  - [ ] Display status badge
  - [ ] Display scheduled dates
  - [ ] Display joints planned/completed
  - [ ] Display rack location (if assigned)
  - [ ] Display document count
  - [ ] Add expand/collapse toggle
  - [ ] **Validation:** Collapsed view is 1 line

- [ ] **LoadDetails Component**
  - [ ] Create `components/admin/tiles/LoadDetails.tsx`
  - [ ] Create section for full details
  - [ ] Display trucking company
  - [ ] Display contact info
  - [ ] Display pickup/delivery locations
  - [ ] Add placeholder for ManifestTable
  - [ ] Add placeholder for DocumentViewer
  - [ ] **Validation:** Expanded view shows all data

- [ ] **LoadCard Container**
  - [ ] Create `components/admin/tiles/LoadCard.tsx`
  - [ ] Integrate LoadSummary
  - [ ] Integrate LoadDetails
  - [ ] Implement expand/collapse state
  - [ ] Add animation for expand/collapse
  - [ ] **Validation:** Toggle works smoothly

- [ ] **LoadsSection Container**
  - [ ] Create `components/admin/tiles/LoadsSection.tsx`
  - [ ] Map over inbound loads
  - [ ] Map over outbound loads
  - [ ] Add section headers ("Inbound Loads", "Outbound Loads")
  - [ ] Handle empty states
  - [ ] **Validation:** Renders multiple loads correctly

**Time Estimate:** 8 hours

---

### Day 5: Detail Components

- [ ] **ManifestTable Component**
  - [ ] Create `components/admin/tiles/ManifestTable.tsx`
  - [ ] Parse `parsed_payload` from trucking_documents
  - [ ] Display table with columns: Heat #, Serial #, Length, etc.
  - [ ] Handle different manifest formats
  - [ ] Add sorting capability
  - [ ] **Validation:** Displays AI-parsed data correctly

- [ ] **DocumentViewer Component**
  - [ ] Locate existing document viewer code
  - [ ] Extract from RequestDocumentsPanel
  - [ ] Create reusable `components/admin/tiles/DocumentViewer.tsx`
  - [ ] Support PDF preview
  - [ ] Support image preview
  - [ ] Add download button
  - [ ] **Validation:** Opens documents correctly

- [ ] **ApprovalModal Component**
  - [ ] Create `components/admin/tiles/ApprovalModal.tsx`
  - [ ] Add rack selector UI
  - [ ] Display required capacity
  - [ ] Display available capacity
  - [ ] Show capacity validation errors
  - [ ] Add internal notes textarea
  - [ ] Add Confirm/Cancel buttons
  - [ ] **Validation:** Capacity validation works

- [ ] **RackSelector Component**
  - [ ] Locate existing rack selector code
  - [ ] Extract from AdminDashboard approval modal
  - [ ] Create reusable component
  - [ ] Display racks grouped by area
  - [ ] Show capacity bars
  - [ ] Highlight selected racks
  - [ ] **Validation:** Selection updates correctly

- [ ] **ApprovalActions Component**
  - [ ] Create `components/admin/tiles/ApprovalActions.tsx`
  - [ ] Add Approve button
  - [ ] Add Reject button
  - [ ] Add Notes field (optional)
  - [ ] Only show for PENDING status
  - [ ] **Validation:** Buttons trigger modals

**Time Estimate:** 8 hours

---

### Day 6: Carousel Integration

- [ ] **CompanyGroup Component**
  - [ ] Create `components/admin/tiles/CompanyGroup.tsx`
  - [ ] Add company header with collapse/expand
  - [ ] Create vertical stack container
  - [ ] Map over ProjectTile[] for each project
  - [ ] Add expand/collapse animation
  - [ ] **Validation:** Vertical stacking works

- [ ] **CompanyGroupCarousel Component**
  - [ ] Create `components/admin/tiles/CompanyGroupCarousel.tsx`
  - [ ] Copy horizontal scroll logic from CompanyTileCarousel
  - [ ] Implement grouping algorithm (group projects by company)
  - [ ] Integrate useProjectSummaries() hook
  - [ ] Add wheel scroll handler
  - [ ] Add prev/next navigation buttons
  - [ ] **Validation:** Horizontal scroll works

- [ ] **Grouping Logic**
  - [ ] Create `utils/groupProjectsByCompany.ts`
  - [ ] Group projects by `companyId`
  - [ ] Sort companies alphabetically
  - [ ] Sort projects within each company (newest first)
  - [ ] **Validation:** Groups correctly

- [ ] **Loading States**
  - [ ] Add skeleton loaders for tiles
  - [ ] Add loading spinner for carousel
  - [ ] Handle empty state (no projects)
  - [ ] **Validation:** Loading states display

- [ ] **Error Handling**
  - [ ] Add error boundary
  - [ ] Display error message on RPC failure
  - [ ] Add retry button
  - [ ] **Validation:** Errors handled gracefully

**Time Estimate:** 6 hours

---

## Phase 3: Workflow Integration (Week 3, Day 1-2)

### Day 7: Approval Workflow

- [ ] **Extract Approval Logic**
  - [ ] Copy `approveRequest()` from AdminDashboard.tsx (lines ~82-200)
  - [ ] Create `hooks/useApprovalWorkflow.ts`
  - [ ] Paste approval logic into hook
  - [ ] Add React Query mutation
  - [ ] Add error handling
  - [ ] **Validation:** Hook compiles

- [ ] **Rack Capacity Validation**
  - [ ] Implement `validateRackCapacity()` helper
  - [ ] Check total available across selected racks
  - [ ] Consider allocation mode (LINEAR_CAPACITY vs SLOT)
  - [ ] Return validation result with details
  - [ ] **Validation:** Unit tests pass

- [ ] **Atomic Database Updates**
  - [ ] Update storage_request status
  - [ ] Update rack occupancy (atomic)
  - [ ] Create inventory records
  - [ ] Set approval timestamp
  - [ ] Set approver email
  - [ ] **Validation:** All updates in transaction

- [ ] **Email Notifications**
  - [ ] Verify emailService.ts works
  - [ ] Test approval email template
  - [ ] Include reference ID
  - [ ] Include rack assignments
  - [ ] Include next steps for customer
  - [ ] **Validation:** Email received

- [ ] **Slack Notifications**
  - [ ] Verify Slack webhook trigger exists
  - [ ] Test notification on approval
  - [ ] Include company name
  - [ ] Include reference ID
  - [ ] Include approver name
  - [ ] **Validation:** Slack message posted

- [ ] **React Query Cache Invalidation**
  - [ ] Invalidate `['admin', 'project-summaries']`
  - [ ] Invalidate `['requests']`
  - [ ] Invalidate `['racks']`
  - [ ] Invalidate `['inventory']`
  - [ ] **Validation:** UI updates automatically

- [ ] **Connect to ProjectTile**
  - [ ] Pass `onApprove` handler to ProjectTile
  - [ ] Call `useApprovalWorkflow()` in carousel
  - [ ] Handle success state (close modal, show toast)
  - [ ] Handle error state (show error, keep modal open)
  - [ ] **Validation:** End-to-end approval works

**Time Estimate:** 6 hours

---

### Day 8: Rejection Workflow

- [ ] **Extract Rejection Logic**
  - [ ] Copy rejection logic from AdminDashboard.tsx
  - [ ] Add to `useApprovalWorkflow.ts`
  - [ ] Create React Query mutation
  - [ ] Add error handling
  - [ ] **Validation:** Hook compiles

- [ ] **RejectionModal Component**
  - [ ] Create `components/admin/tiles/RejectionModal.tsx`
  - [ ] Add rejection reason textarea (required)
  - [ ] Add Confirm/Cancel buttons
  - [ ] Validate reason is not empty
  - [ ] **Validation:** Modal displays

- [ ] **Rejection Database Updates**
  - [ ] Update storage_request status to REJECTED
  - [ ] Set rejection_reason
  - [ ] Set rejected_at timestamp
  - [ ] Do NOT update rack occupancy
  - [ ] **Validation:** Database updated correctly

- [ ] **Rejection Email**
  - [ ] Verify emailService.ts has rejection template
  - [ ] Test rejection email
  - [ ] Include reference ID
  - [ ] Include rejection reason
  - [ ] Include contact info for questions
  - [ ] **Validation:** Email received

- [ ] **Connect to ProjectTile**
  - [ ] Pass `onReject` handler to ProjectTile
  - [ ] Open RejectionModal on Reject button click
  - [ ] Handle success state (close modal, show toast)
  - [ ] Handle error state (show error, keep modal open)
  - [ ] **Validation:** End-to-end rejection works

- [ ] **Admin Notes**
  - [ ] Add optional notes field to approval modal
  - [ ] Save to `internal_notes` column
  - [ ] Display in ProjectTile if present
  - [ ] **Validation:** Notes persisted

**Time Estimate:** 4 hours

---

## Phase 4: Testing (Week 3, Day 3)

### Day 9: Comprehensive Testing

- [ ] **Unit Tests**
  - [ ] Test `calculateWorkflowState()` with various load states
  - [ ] Test `validateRackCapacity()` edge cases
  - [ ] Test `groupProjectsByCompany()` sorting
  - [ ] Test ProjectHeader renders all fields
  - [ ] Test LoadCard expand/collapse
  - [ ] **Target:** 80%+ code coverage

- [ ] **Integration Tests**
  - [ ] Test approval workflow end-to-end
  - [ ] Test rejection workflow end-to-end
  - [ ] Test rack assignment with multiple racks
  - [ ] Test insufficient capacity error
  - [ ] Test cache invalidation on approval
  - [ ] **Target:** All critical paths covered

- [ ] **E2E Tests (Playwright)**
  - [ ] Test: Admin opens tile carousel
  - [ ] Test: Admin expands company group
  - [ ] Test: Admin expands load details
  - [ ] Test: Admin approves pending request
  - [ ] Test: Admin rejects pending request
  - [ ] Test: Tile updates after approval
  - [ ] **Target:** Smoke tests pass

- [ ] **Performance Testing**
  - [ ] Measure initial load time
  - [ ] Measure scroll FPS
  - [ ] Measure time to interactive
  - [ ] Measure approval latency
  - [ ] **Target:** Within targets from analysis doc

- [ ] **Cross-Browser Testing**
  - [ ] Chrome (desktop)
  - [ ] Firefox (desktop)
  - [ ] Safari (desktop)
  - [ ] Edge (desktop)
  - [ ] Chrome (mobile)
  - [ ] Safari (iOS)
  - [ ] **Target:** No critical bugs

- [ ] **Responsive Testing**
  - [ ] Desktop (1920x1080)
  - [ ] Laptop (1440x900)
  - [ ] Tablet (768x1024)
  - [ ] Mobile (375x667)
  - [ ] **Target:** Usable on all sizes

- [ ] **Accessibility Testing**
  - [ ] Keyboard navigation works
  - [ ] Screen reader labels correct
  - [ ] Focus indicators visible
  - [ ] Color contrast sufficient
  - [ ] **Target:** WCAG 2.1 AA compliance

- [ ] **Load Testing**
  - [ ] Test with 10 companies, 50 projects
  - [ ] Test with 50 companies, 200 projects
  - [ ] Test with 100 companies, 500 projects
  - [ ] **Target:** No UI lag or freezing

**Time Estimate:** 8 hours

---

## Phase 5: Bug Fixes & Deployment (Week 3, Day 4-5)

### Day 10: Bug Fixes

- [ ] **Critical Bugs**
  - [ ] Fix any approval workflow failures
  - [ ] Fix any data loading errors
  - [ ] Fix any UI breaking bugs
  - [ ] **Priority:** Must fix before deployment

- [ ] **Medium Priority Bugs**
  - [ ] Fix styling issues
  - [ ] Fix animation glitches
  - [ ] Fix loading state issues
  - [ ] **Priority:** Fix if time allows

- [ ] **UI Polish**
  - [ ] Smooth animations
  - [ ] Consistent spacing
  - [ ] Proper loading indicators
  - [ ] Accessible error messages
  - [ ] **Priority:** Nice to have

- [ ] **Code Review**
  - [ ] Self-review all new code
  - [ ] Check for console.logs
  - [ ] Check for TODO comments
  - [ ] Ensure consistent code style
  - [ ] **Priority:** Code quality check

**Time Estimate:** 6 hours

---

### Day 11: Deployment

- [ ] **Pre-Deployment Checklist**
  - [ ] All tests passing
  - [ ] No console errors
  - [ ] Performance targets met
  - [ ] Documentation updated
  - [ ] **Ready:** Go/No-Go decision

- [ ] **Feature Flag Setup**
  - [ ] Add `NEXT_PUBLIC_FEATURE_NEW_TILES` to .env
  - [ ] Add conditional rendering in AdminDashboard.tsx
  - [ ] Test toggle between old and new
  - [ ] **Validation:** Both versions work

- [ ] **Deployment Steps**
  - [ ] Merge to main branch
  - [ ] Deploy to staging
  - [ ] Test on staging
  - [ ] Deploy to production
  - [ ] Monitor error logs
  - [ ] **Validation:** No critical errors

- [ ] **Post-Deployment Monitoring**
  - [ ] Check error logs (first 1 hour)
  - [ ] Check performance metrics
  - [ ] Check user feedback
  - [ ] **Target:** <1% error rate

- [ ] **Gather Feedback**
  - [ ] Ask admins to test new tiles
  - [ ] Note any issues or confusion
  - [ ] Document requested improvements
  - [ ] **Goal:** Understand admin experience

- [ ] **Cleanup (if stable)**
  - [ ] Remove old tile components
  - [ ] Remove CompanyTileCarousel.tsx
  - [ ] Remove CompanyTile.tsx
  - [ ] Remove CompanyTileHeader.tsx
  - [ ] Remove CompanyTileStats.tsx
  - [ ] Remove CompanyTileActions.tsx
  - [ ] Remove feature flag
  - [ ] **Validation:** No references to old code

- [ ] **Documentation Updates**
  - [ ] Update CHANGELOG.md
  - [ ] Update README if needed
  - [ ] Document any gotchas
  - [ ] **Deliverable:** Updated docs

**Time Estimate:** 4 hours

---

## Summary

### Total Tasks: 150+
### Total Time: 62 hours (10 days)

### Success Criteria
- [ ] New tiles display project-level data correctly
- [ ] Approval workflow updates database atomically
- [ ] Emails and Slack notifications work
- [ ] Performance within targets (<500ms load)
- [ ] No critical bugs reported
- [ ] Admins prefer new interface

### Rollback Plan
- Keep old components until stable (3+ days)
- Feature flag allows instant revert
- Database migration is backward compatible

### Next Steps After Completion
1. Monitor usage for 1 week
2. Gather admin feedback
3. Prioritize enhancement requests
4. Plan Phase 2 improvements (lazy loading, pagination)

---

**Last Updated:** 2025-11-08
**Owner:** Admin Operations Orchestrator Agent
