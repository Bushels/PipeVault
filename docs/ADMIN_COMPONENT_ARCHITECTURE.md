# Admin Dashboard Component Architecture

**Version:** 1.0.0
**Date:** 2025-11-07
**Status:** Design Phase

---

## Overview

This document defines the component architecture for the tile-based admin dashboard. The design mirrors the customer dashboard's tile pattern while adapting for admin-specific workflows.

**Key Principles:**
1. **Consistency** - Reuse customer dashboard patterns (600×480px tiles, horizontal scroll)
2. **Company-Centric** - Organize by company rather than data type
3. **Progressive Disclosure** - Lightweight tiles → detailed modal
4. **Mobile-First** - Responsive across 3 breakpoints

---

## Design System

### Color Palette

**Primary Colors:**
```css
/* Admin Theme (Teal/Cyan) - Distinct from customer purple/indigo */
--admin-primary: #0891b2;      /* cyan-600 */
--admin-primary-hover: #0e7490; /* cyan-700 */
--admin-accent: #06b6d4;        /* cyan-500 */
--admin-dark: #164e63;          /* cyan-900 */

/* Status Colors (Reused from customer) */
--status-pending: #ca8a04;      /* yellow-600 */
--status-approved: #16a34a;     /* green-600 */
--status-rejected: #dc2626;     /* red-600 */
--status-complete: #2563eb;     /* blue-600 */

/* Neutral Colors */
--bg-primary: #111827;          /* gray-900 */
--bg-secondary: #1f2937;        /* gray-800 */
--border-default: #374151;      /* gray-700 */
--text-primary: #f9fafb;        /* gray-50 */
--text-secondary: #9ca3af;      /* gray-400 */
```

### Typography

```css
/* Headings */
--text-3xl: 30px;   /* Page titles */
--text-2xl: 24px;   /* Section headers */
--text-xl: 20px;    /* Card headers */
--text-lg: 18px;    /* Subsection headers */

/* Body */
--text-base: 16px;  /* Body text */
--text-sm: 14px;    /* Secondary text */
--text-xs: 12px;    /* Labels, badges */
--text-xxs: 10px;   /* Uppercase labels */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing

```css
/* Consistent spacing scale (Tailwind default) */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
```

### Breakpoints

```css
/* Mobile-first responsive breakpoints */
--breakpoint-sm: 640px;   /* Small devices (phones landscape) */
--breakpoint-md: 768px;   /* Medium devices (tablets) */
--breakpoint-lg: 1024px;  /* Large devices (desktops) */
--breakpoint-xl: 1280px;  /* Extra large devices */
```

---

## Component Hierarchy

```
AdminDashboard (Page)
├── AdminHeader
├── CompanyFilter (Search/Sort)
├── CompanyTileCarousel
│   ├── CompanyTile (repeating)
│   │   ├── CompanyTileHeader
│   │   ├── CompanyTileStats
│   │   └── CompanyTileActions
│   └── ScrollControls
├── CompanyDetailModal (lazy-loaded)
│   ├── ModalHeader
│   ├── TabNav (Requests | Inventory | Loads | Activity)
│   ├── RequestsTab
│   │   ├── ApprovalWorkflow
│   │   └── RequestList
│   ├── InventoryTab
│   │   ├── InventoryStats
│   │   └── InventoryGrid
│   ├── LoadsTab
│   │   ├── LoadTimeline
│   │   └── LoadList
│   └── ActivityTab
│       └── ActivityFeed
└── AdminFooter (Pending approvals badge)
```

---

## Core Components

### 1. CompanyTileCarousel

**Purpose:** Horizontal scrolling container displaying company summary tiles

**Dimensions:**
- Container: Full width with padding
- Scroll area: Horizontal with hidden scrollbars
- Tile gap: 24px (space-6)

**Behavior:**
- Snap scroll to tiles
- Wheel-scroll support (vertical → horizontal)
- Touch/swipe support
- Prev/Next buttons (show when scrollable)

**TypeScript Interface:**
```typescript
interface CompanyTileCarouselProps {
  companies: CompanySummary[];
  onCompanyClick: (companyId: string) => void;
  selectedCompanyId?: string | null;
}
```

**Responsive Behavior:**
| Breakpoint | Tiles Visible | Scroll Method |
|------------|---------------|---------------|
| Mobile (<640px) | 1 tile | Swipe + buttons |
| Tablet (640-1024px) | 1.5 tiles | Swipe + buttons |
| Desktop (>1024px) | 2-3 tiles | Wheel + buttons |

**Implementation Notes:**
- Reuse `RequestSummaryPanel` scroll logic
- Add keyboard navigation (arrow keys)
- Maintain scroll position when adding/removing companies

---

### 2. CompanyTile

**Purpose:** Lightweight summary card showing key company metrics

**Dimensions:**
```css
width: 100% (mobile)
       calc(100% - 2rem) (tablet)
       600px (desktop)
height: 480px (fixed)
```

**Layout Structure:**
```
┌─────────────────────────────────────────┐
│ [Company Icon] COMPANY NAME         [•] │  ← Header (80px)
│ domain.com                              │
├─────────────────────────────────────────┤
│                                         │
│ Quick Stats Grid (2×2)                  │  ← Stats (200px)
│   [Pending] [Approved]                  │
│   [Loads]   [Inventory]                 │
│                                         │
├─────────────────────────────────────────┤
│ Recent Activity (3 items)               │  ← Activity (140px)
│ • Request #MPS-001 approved             │
│ • Load #2 delivered                     │
│ • 15 joints added to inventory          │
├─────────────────────────────────────────┤
│ [View Details] [Quick Approve (3)]      │  ← Actions (60px)
└─────────────────────────────────────────┘
```

**Visual Design:**
```css
/* Base Styles */
background: gradient-to-br from-gray-900 via-gray-900 to-gray-800
border: 1px solid gray-700/50
border-radius: 16px (rounded-2xl)
box-shadow: 2xl
overflow: hidden
position: relative

/* 3D Glow Effect */
::before {
  position: absolute
  inset: -1px
  background: gradient-to-r from-cyan-600 via-blue-600 to-cyan-600
  border-radius: 17px
  blur: 8px
  opacity: 0 → 0.2 (on hover)
  transition: opacity 0.3s
}

/* Status Glow (Based on pending count) */
.has-pending::after {
  position: absolute
  inset: 0
  background: gradient-to-br from-yellow-500 to-transparent
  opacity: 0.1
}
```

**TypeScript Interface:**
```typescript
interface CompanyTileProps {
  company: CompanySummary;
  onClick: () => void;
  isSelected: boolean;
}

interface CompanySummary {
  id: string;
  name: string;
  domain: string;
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  totalInventoryItems: number;
  inStorageItems: number;
  totalLoads: number;
  inboundLoads: number;
  outboundLoads: number;
  latestActivity?: string;
}
```

**States:**
- **Default** - Neutral glow
- **Has Pending** - Yellow glow (`pendingRequests > 0`)
- **Selected** - Cyan border highlight
- **Hover** - 3D glow effect
- **Loading** - Skeleton shimmer animation

**Interaction:**
- Click anywhere → Open detail modal
- "Quick Approve" button → Open approval workflow (if pending > 0)
- "View Details" button → Same as click

---

### 3. CompanyTileHeader

**Purpose:** Display company name, domain, and status indicators

**Layout:**
```tsx
<div className="flex items-center justify-between pb-4 border-b border-gray-700/50">
  <div className="flex items-center gap-4">
    {/* Company Icon */}
    <div className="w-12 h-12 bg-cyan-600/20 rounded-lg flex items-center justify-center">
      <BuildingIcon className="w-6 h-6 text-cyan-400" />
    </div>

    {/* Company Info */}
    <div>
      <h3 className="text-xl font-bold text-white">{company.name}</h3>
      <p className="text-xs text-gray-400">{company.domain}</p>
    </div>
  </div>

  {/* Status Dot */}
  {company.pendingRequests > 0 && (
    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
  )}
</div>
```

**TypeScript Interface:**
```typescript
interface CompanyTileHeaderProps {
  company: Pick<CompanySummary, 'name' | 'domain' | 'pendingRequests'>;
}
```

---

### 4. CompanyTileStats

**Purpose:** Display key metrics in a 2×2 grid

**Layout:**
```tsx
<div className="grid grid-cols-2 gap-3 py-4">
  {/* Pending Requests */}
  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
    <p className="text-xxs uppercase tracking-wider text-gray-400 font-semibold mb-1">
      Pending
    </p>
    <p className="text-2xl font-bold text-yellow-300">
      {company.pendingRequests}
    </p>
  </div>

  {/* Approved Requests */}
  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
    <p className="text-xxs uppercase tracking-wider text-gray-400 font-semibold mb-1">
      Approved
    </p>
    <p className="text-2xl font-bold text-green-300">
      {company.approvedRequests}
    </p>
  </div>

  {/* Total Loads */}
  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
    <p className="text-xxs uppercase tracking-wider text-gray-400 font-semibold mb-1">
      Loads
    </p>
    <p className="text-2xl font-bold text-blue-300">
      {company.totalLoads}
    </p>
  </div>

  {/* Inventory */}
  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
    <p className="text-xxs uppercase tracking-wider text-gray-400 font-semibold mb-1">
      Inventory
    </p>
    <p className="text-2xl font-bold text-cyan-300">
      {company.inStorageItems}
    </p>
  </div>
</div>
```

**TypeScript Interface:**
```typescript
interface CompanyTileStatsProps {
  company: Pick<
    CompanySummary,
    'pendingRequests' | 'approvedRequests' | 'totalLoads' | 'inStorageItems'
  >;
}
```

**Stat Cards Color Coding:**
| Metric | Color | Rationale |
|--------|-------|-----------|
| Pending | Yellow (`yellow-300`) | Requires attention |
| Approved | Green (`green-300`) | Positive status |
| Loads | Blue (`blue-300`) | Logistics activity |
| Inventory | Cyan (`cyan-300`) | Admin theme color |

---

### 5. CompanyTileActions

**Purpose:** Quick access buttons for common admin actions

**Layout:**
```tsx
<div className="pt-4 border-t border-gray-700/50 flex gap-2">
  <Button
    onClick={() => onViewDetails(company.id)}
    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-medium"
  >
    View Details
  </Button>

  {company.pendingRequests > 0 && (
    <Button
      onClick={(e) => {
        e.stopPropagation();
        onQuickApprove(company.id);
      }}
      className="px-4 bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
    >
      Quick Approve ({company.pendingRequests})
    </Button>
  )}
</div>
```

**TypeScript Interface:**
```typescript
interface CompanyTileActionsProps {
  company: Pick<CompanySummary, 'id' | 'pendingRequests'>;
  onViewDetails: (companyId: string) => void;
  onQuickApprove: (companyId: string) => void;
}
```

**Button States:**
- Primary action: "View Details" (always visible)
- Conditional action: "Quick Approve" (only if `pendingRequests > 0`)

---

### 6. CompanyDetailModal

**Purpose:** Full-screen modal showing comprehensive company data

**Dimensions:**
```css
/* Mobile */
width: 100vw
height: 100vh
padding: 16px

/* Desktop */
width: 90vw
max-width: 1400px
height: 90vh
padding: 32px
```

**Layout Structure:**
```
┌──────────────────────────────────────────────────┐
│ [X] COMPANY NAME                          Close  │  ← Header (60px)
│ domain.com                                       │
├──────────────────────────────────────────────────┤
│ [Requests] [Inventory] [Loads] [Activity]        │  ← Tabs (48px)
├──────────────────────────────────────────────────┤
│                                                  │
│                                                  │
│                                                  │
│           Tab Content Area                       │  ← Content (flexible)
│                                                  │
│                                                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

**TypeScript Interface:**
```typescript
interface CompanyDetailModalProps {
  companyId: string;
  onClose: () => void;
  initialTab?: 'requests' | 'inventory' | 'loads' | 'activity';
}
```

**Data Loading:**
- Uses `useCompanyDetails(companyId)` hook
- Shows loading skeleton while fetching
- Caches data in React Query (3 min stale time)
- Lazy loads tabs (only fetch when clicked)

**Responsive Behavior:**
| Breakpoint | Layout | Tabs |
|------------|--------|------|
| Mobile | Full-screen overlay | Scrollable horizontal |
| Tablet | 80vw modal | Stacked vertical |
| Desktop | 90vw modal (max 1400px) | Horizontal nav |

---

### 7. ApprovalWorkflow

**Purpose:** Streamlined UI for approving/rejecting storage requests

**Layout:**
```tsx
<div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
  {/* Request Summary */}
  <div className="mb-6">
    <h3 className="text-lg font-bold text-white mb-2">
      {request.referenceId}
    </h3>
    <p className="text-sm text-gray-400">
      {request.requestDetails?.companyName} • {request.requestDetails?.fullName}
    </p>
  </div>

  {/* Pipe Specifications */}
  <div className="grid grid-cols-2 gap-4 mb-6">
    <div>
      <p className="text-xs text-gray-400 mb-1">Pipe Type</p>
      <p className="text-white font-medium">
        {request.requestDetails?.itemType}
      </p>
    </div>
    <div>
      <p className="text-xs text-gray-400 mb-1">Quantity</p>
      <p className="text-white font-medium">
        {request.requestDetails?.totalJoints} joints
      </p>
    </div>
  </div>

  {/* Rack Assignment */}
  <div className="mb-6">
    <label className="block text-sm font-medium text-white mb-2">
      Assign Storage Location
    </label>
    <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white">
      <option>Select rack...</option>
      <option>Yard A - Rack 1 (50% full)</option>
      <option>Yard A - Rack 2 (20% full)</option>
      <option>Yard B - Rack 1 (80% full)</option>
    </select>
  </div>

  {/* Actions */}
  <div className="flex gap-3">
    <Button
      onClick={onApprove}
      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
    >
      Approve & Notify Customer
    </Button>
    <Button
      onClick={onReject}
      className="bg-red-600 hover:bg-red-700 text-white px-6"
    >
      Reject
    </Button>
  </div>
</div>
```

**TypeScript Interface:**
```typescript
interface ApprovalWorkflowProps {
  request: StorageRequest;
  onApprove: (rackId: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}
```

**Workflow States:**
1. **Review** - Display request details
2. **Assign** - Select rack location
3. **Validate** - Check capacity constraints
4. **Confirm** - Send approval/rejection email
5. **Complete** - Update UI with new status

---

## Component File Structure

```
components/admin/
├── tiles/
│   ├── CompanyTileCarousel.tsx       (Container)
│   ├── CompanyTile.tsx                (Card)
│   ├── CompanyTileHeader.tsx          (Header section)
│   ├── CompanyTileStats.tsx           (Stats grid)
│   └── CompanyTileActions.tsx         (Action buttons)
├── modals/
│   ├── CompanyDetailModal.tsx         (Full modal)
│   ├── ModalHeader.tsx                (Modal header)
│   └── ModalTabNav.tsx                (Tab navigation)
├── tabs/
│   ├── RequestsTab.tsx                (Requests view)
│   ├── InventoryTab.tsx               (Inventory view)
│   ├── LoadsTab.tsx                   (Loads view)
│   └── ActivityTab.tsx                (Activity feed)
├── workflows/
│   ├── ApprovalWorkflow.tsx           (Approve/reject UI)
│   ├── RackAssignment.tsx             (Rack selector)
│   └── EmailPreview.tsx               (Email preview)
└── shared/
    ├── CompanyIcon.tsx                (Company avatar)
    ├── StatusBadge.tsx                (Status indicators)
    └── LoadingTile.tsx                (Skeleton loader)
```

---

## Accessibility

### Keyboard Navigation

**Tile Carousel:**
- `←` / `→` - Navigate between tiles
- `Enter` / `Space` - Open selected tile details
- `Tab` - Navigate through action buttons

**Modal:**
- `Esc` - Close modal
- `Tab` - Navigate through interactive elements
- `1` / `2` / `3` / `4` - Switch tabs (when modal focused)

### ARIA Labels

```tsx
// Tile Carousel
<div
  role="region"
  aria-label="Company overview tiles"
  aria-live="polite"
>
  {companies.map(company => (
    <div
      role="article"
      aria-label={`${company.name} summary`}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Tile content */}
    </div>
  ))}
</div>

// Modal
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title">{company.name} Details</h2>
  {/* Modal content */}
</div>
```

### Screen Reader Support

**Announcements:**
- Company count: "Showing 4 companies"
- Pending alerts: "3 pending approvals for Bushels Energy"
- Status changes: "Request MPS-001 approved successfully"
- Loading states: "Loading company details..."

---

## Performance Optimization

### Lazy Loading

**Tiles:**
- Load initial 5 companies
- Infinite scroll for 50+ companies
- Virtualization for 100+ companies

**Modal:**
- Lazy load tab content
- Only fetch data when tab clicked
- Prefetch on hover (low priority)

### Code Splitting

```typescript
// Lazy load modal
const CompanyDetailModal = React.lazy(() =>
  import('./modals/CompanyDetailModal')
);

// Lazy load heavy components
const ApprovalWorkflow = React.lazy(() =>
  import('./workflows/ApprovalWorkflow')
);
```

### React Query Caching

```typescript
// Aggressive caching for summaries (5 min stale)
useCompanySummaries() // staleTime: 5 * 60 * 1000

// Shorter cache for details (3 min stale)
useCompanyDetails(companyId) // staleTime: 3 * 60 * 1000

// Invalidate on mutations
queryClient.invalidateQueries(['companies'])
```

---

## Responsive Breakpoints

### Mobile (<640px)

**Tile Carousel:**
- 1 tile visible
- Full-width tiles
- Touch swipe only
- No prev/next buttons

**Modal:**
- Full-screen overlay
- Stacked tabs (vertical)
- Single-column layout

### Tablet (640px - 1024px)

**Tile Carousel:**
- 1.5 tiles visible
- Snap to center
- Swipe + buttons

**Modal:**
- 80vw modal
- Horizontal tabs
- Two-column layout

### Desktop (>1024px)

**Tile Carousel:**
- 2-3 tiles visible
- Scroll with wheel
- Prev/next buttons

**Modal:**
- 90vw modal (max 1400px)
- Horizontal tabs
- Three-column layout

---

## Animation & Transitions

### Tile Hover Effect

```css
.company-tile {
  transition: transform 0.2s, box-shadow 0.3s;
}

.company-tile:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5),
              0 10px 10px -5px rgba(0, 0, 0, 0.4);
}

.company-tile:hover::before {
  opacity: 0.2; /* 3D glow effect */
}
```

### Modal Open/Close

```css
@keyframes modalOpen {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-enter {
  animation: modalOpen 0.2s ease-out;
}
```

### Loading Skeleton

```css
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    #1f2937 0%,
    #374151 50%,
    #1f2937 100%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}
```

---

## Next Steps

1. **Create wireframes** for 3 breakpoints (mobile, tablet, desktop)
2. **Set up feature flags** (`VITE_ENABLE_TILE_ADMIN`)
3. **Build skeleton components** (structure only, no logic)
4. **Implement tile carousel** with scroll behavior
5. **Add data integration** with `useCompanySummaries()` hook

**Estimated Timeline:**
- Wireframes: 1 hour
- Feature flags: 30 minutes
- Skeleton components: 2-3 hours
- Full implementation: Week 2-3

---

## References

- **Customer Tile Pattern:** `components/RequestSummaryPanel.tsx`
- **Data Hooks:** `hooks/useCompanyData.ts`
- **Strategic Plan:** `docs/ADMIN_DASHBOARD_REDESIGN_PLAN.md`
- **Database Optimizations:** `docs/DATABASE_OPTIMIZATION_ANALYSIS.md`
