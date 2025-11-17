# Tile Components Testing Guide

**Date**: 2025-11-09
**Sprint**: Week 1 - Foundation (Testing Phase)
**Status**: ✅ Components Integrated & Ready for Testing

---

## Overview

This guide documents the integration and testing of the new tile-based admin dashboard components. The tile UI is now integrated into AdminDashboard.tsx and can be toggled via feature flag.

---

## What Was Completed

### 1. Component Integration
**File**: `components/admin/AdminDashboard.tsx`

**Changes Made**:
- ✅ Added import for `CompanyTileCarousel` component
- ✅ Added import for feature flag utilities (`isFeatureEnabled`, `FEATURES`)
- ✅ Added state management for `selectedCompanyId`
- ✅ Modified `renderOverview()` to support conditional rendering based on feature flag
- ✅ Integrated tile carousel with click handler for company selection

**Code Changes**:
```typescript
// New imports (lines 44-45)
import { isFeatureEnabled, FEATURES } from '../../utils/featureFlags';
import CompanyTileCarousel from './tiles/CompanyTileCarousel';

// New state (line 115)
const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

// Modified renderOverview function (lines 731-946)
const renderOverview = () => {
  const useTileUI = isFeatureEnabled(FEATURES.TILE_ADMIN);

  if (useTileUI) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Company Dashboard</h2>
        <CompanyTileCarousel
          onSelectCompany={(companyId) => {
            setSelectedCompanyId(companyId);
            // TODO: Open CompanyDetailModal when implemented in Week 2
            console.log('Selected company:', companyId);
          }}
          selectedCompanyId={selectedCompanyId}
        />
      </div>
    );
  }

  // Legacy overview UI
  return (/* ... existing overview ... */);
};
```

### 2. Feature Flag Configuration
**File**: `.env`

**Changes Made**:
- ✅ Set `VITE_ENABLE_TILE_ADMIN=true` to enable tile-based UI

**Before**:
```bash
VITE_ENABLE_TILE_ADMIN=false
```

**After**:
```bash
VITE_ENABLE_TILE_ADMIN=true
```

### 3. TypeScript Validation
**Build Status**: ✅ Successful

```bash
npm run build
# ✓ 207 modules transformed
# ✓ built in 3.08s
# No TypeScript errors
```

---

## How to Test

### Test Environment Setup

1. **Development Server Running**: ✅
   - URL: [http://localhost:3001](http://localhost:3001)
   - Status: Running (port 3000 was in use, auto-switched to 3001)

2. **Feature Flag**: ✅
   - `VITE_ENABLE_TILE_ADMIN=true` (tile UI enabled)

### Testing Checklist

#### 1. Visual Verification
- [ ] Navigate to admin dashboard (requires admin credentials)
- [ ] Verify "Company Dashboard" heading appears (instead of "Dashboard Overview")
- [ ] Verify CompanyTileCarousel is rendered
- [ ] Verify tiles are displayed in horizontal scroll container

#### 2. Data Loading Tests
- [ ] **Loading State**: Tiles show skeleton loaders while data fetches
- [ ] **Success State**: Company tiles populate with real data from `get_company_summaries()` RPC
- [ ] **Empty State**: If no companies exist, appropriate message is shown
- [ ] **Error State**: If RPC fails, error message is displayed

#### 3. Scroll Behavior Tests
- [ ] **Horizontal Scroll**: Tiles scroll horizontally with mouse drag
- [ ] **Wheel Scroll**: Vertical mouse wheel scrolls tiles horizontally
- [ ] **Snap Behavior**: Tiles snap to aligned positions when scroll stops
- [ ] **Navigation Buttons**: Prev/Next arrows appear when there are multiple tiles
- [ ] **Button Visibility**: Prev button hidden at start, Next button hidden at end

#### 4. Tile Interaction Tests
- [ ] **Click Handler**: Clicking a tile logs company ID to console
- [ ] **Keyboard Navigation**: Pressing Enter/Space on focused tile triggers selection
- [ ] **Selected State**: Selected tile shows cyan border highlight
- [ ] **Hover Effect**: Tiles show 3D glow effect on hover
- [ ] **Status Glow**: Tiles with pending requests show yellow background glow
- [ ] **Status Glow**: Tiles without pending requests show cyan background glow

#### 5. Component Sub-Section Tests

**CompanyTileHeader** (80px height):
- [ ] Company icon displays (building SVG)
- [ ] Company name displays correctly
- [ ] Company domain displays correctly
- [ ] Status dot appears (yellow pulse) when `pendingRequests > 0`
- [ ] Status dot hidden when no pending requests

**CompanyTileStats** (200px height):
- [ ] Pending count displays in yellow (top-left)
- [ ] Approved count displays in green (top-right)
- [ ] Loads count displays in blue (bottom-left)
- [ ] Inventory count displays in cyan (bottom-right)
- [ ] All metrics are accurate based on database data

**Activity Feed** (140px height):
- [ ] Latest activity date displays correctly
- [ ] Total requests count displays
- [ ] Total loads count displays
- [ ] "No recent activity" message shows when `latestActivity` is null

**CompanyTileActions** (60px height):
- [ ] "View Details" button always visible
- [ ] "Quick Approve (N)" button only visible when `pendingRequests > 0`
- [ ] Button click handlers work (check console logs)
- [ ] Buttons styled correctly (cyan for View, yellow for Approve)

#### 6. Responsive Design Tests
- [ ] **Desktop (>1024px)**: 2-3 tiles visible
- [ ] **Tablet (640-1024px)**: 1.5 tiles visible
- [ ] **Mobile (<640px)**: 1 tile visible, full width
- [ ] Touch targets are 48px minimum on mobile

#### 7. Accessibility Tests
- [ ] Keyboard navigation works (Tab to focus, Enter/Space to select)
- [ ] ARIA labels present on status indicators
- [ ] Screen reader announces company summary correctly
- [ ] Focus indicators are visible

#### 8. Performance Tests
- [ ] **Query Count**: Only 1 database query (verify in DevTools Network tab)
- [ ] **Load Time**: Initial data loads in <200ms (check React Query DevTools)
- [ ] **Render Performance**: No jank/lag when scrolling tiles
- [ ] **Memory**: No memory leaks when switching between tabs

#### 9. Feature Flag Toggle Test
**Test A: Enable Tile UI**
1. Set `.env`: `VITE_ENABLE_TILE_ADMIN=true`
2. Restart dev server
3. Navigate to Overview tab
4. ✅ Should see "Company Dashboard" with tile carousel

**Test B: Disable Tile UI (Legacy Mode)**
1. Set `.env`: `VITE_ENABLE_TILE_ADMIN=false`
2. Restart dev server
3. Navigate to Overview tab
4. ✅ Should see "Dashboard Overview" with legacy stats cards

#### 10. Console Tests
- [ ] No React errors in console
- [ ] No TypeScript errors in console
- [ ] Feature flag logging shows: `✅ TILE_ADMIN: true`
- [ ] Company selection logs correctly: `"Selected company: <company_id>"`

---

## Known Issues & Limitations

### Expected Behavior (Not Bugs)
1. **Quick Approve Button**: Currently logs to console
   - **Reason**: CompanyDetailModal not implemented yet (Week 2 task)
   - **TODO**: Replace console.log with modal trigger in Week 2

2. **View Details Button**: Currently logs to console
   - **Reason**: CompanyDetailModal not implemented yet (Week 2 task)
   - **TODO**: Replace console.log with modal trigger in Week 2

3. **No Detail Modal**: Clicking tiles only logs to console
   - **Reason**: CompanyDetailModal scheduled for Week 2
   - **TODO**: Implement modal in Week 2 (18-24 hours estimated)

### Database Requirements
- **Required RPC**: `get_company_summaries()` must exist in Supabase
- **Migration**: `20250105_company_summaries_rpc.sql` must be applied
- **Performance**: Expect 50x improvement over legacy queries (5-10s → 100-200ms)

---

## Testing Environment

### Local Development
```bash
# Start dev server
npm run dev

# Access application
# URL: http://localhost:3001
# Navigate to: Admin Dashboard → Overview tab
```

### Browser DevTools
**React Query DevTools**:
- Press `Ctrl+Shift+D` to toggle React Query DevTools
- Inspect `useCompanySummaries` query
- Verify query runs only once on mount
- Check stale time and cache behavior

**Network Tab**:
- Filter by XHR/Fetch
- Verify only 1 request to `get_company_summaries`
- Check response time (<200ms expected)

**Console**:
- Feature flags auto-log in development mode
- Company selection events log: `"Selected company: <id>"`
- No errors should appear

---

## Rollback Plan

If issues are discovered during testing:

### Option 1: Disable Feature Flag (Immediate)
```bash
# .env
VITE_ENABLE_TILE_ADMIN=false
```
- Restart dev server
- Legacy UI restored immediately
- No code changes needed

### Option 2: Revert Integration (If Critical Bug)
```bash
git diff HEAD components/admin/AdminDashboard.tsx
git checkout HEAD -- components/admin/AdminDashboard.tsx
```
- Reverts AdminDashboard.tsx to previous state
- Tile components remain in codebase (no deletion)
- Can resume testing after bug fix

---

## Next Steps After Testing

### If Tests Pass (Expected)
1. ✅ Mark Week 1 Foundation as 100% complete
2. 📋 Update CHANGELOG.md with tile integration
3. 📋 Create GitHub issue for Week 2 modal implementation
4. 📋 Schedule Week 2 kickoff (modal + tabs + approval workflow)

### If Tests Fail
1. 🐛 Document all bugs found
2. 🐛 Prioritize by severity (P0 blockers, P1 high, P2 medium, P3 low)
3. 🐛 Fix P0/P1 bugs before proceeding to Week 2
4. 🐛 Create tickets for P2/P3 bugs (non-blockers)

### Week 2 Preview (Next Sprint)
**Estimated Duration**: 18-24 hours
**Deliverables**:
- CompanyDetailModal.tsx (main container)
- 4 tab components (Requests, Inventory, Loads, Activity)
- ApprovalWorkflow component (Quick Approve functionality)
- Modal animations and transitions
- Tab navigation and state management

---

## Troubleshooting

### Issue: Tiles Not Rendering
**Check**:
1. Feature flag set correctly: `VITE_ENABLE_TILE_ADMIN=true`
2. Dev server restarted after .env change
3. Browser cache cleared (hard refresh: Ctrl+Shift+R)

### Issue: No Data Loading
**Check**:
1. Database migration applied: `20250105_company_summaries_rpc.sql`
2. RPC function exists: `SELECT * FROM get_company_summaries();`
3. Network tab shows successful RPC call
4. React Query DevTools shows query succeeded

### Issue: TypeScript Errors
**Check**:
```bash
npm run build
```
- If errors appear, compare AdminDashboard.tsx with this guide
- Verify all imports are correct
- Check closing braces in renderOverview function

### Issue: Console Errors
**Common Errors**:
- `Cannot find module './tiles/CompanyTileCarousel'`
  → Check import path is correct (relative path from AdminDashboard.tsx)

- `isFeatureEnabled is not a function`
  → Check feature flags import: `import { isFeatureEnabled, FEATURES } from '../../utils/featureFlags';`

- `selectedCompanyId is not defined`
  → Verify state declaration: `const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);`

---

## Testing Metrics

### Performance Benchmarks (Expected)
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Initial Load | <200ms | React Query DevTools |
| Query Count | 1 RPC call | Network tab |
| Improvement | 50x faster | Compare to legacy (5-10s) |
| Tile Render | <16ms | React DevTools Profiler |

### Code Quality Metrics
| Metric | Status |
|--------|--------|
| TypeScript Build | ✅ No errors |
| Component Structure | ✅ 5 files, properly composed |
| Feature Flag | ✅ Clean toggle |
| Accessibility | ✅ Keyboard navigation |

---

## Testing Sign-Off

**Tester**: _________________
**Date**: _________________
**Environment**: Local Development (http://localhost:3001)
**Feature Flag**: `VITE_ENABLE_TILE_ADMIN=true`

**Test Results**:
- [ ] All visual tests passed
- [ ] All interaction tests passed
- [ ] All performance tests passed
- [ ] No critical bugs found
- [ ] Ready for Week 2 implementation

**Notes**:
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________

---

## Appendix: File Manifest

### Modified Files
1. `components/admin/AdminDashboard.tsx`
   - Lines 44-45: Added imports
   - Line 115: Added selectedCompanyId state
   - Lines 731-946: Modified renderOverview function

2. `.env`
   - Line 21: Set VITE_ENABLE_TILE_ADMIN=true

### Created Files (Week 1)
1. `components/admin/tiles/CompanyTileCarousel.tsx` (218 lines)
2. `components/admin/tiles/CompanyTile.tsx` (139 lines)
3. `components/admin/tiles/CompanyTileHeader.tsx` (53 lines)
4. `components/admin/tiles/CompanyTileStats.tsx` (65 lines)
5. `components/admin/tiles/CompanyTileActions.tsx` (48 lines)

### Supporting Files (Pre-existing)
1. `hooks/useCompanyData.ts` - React Query hooks
2. `utils/featureFlags.ts` - Feature flag utilities
3. `supabase/migrations/20250105_company_summaries_rpc.sql` - Database RPC

---

**End of Testing Guide**
