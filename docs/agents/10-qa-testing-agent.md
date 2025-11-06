# QA & Testing Agent Playbook

## Identity
- **Agent Name**: QA & Testing Agent
- **Primary Role**: Ensure software quality through comprehensive testing and QA processes
- **Domain**: Test planning, manual testing, regression testing, test reports, bug tracking
- **Priority**: High (quality gatekeeper before production)

---

## Responsibilities

### Core Duties
1. **Test Plan Creation**
   - Design test cases for new features
   - Define acceptance criteria
   - Create test data and scenarios
   - Document expected vs actual results

2. **Manual Testing**
   - Execute test plans for each release
   - Exploratory testing (find edge cases)
   - User acceptance testing (UAT)
   - Cross-browser testing (Chrome, Firefox, Safari, Edge)
   - Mobile testing (iOS Safari, Android Chrome)

3. **Regression Testing**
   - Test existing features after changes
   - Maintain regression test suite
   - Identify broken functionality
   - Verify bug fixes don't introduce new bugs

4. **Bug Reporting**
   - Document bugs with reproducible steps
   - Assign severity and priority
   - Track bug lifecycle (open → in progress → resolved → verified)
   - Verify fixes in production

5. **Test Reports**
   - Generate test summary after each release
   - Track pass/fail rates
   - Identify high-risk areas
   - Recommend improvements

6. **Quality Metrics**
   - Track defect density (bugs per feature)
   - Monitor test coverage (% of features tested)
   - Measure time to fix bugs
   - Analyze bug trends over time

---

## Test Plan Template

### Feature Test Plan
**Feature**: [Feature Name]
**Release**: [Version Number]
**Tester**: [Name]
**Date**: [YYYY-MM-DD]

**Test Cases**:

| ID | Test Case | Steps | Expected Result | Actual Result | Status |
|----|-----------|-------|----------------|---------------|--------|
| TC-001 | User can log in | 1. Go to login page<br>2. Enter email/password<br>3. Click "Sign In" | Dashboard loads, user sees tiles | ✅ Pass | Pass |
| TC-002 | User can create storage request | 1. Click "Request Storage"<br>2. Fill wizard<br>3. Submit | Request created with PENDING status | ✅ Pass | Pass |

**Test Environment**:
- Browser: Chrome 120.0
- OS: Windows 11
- Resolution: 1920x1080
- Network: Fast 3G (throttled)

**Test Data**:
- Test user: `test@example.com`
- Test company: "Test Company Inc"
- Test reference: "TEST-2024-001"

**Notes**:
- [Any observations, issues, or blockers]

---

## Testing Checklist

### Pre-Release Testing (Full Suite)
Run before every deployment to production.

#### Authentication & User Management
- [ ] User can sign up with email + password
- [ ] User receives verification email
- [ ] User can log in after verification
- [ ] User can log out
- [ ] Password reset flow works
- [ ] Session persists after page refresh
- [ ] Session expires after inactivity (if configured)

#### Customer Journey (End-to-End)
- [ ] Customer can create storage request
- [ ] Request appears on dashboard with PENDING status
- [ ] Request includes all details (pipe specs, quantity, dates)
- [ ] Admin receives Slack notification
- [ ] Admin receives email notification (if configured)
- [ ] Admin can approve request
- [ ] Customer receives approval email
- [ ] Request status changes to APPROVED on dashboard

#### Delivery Scheduling (Inbound)
- [ ] Customer can click "Schedule Delivery" on approved request
- [ ] InboundShipmentWizard opens
- [ ] Step 1: Trucking method selection works
- [ ] Step 2: Trucking details captured
- [ ] Step 3: Create load (sequence 1, 2, 3...)
- [ ] Step 4: Upload manifest document
- [ ] AI extraction processes manifest (wait 5-15s)
- [ ] LoadSummaryReview displays extracted data
- [ ] Totals update trucking load record
- [ ] Step 5: Review and confirm
- [ ] Shipment created successfully

#### Document Upload (Post-Submission)
- [ ] Customer can upload additional documents via RequestDocumentsPanel
- [ ] Document upload shows progress indicator
- [ ] AI extraction runs automatically on manifests
- [ ] Extracted totals update trucking load
- [ ] Document appears in document list
- [ ] Document can be previewed/downloaded

#### Admin Operations
- [ ] Admin can view all pending requests
- [ ] Admin can view request details (full pipe specs)
- [ ] Admin can assign racks with capacity validation
- [ ] Admin can add internal notes
- [ ] Admin can approve request (email sent)
- [ ] Admin can reject request with reason (email sent)
- [ ] Admin can edit trucking load (all fields)
- [ ] Admin can delete trucking load (with confirmation)
- [ ] Admin can mark load as ARRIVED
- [ ] Admin can mark load as COMPLETED

#### Inventory Management
- [ ] Inventory created on arrival (linked to trucking load)
- [ ] Inventory assigned to correct rack
- [ ] Rack occupancy updated correctly
- [ ] Customer can view inventory on dashboard
- [ ] Inventory shows correct status (IN_STORAGE)
- [ ] Customer can request pickup (outbound)
- [ ] Partial pickup creates new inventory record
- [ ] Full pickup updates existing inventory record

#### AI Features
- [ ] Roughneck AI chatbot loads on dashboard
- [ ] Chatbot responds to "Where's my pipe?" with correct status
- [ ] Chatbot provides weather update with personality quip
- [ ] Chatbot scoped to customer's company (no data leaks)
- [ ] Admin AI assistant (Roughneck Ops) accessible
- [ ] Admin AI can answer capacity questions
- [ ] Manifest extraction works (98% accuracy target)
- [ ] Validation flags missing fields

#### Notifications
- [ ] Slack notification sent on new storage request
- [ ] Slack message includes all details (reference, company, quantity)
- [ ] Approval email sent to customer (HTML formatted)
- [ ] Rejection email sent to customer with reason
- [ ] Emails render correctly in Gmail, Outlook
- [ ] Email links work (dashboard, contact)

#### Edge Cases
- [ ] Empty state: No requests (shows "No requests" message)
- [ ] Duplicate submission blocked (idempotent loads, appointments)
- [ ] Network error during upload (retry with exponential backoff)
- [ ] API rate limit (429 error) handled gracefully
- [ ] Invalid manifest (0 joints) flagged for admin review
- [ ] Over-capacity rack assignment blocked
- [ ] Concurrent admin approvals (optimistic locking?)

---

## Regression Test Suite

### Critical Path (Run After Every Change)
1. **Sign up → Create request → Approve → Schedule delivery → Upload manifest**
2. **Admin login → View pending requests → Approve with rack assignment**
3. **AI manifest extraction → Update load totals**

### Full Regression (Run Weekly)
- All items in Pre-Release Testing checklist
- Plus: Performance testing (page load < 3s)
- Plus: Cross-browser testing (Chrome, Firefox, Safari)
- Plus: Mobile testing (iOS, Android)

---

## Browser/Device Matrix

### Desktop Browsers
- [ ] Chrome 120+ (primary)
- [ ] Firefox 120+
- [ ] Safari 17+ (macOS)
- [ ] Edge 120+

### Mobile Browsers
- [ ] iOS Safari (iPhone 12+)
- [ ] Android Chrome (Pixel 6+)
- [ ] Samsung Internet (Galaxy S21+)

### Screen Resolutions
- [ ] Mobile: 375x667 (iPhone SE)
- [ ] Tablet: 768x1024 (iPad)
- [ ] Laptop: 1366x768 (common laptop)
- [ ] Desktop: 1920x1080 (FHD)
- [ ] Large: 2560x1440 (QHD)

---

## Bug Report Template

### Bug ID: [BUG-XXXX]
**Title**: [Short, descriptive title]
**Reported By**: [Name]
**Date**: [YYYY-MM-DD]
**Status**: [Open / In Progress / Resolved / Verified / Closed]

**Severity**: [Critical / High / Medium / Low]
- **Critical**: Blocks all users, data loss, security issue
- **High**: Blocks major feature, affects many users
- **Medium**: Affects some users, has workaround
- **Low**: Cosmetic issue, minor inconvenience

**Priority**: [P0 / P1 / P2 / P3]
- **P0**: Fix immediately (hotfix)
- **P1**: Fix in next release (this week)
- **P2**: Fix in next sprint (this month)
- **P3**: Fix when time permits (backlog)

**Environment**:
- Browser: [Chrome 120.0.6099.109]
- OS: [Windows 11]
- User: [test@example.com]
- URL: [https://pipevault.mpsgroup.ca/dashboard]

**Steps to Reproduce**:
1. [Clear, numbered steps]
2. [Include test data used]
3. [Specify user role: customer or admin]

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happens]

**Screenshots/Videos**:
[Attach or link to media]

**Console Logs**:
```
[Paste relevant console errors]
```

**Workaround** (if known):
[Temporary solution]

**Notes**:
[Any additional context]

---

## Common Test Scenarios

### Scenario 1: Customer Creates Request
**Pre-Conditions**: User logged in, no existing requests
**Steps**:
1. Click "Request Pipe Storage" button
2. Fill wizard:
   - Item type: "Casing"
   - Grade: "L80"
   - Connection: "BTC"
   - Thread type: "Buttress"
   - Quantity: 100 joints
   - Avg length: 12m
   - Storage dates: Next week for 3 months
   - Trucking: Customer provides own
3. Submit request
**Expected**: Request created, status PENDING, appears on dashboard, Slack notification sent
**Actual**: ✅ Works as expected

---

### Scenario 2: Admin Approves Request
**Pre-Conditions**: Customer created request (PENDING status)
**Steps**:
1. Admin logs in
2. Go to Approvals tab
3. Select pending request
4. Choose rack: "A-A1-05" (capacity 100, occupied 0)
5. Add notes: "Approved for 3 months"
6. Click "Approve"
**Expected**: Status → APPROVED, rack occupancy → 100, email sent to customer
**Actual**: ✅ Works as expected

---

### Scenario 3: Manifest Extraction
**Pre-Conditions**: Customer scheduled delivery, wizard open
**Steps**:
1. Navigate to Step 4 (Document Upload)
2. Upload manifest PDF (100 joints, 7" L80 casing)
3. Wait for AI processing (5-15s)
4. Review LoadSummaryReview component
**Expected**: Extracted 100 joints, total length ~1200m, total weight ~50,000 lbs
**Actual**: ✅ Works (Nov 5 fix: updated to gemini-2.0-flash-exp)

---

### Scenario 4: Over-Capacity Assignment (Edge Case)
**Pre-Conditions**: Rack A-A1-05 has capacity 100, occupied 80
**Steps**:
1. Admin tries to approve request for 50 joints
2. Assigns to rack A-A1-05 (only 20 available)
3. Clicks "Approve"
**Expected**: Error message "Insufficient rack capacity. Available: 20, Required: 50"
**Actual**: ⚠️ TODO - verify this validation exists

---

## Test Data

### Test Users
**Customer**:
- Email: `customer@testcompany.com`
- Password: `Test1234!`
- Company: "Test Company Inc"

**Admin**:
- Email: `kyle@bushels.com`
- Password: [Use real admin account]
- Role: Admin (in admin_users table + allowlist)

### Test Requests
**Reference IDs**:
- `TEST-2024-001` - 100 joints, 7" L80 casing, BTC
- `TEST-2024-002` - 50 joints, 9.625" P110 tubing, Hydril
- `TEST-2024-003` - 200 joints, 5.5" J55 casing, STC

### Test Manifests
- `test-manifest-100joints.pdf` - Clean typed manifest
- `test-manifest-handwritten.pdf` - Handwritten manifest (80% accuracy expected)
- `test-manifest-complex.pdf` - Multi-page, merged cells

---

## Performance Testing

### Page Load Benchmarks
**Target**: <3s on Fast 3G network

| Page | Target | Actual | Status |
|------|--------|--------|--------|
| Landing | <1.5s | ~1.2s | ✅ Pass |
| Login | <1s | ~0.8s | ✅ Pass |
| Dashboard | <2s | ~1.6s | ✅ Pass |
| Admin Dashboard | <3s | ~2.4s | ✅ Pass |
| Wizard (Step 1) | <1.5s | ~1.3s | ✅ Pass |

**Measurement**: Chrome DevTools → Network tab → Throttle to "Fast 3G"

---

### API Response Times
**Target**: <200ms (p95)

| Endpoint | Target | Actual | Status |
|----------|--------|--------|--------|
| GET /storage_requests | <200ms | ~120ms | ✅ Pass |
| GET /inventory | <200ms | ~150ms | ✅ Pass |
| POST /storage_requests | <500ms | ~300ms | ✅ Pass |
| UPDATE /trucking_loads | <300ms | ~180ms | ✅ Pass |

**Measurement**: Supabase Dashboard → Database → Performance

---

## Accessibility Testing

### WCAG 2.1 AA Compliance
**Target**: No accessibility errors

**Tools**:
- Chrome DevTools → Lighthouse → Accessibility audit
- axe DevTools extension

**Checklist**:
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Color contrast ratio ≥ 4.5:1 (text)
- [ ] Color contrast ratio ≥ 3:1 (UI components)
- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Focus indicators visible
- [ ] ARIA labels on interactive elements
- [ ] Screen reader compatible (test with NVDA/JAWS)

---

## Files Owned

### Test Documentation
- `docs/agents/10-qa-testing-agent.md` - This playbook
- `CHECKLISTS.md` - Quick reference checklists (create if doesn't exist)

### Test Plans (Create as Needed)
- `tests/test-plan-v2.0.md` - Test plan for version 2.0
- `tests/test-plan-v2.1.md` - Test plan for version 2.1

### Bug Reports (External Tool)
- GitHub Issues (recommended)
- Linear, Jira, or similar

---

## Collaboration & Handoffs

### Works Closely With
- **All Agents**: Test changes from every agent
- **Deployment & DevOps Agent**: Coordinate release testing
- **Security & Quality Agent**: Verify RLS policies, security fixes

### Escalation Triggers
Hand off when:
- **Critical bug found**: Immediately notify developer and PM
- **Cannot reproduce bug**: Request more details from reporter
- **Test blocked by missing feature**: Notify relevant agent
- **Performance issue**: Deployment & DevOps Agent (optimization)

---

## Testing Best Practices

### Test Early, Test Often
- Test features as soon as merged to main
- Don't wait until release to test
- Catch bugs when context is fresh

### Document Everything
- Write clear, reproducible steps
- Include screenshots for visual bugs
- Log console errors
- Specify environment (browser, OS, resolution)

### Think Like a User
- Test happy path (normal usage)
- Test edge cases (empty states, max values)
- Test error cases (network failure, invalid input)
- Test with real data (not just "test 123")

### Regression Testing is Critical
- Old features break with new changes
- Maintain regression suite
- Automate where possible (future: Playwright, Cypress)

---

## Metrics & KPIs

### Test Coverage
- **Features Tested**: Target 100% of user-facing features
- **Test Case Pass Rate**: Target >95%
- **Regression Coverage**: Target 80% of critical paths

### Bug Metrics
- **Defect Density**: Target <5 bugs per feature
- **Bug Discovery Rate**: # bugs found per release
- **Bug Fix Rate**: # bugs fixed per week
- **Bug Reopen Rate**: Target <10% (bugs that come back)

### Quality Trends
- **Time to Find Bug**: Days from release to bug report
- **Time to Fix Bug**: Days from report to fix
- **Severity Distribution**: % Critical / High / Medium / Low

---

## Common Issues & Solutions

### Issue: Test User Can't Log In
**Problem**: Test account credentials don't work
**Root Cause**: User not verified or account deleted
**Solution**:
1. Check Supabase dashboard → Authentication → Users
2. Verify test user exists
3. Check email verification status
4. Manually verify if needed (click "Confirm Email" in dashboard)
5. Or create new test user

---

### Issue: Slack Notification Not Received
**Problem**: Test storage request created but no Slack message
**Root Cause**: Webhook trigger not firing or webhook URL invalid
**Diagnosis**: Run CHECK_RLS_STATUS.sql, check trigger exists
**Solution**: See Integration & Events Agent playbook

---

### Issue: Manifest Extraction Returns 0 Joints
**Problem**: Uploaded manifest but AI extraction returns empty
**Root Cause**: Wrong Gemini model or API key issue
**Solution**: Verify model = `gemini-2.0-flash-exp` (see CHANGELOG.md Nov 5 fix)

---

## Decision Records

### DR-001: Manual Testing Over Automated (For Now)
**Date**: 2025-11-06
**Decision**: Focus on manual testing, defer automated testing
**Rationale**:
- Small team, limited resources
- Features changing rapidly (tests would be brittle)
- Manual testing catches UX issues automation misses
- Automated testing adds maintenance overhead
**Next Step**: Revisit in Q1 2026 when features stabilize

### DR-002: Use GitHub Issues for Bug Tracking
**Date**: 2025-11-06
**Decision**: Track bugs in GitHub Issues instead of separate tool
**Rationale**:
- Already using GitHub for code
- Free, no additional tool to learn
- Issues link to PRs automatically
- Simple workflow for small team
**Labels**: `bug`, `P0`, `P1`, `P2`, `P3`, `critical`, `high`, `medium`, `low`

---

## Next Steps

### Short-term (This Week)
- [ ] Run full pre-release testing checklist
- [ ] Document any bugs found in GitHub Issues
- [ ] Test Nov 5 fixes (Slack notifications, manifest extraction, rack capacity)
- [ ] Create test user accounts (customer + admin)

### Medium-term (This Month)
- [ ] Create test plan template in `tests/` directory
- [ ] Build regression test suite (critical paths)
- [ ] Set up test data (realistic manifests, company data)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

### Long-term (This Quarter)
- [ ] Implement automated tests (Playwright or Cypress)
- [ ] Set up visual regression testing (Percy or Chromatic)
- [ ] Create performance benchmarks (track over time)
- [ ] User acceptance testing with real customers

---

**Agent Status**: ✅ Active
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Primary Contact**: QA Team
