# Admin Dashboard Tile-Based Redesign - Strategic Plan
**Project**: Major UI/UX Redesign - Company-Centric Tile Interface
**Status**: Planning Phase
**Priority**: P1 - High (Strategic Enhancement)
**Estimated Timeline**: 8-10 weeks
**Coordinated By**: Orchestration Agent
**Date**: 2025-11-07

---

## Executive Summary

This plan outlines a comprehensive redesign of the Admin Dashboard from a tab-based table interface to a modern, tile-based company-centric layout. The redesign aims to match the successful UX patterns established in the customer dashboard while improving admin efficiency and maintaining all current functionality.

**Key Objectives**:
- Reorganize admin view by company (instead of by data type)
- Implement tile-based interface matching customer dashboard aesthetics
- Integrate approval workflows inline within company tiles
- Display all company data (requests, loads, inventory) in unified view
- Maintain/improve performance with new data loading strategies
- Zero functionality regression - all features must remain accessible

---

## Phase 1: Research & Analysis - FINDINGS

### 1.1 Current Customer Dashboard Analysis

**File**: `C:\Users\kyle\MPS\PipeVault\components\Dashboard.tsx`

**Architecture**:
- Simple container component with state management
- Switches between `StorageRequestMenu` (main view) and wizard flows
- Clean separation: Header + Main Content Area
- Mobile-first responsive design

**Key Pattern**: `StorageRequestMenu` displays tiles via `RequestSummaryPanel`

**File**: `C:\Users\kyle\MPS\PipeVault\components\RequestSummaryPanel.tsx` (632 lines)

**Tile Design Characteristics**:
```
- Horizontal scrolling carousel with snap points
- Fixed height tiles (480px)
- Width: 600px desktop, full-width mobile
- Gradient backgrounds with status-based glow effects
- Card structure:
  - Header: Status badge + Action buttons
  - Reference ID (large, prominent)
  - Details Grid: 2-column layout with data cards
  - Logistics Overview section
  - Archive/Restore controls
```

**Visual Elements**:
- Status badges with color-coded themes (pending/success/info/danger/neutral)
- 3D glow effects (`absolute -inset-1 bg-gradient-to-r ... blur-lg`)
- Grid patterns for texture (`bg-grid-pattern opacity-5`)
- Progress indicators and mini-cards for metrics
- Responsive scroll buttons (prev/next navigation)

**State Management**:
- Uses React Query for data fetching (via hooks in parent)
- Local state for UI interactions (scroll position, filters)
- Optimistic updates for archive/restore

### 1.2 Current Admin Dashboard Analysis

**File**: `C:\Users\kyle\MPS\PipeVault\components\admin\AdminDashboard.tsx`

**Current Structure** (Partial read - 300 lines of 1300+ total):
- Tab-based navigation: Overview, Approvals, Requests, Companies, Inventory, Storage, Shipments, AI
- Complex props interface with 13+ different data arrays
- Heavy use of useMemo for derived data transformations
- Mutation hooks from React Query for data updates
- Modal-based workflows (document viewer, load editing)

**Data Model** (21+ tables):
```
Core Entities:
- companies (4 rows)
- storage_requests (3 rows)
- trucking_loads (4 rows)
- inventory (0 rows)
- shipments (3 rows)
- shipment_trucks (3 rows)
- trucking_documents (2 rows with AI-parsed manifest data)

Support Tables:
- yards (3) → yard_areas (12) → racks (112)
- admin_users, notifications, notification_queue
- conversations, documents, dock_appointments
```

**Current Admin Functions** (from AdminDashboardProps):
```typescript
- approveRequest(requestId, rackIds, joints, notes)
- rejectRequest(requestId, reason)
- addTruckLoad(truckLoad)
- pickUpPipes(pipeIds, uwi, wellName, truckLoadId?)
- updateRequest(request)
```

**Key Admin Features**:
1. Request approval workflow with location assignment
2. Trucking load management (inbound/outbound tracking)
3. Document viewer with AI-extracted manifest data display
4. Inventory tracking by company/project
5. Real-time status updates
6. Notes and internal communication

### 1.3 Database Schema Analysis

**Company-Request Relationship**:
```sql
companies (id, name, domain)
  ↓ (1:many)
storage_requests (id, company_id, reference_id, status, request_details)
  ↓ (1:many)
trucking_loads (id, storage_request_id, direction, status, sequence_number)
  ↓ (1:many)
trucking_documents (id, trucking_load_id, parsed_payload)
  ↓ (generates)
shipment_items (manifest data)
  ↓ (becomes)
inventory (id, company_id, request_id, status)
```

**Critical Insights**:
- Company is the natural grouping dimension (company_id on most tables)
- Currently only 4 companies in system
- Each company has 0-N storage requests
- Each request has 0-N trucking loads (inbound + outbound)
- Inventory links back to both company AND request
- All data can be efficiently fetched with nested joins

### 1.4 Technology Stack Analysis

**Current Stack**:
- React 19 + TypeScript
- Supabase (PostgreSQL + Realtime + Storage)
- TanStack React Query v5.20 for data fetching/caching
- Tailwind CSS for styling
- Custom UI components (Card, Button from `components/ui/`)

**State Management**:
- React Query handles server state (requests, inventory, loads)
- Local component state for UI (tabs, modals, filters)
- No global state library (Zustand/Redux)

**Performance Considerations**:
- Current admin dashboard reads 1300+ lines (39KB file)
- Needs pagination for inventory (currently implements page/perPage)
- Document viewer uses filters (direction, status, docType)
- Real-time updates via Supabase subscriptions (potential)

### 1.5 Component Inventory

**Total React Components**: 31 files in `components/` directory

**Reusable Components** (already exist):
- `Card.tsx` - Base card component
- `Button.tsx` - Button variants
- `RequestSummaryPanel.tsx` - Tile carousel (customer-facing)
- `ManifestDataDisplay.tsx` - AI manifest data viewer

**Admin-Specific Components**:
- `AdminHeader.tsx` - Admin navigation
- `AdminDashboard.tsx` - Main container (needs redesign)
- `AdminAIAssistant.tsx` - AI chat interface
- `TruckReceiving.tsx` - Truck logging
- `TruckLoadHistory.tsx` - Load history view
- `ManifestDataDisplay.tsx` - Document data display

---

## Phase 2: Strategic Planning

### 2.1 Tile Taxonomy Design

**Proposed Tile Structure**:

```
┌─────────────────────────────────────────────────────────┐
│ ADMIN DASHBOARD - COMPANY-CENTRIC VIEW                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Filter: All Companies ▾] [Status: All ▾] [Search...]  │
│                                                          │
│  ← → [Horizontal Scrolling Carousel]                    │
│                                                          │
│  ┌──────────────────────────────────┐                  │
│  │  COMPANY TILE: Summit Drilling   │                  │
│  ├──────────────────────────────────┤                  │
│  │  Active Requests: 2              │                  │
│  │  Total Inventory: 240 joints     │                  │
│  │  ─────────────────────────       │                  │
│  │  📋 Request: AFE-158970-1        │                  │
│  │     Status: Approved ✓           │                  │
│  │     120 joints L80 BTC           │                  │
│  │     Inbound: 1 load complete     │                  │
│  │     [Approve] [View Details]     │                  │
│  │  ─────────────────────────       │                  │
│  │  📋 Request: WELL-42-A           │                  │
│  │     Status: Pending Approval ⏳  │                  │
│  │     120 joints P110 Premium      │                  │
│  │     [✓ Approve] [✗ Reject]       │                  │
│  │  ─────────────────────────       │                  │
│  │  📦 Storage Summary              │                  │
│  │     Yard A-North: Racks 1-2      │                  │
│  │     In Storage: 120 joints       │                  │
│  │     Pending Delivery: 120 joints │                  │
│  └──────────────────────────────────┘                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Tile Components**:

1. **Company Header Section**
   - Company name (large, prominent)
   - Quick stats: Active requests, total inventory, pending approvals
   - Expand/collapse toggle for detail view

2. **Request Cards (nested within company tile)**
   - Each request displayed as mini-card
   - Reference ID + status badge
   - Key specs (joints, grade, connection)
   - Inline approval actions
   - Logistics summary (inbound/outbound loads)
   - Document count indicator

3. **Storage Summary Section**
   - Current inventory breakdown by location
   - Rack assignments
   - Storage duration metrics

4. **Quick Actions Section**
   - Add new request for this company
   - View all documents
   - Contact customer
   - View full history

### 2.2 Information Architecture

**Old Model** (Tab-Based):
```
Dashboard
├── Overview (system-wide stats)
├── Approvals (all pending requests)
├── Requests (all requests, filterable)
├── Companies (company list)
├── Inventory (all inventory, paginated)
├── Storage (rack/yard management)
├── Shipments (trucking loads)
└── AI (assistant)
```

**New Model** (Company-Centric):
```
Dashboard
├── Company Tiles (primary view)
│   └── For each company:
│       ├── Request cards (with inline approvals)
│       ├── Inventory summary
│       ├── Active loads (inbound/outbound)
│       └── Storage locations
├── System Overview (separate page/modal)
│   ├── Capacity metrics
│   ├── Today's schedule
│   └── Recent activity
├── Storage Management (separate page/modal)
│   ├── Yard/rack capacity
│   └── Location optimization
└── AI Assistant (persistent sidebar or modal)
```

**Navigation Strategy**:
- Default view: Company tiles (horizontal scroll)
- Top bar: Filters (company, status, date range) + Search
- Side drawer/modal: System overview, storage management
- Floating button: AI Assistant
- Each company tile: Clickable to expand full-page detail view

### 2.3 Data Fetching Strategy

**Current Approach** (loads everything):
```typescript
// All data passed as props to AdminDashboard
requests: StorageRequest[]
companies: Company[]
yards: Yard[]
inventory: Pipe[]
truckLoads: TruckLoad[]
shipments: Shipment[]
```

**Proposed Approach** (company-scoped queries):

```typescript
// Main view: Fetch companies with aggregated stats
useCompaniesWithStats() → {
  id, name,
  activeRequestCount,
  totalInventoryJoints,
  pendingApprovals
}

// Per-tile: Lazy load on scroll into view
useCompanyDetails(companyId) → {
  requests: { /* full request data */ },
  inventory: { /* summarized */ },
  loads: { /* recent loads */ }
}

// Detail view: Full data fetch
useCompanyFullData(companyId) → {
  /* everything for this company */
}
```

**Benefits**:
- Initial page load only fetches company summary cards
- Tiles load details on-demand (IntersectionObserver)
- Detail view fetches comprehensive data only when needed
- React Query caching prevents redundant fetches

### 2.4 Component Breakdown

**New Component Structure**:

```
app/admin/
└── page.tsx (route handler)

components/admin/
├── AdminDashboard.tsx (container - redesigned)
├── AdminHeader.tsx (existing, minor updates)
├── CompanyTileCarousel.tsx (NEW)
│   └── CompanyTile.tsx (NEW)
│       ├── CompanyHeader.tsx (NEW)
│       ├── RequestCard.tsx (NEW)
│       │   └── ApprovalActions.tsx (NEW)
│       ├── StorageSummary.tsx (NEW)
│       └── QuickActions.tsx (NEW)
├── SystemOverviewPanel.tsx (NEW - replaces Overview tab)
├── StorageManagementPanel.tsx (NEW - replaces Storage tab)
├── CompanyDetailView.tsx (NEW - full-page detail)
├── AdminAIAssistant.tsx (existing, move to sidebar)
└── [existing components for modals/dialogs]
```

**Component Responsibilities**:

1. **AdminDashboard.tsx** (Redesigned)
   - Top-level container
   - Manages view state (tiles vs detail vs system)
   - Provides data context via React Query
   - Handles real-time subscriptions

2. **CompanyTileCarousel.tsx**
   - Horizontal scroll container
   - Manages scroll state and navigation
   - Implements intersection observer for lazy loading
   - Responsive layout (1 tile mobile, 1.5 tiles tablet, 2 tiles desktop)

3. **CompanyTile.tsx**
   - Individual company tile (480px height, 600px width)
   - Fetches company-scoped data
   - Expand/collapse logic
   - Click handler for detail view

4. **RequestCard.tsx**
   - Mini-card within company tile
   - Displays single request with key info
   - Inline approval workflow
   - Status-based styling

5. **ApprovalActions.tsx**
   - Approve/Reject buttons with rack assignment
   - Modal for approval details (rack selection, notes)
   - Optimistic updates with React Query

6. **CompanyDetailView.tsx**
   - Full-page view (replaces tile on click)
   - Tabbed interface within company context
   - All requests, full inventory, all loads, documents
   - Back button returns to tile view

### 2.5 Workflow Integration

**Approval Workflow** (Inline):
```
1. Admin views company tile
2. Sees "Pending Approval" request card
3. Clicks [Approve] button on card
4. Modal opens:
   - Auto-suggests racks based on capacity
   - Shows quantity confirmation
   - Notes field (optional)
5. Confirms approval
6. Request card updates to "Approved" badge
7. Storage summary section updates with new inventory
8. Notification sent to customer
```

**Document Viewing** (Integrated):
```
1. Request card shows document count badge: "📄 3 docs"
2. Click badge → Document viewer modal
3. Displays trucking documents with AI-parsed manifest
4. Uses existing ManifestDataDisplay component
5. Close returns to tile view
```

**Inventory Management** (Summary + Detail):
```
Tile View:
- Storage Summary shows: "Yard A-North: 120 joints (Racks 1-2)"
- Click → Opens CompanyDetailView with Inventory tab active

Detail View:
- Full inventory table (paginated)
- Filter by status, location, date
- Edit/move capabilities
- Export options
```

### 2.6 Mobile Responsiveness

**Breakpoint Strategy**:
```css
Mobile (< 640px):
- Stack tiles vertically (no carousel)
- Full-width tiles
- Compressed request cards
- Bottom sheet for modals

Tablet (640px - 1024px):
- Horizontal carousel, 1 tile visible + 50% of next
- Touch-friendly scroll
- Modal overlays

Desktop (> 1024px):
- Horizontal carousel, 1.5-2 tiles visible
- Mouse wheel horizontal scroll
- Prev/Next buttons
- Hover states
```

**Touch Interactions**:
- Swipe to scroll carousel
- Tap to expand company tile
- Pull-to-refresh for data updates
- Long-press for quick actions menu

---

## Phase 3: Agent Assignment

### 3.1 UI/UX Agent Tasks

**Primary Responsibility**: Visual design and component architecture

**Assigned Tasks**:
1. Design CompanyTile component with gradient/glow styling matching customer tiles
2. Create RequestCard mini-component with status badge variants
3. Implement responsive carousel with scroll animations
4. Design ApprovalActions inline workflow (modal vs. inline decision)
5. Create hover states and loading skeletons
6. Accessibility audit (keyboard navigation, ARIA labels, screen reader support)
7. Mobile touch gesture implementation
8. Design SystemOverviewPanel and StorageManagementPanel layouts

**Deliverables**:
- Component mockups (text-based wireframes)
- Tailwind CSS class specifications
- Animation/transition specs
- Accessibility checklist
- Mobile interaction patterns

**Timeline**: 2 weeks

**Dependencies**: None (can start immediately)

---

### 3.2 Customer Journey Agent Tasks

**Primary Responsibility**: Ensure admin workflows don't disrupt customer experience

**Assigned Tasks**:
1. Verify that admin approval triggers correct customer notifications
2. Ensure admin actions (approve/reject/update) maintain customer workflow integrity
3. Test that admin-initiated trucking schedule changes sync to customer view
4. Validate that document uploads by admin are visible to customers
5. Review admin→customer communication touchpoints

**Deliverables**:
- Workflow validation report
- Integration test scenarios
- Customer notification verification
- Edge case documentation

**Timeline**: 1 week (after UI components defined)

**Dependencies**: UI/UX Agent (component structure)

---

### 3.3 Admin Operations Agent Tasks

**Primary Responsibility**: Admin workflow logic and approval processes

**Assigned Tasks**:
1. Refactor approval workflow for inline execution (within tile, not separate tab)
2. Design company detail view navigation (tabs within company context)
3. Implement request filtering by company scope
4. Create bulk approval workflow (multi-select requests)
5. Design admin notification system for new requests (toast vs. badge)
6. Integrate AdminAIAssistant into new layout (sidebar vs. modal)
7. Define admin permission boundaries for tile actions

**Deliverables**:
- Approval workflow logic (with rack assignment)
- Bulk operations spec
- Admin notification strategy
- AI Assistant integration plan
- Permission/role matrix

**Timeline**: 2 weeks

**Dependencies**: UI/UX Agent (approval modal design), Database Integrity Agent (query patterns)

---

### 3.4 Inventory Management Agent Tasks

**Primary Responsibility**: Inventory display and tracking within tiles

**Assigned Tasks**:
1. Design inventory summary component for tile view (high-level stats)
2. Create company-scoped inventory queries (by company_id)
3. Implement rack assignment visualization within tile
4. Design inventory detail view (full table in CompanyDetailView)
5. Calculate storage metrics (duration, capacity %, utilization)
6. Implement inventory status updates (pending → in_storage → picked_up)

**Deliverables**:
- StorageSummary component spec
- Inventory query optimization
- Rack capacity calculation logic
- Inventory detail view design
- Storage metrics formulas

**Timeline**: 1.5 weeks

**Dependencies**: Database Integrity Agent (schema queries), UI/UX Agent (component design)

---

### 3.5 AI Services Agent Tasks

**Primary Responsibility**: AI Assistant integration and manifest display

**Assigned Tasks**:
1. Adapt AdminAIAssistant for sidebar/modal placement
2. Enable company-scoped AI queries ("Show me all L80 casing for Summit Drilling")
3. Integrate ManifestDataDisplay into document viewer within tiles
4. Enhance AI to suggest rack assignments during approval
5. Add AI-powered capacity planning ("Can we fit 200 joints for Company X?")

**Deliverables**:
- AdminAIAssistant redesign for new layout
- Company-scoped query capabilities
- Rack suggestion algorithm
- Capacity planning AI prompts
- Manifest display integration

**Timeline**: 1 week

**Dependencies**: Admin Operations Agent (AI Assistant placement decision)

---

### 3.6 Database Integrity Agent Tasks

**Primary Responsibility**: Query optimization and data fetching patterns

**Assigned Tasks**:
1. Design company-aggregated stats query (for tile summaries)
2. Create company-scoped detail query (requests + loads + inventory)
3. Optimize nested joins for single-query tile data fetch
4. Implement pagination for inventory within company context
5. Design indexes for company_id lookups (if not already indexed)
6. Create RLS policies for admin-scoped data access
7. Implement real-time subscription for company-scoped updates

**Deliverables**:
- SQL query library for new data patterns
- Index recommendations
- RLS policy updates
- React Query hook specifications
- Real-time subscription setup
- Performance benchmarks

**Timeline**: 1.5 weeks

**Dependencies**: None (can start immediately)

---

### 3.7 Integration & Events Agent Tasks

**Primary Responsibility**: Slack notifications and external integrations

**Assigned Tasks**:
1. Update Slack notification payload for company-centric context
2. Ensure admin approval actions trigger customer email notifications
3. Verify calendar sync for trucking loads scheduled from tile view
4. Test Supabase Realtime triggers for tile auto-updates

**Deliverables**:
- Updated Slack notification format
- Email trigger verification
- Calendar sync testing report
- Realtime update integration

**Timeline**: 3 days

**Dependencies**: Admin Operations Agent (approval workflow), Database Integrity Agent (triggers)

---

### 3.8 Deployment & DevOps Agent Tasks

**Primary Responsibility**: Build, deployment, and rollback strategy

**Assigned Tasks**:
1. Create feature flag for tile-based view (enable gradual rollout)
2. Set up A/B test infrastructure (tile view vs. tab view)
3. Monitor bundle size impact of new components
4. Plan staged deployment (dev → staging → production)
5. Create rollback procedure (revert to tab-based view)
6. Set up performance monitoring (page load time, tile render time)

**Deliverables**:
- Feature flag implementation
- A/B test configuration
- Bundle size analysis
- Deployment runbook
- Rollback procedure
- Performance dashboard

**Timeline**: 4 days

**Dependencies**: UI/UX Agent (components built), QA Agent (testing complete)

---

### 3.9 Security & Quality Agent Tasks

**Primary Responsibility**: Security audit and code quality

**Assigned Tasks**:
1. Audit inline approval workflow for authorization checks
2. Verify that company tiles only display data for authorized admin
3. Review RLS policies for company-scoped queries
4. Code review for new components (TypeScript strict mode)
5. Security scan for XSS vulnerabilities in dynamic tile content
6. Performance audit (tile render time, scroll performance)

**Deliverables**:
- Security audit report
- Authorization verification checklist
- Code review feedback
- TypeScript compliance report
- Performance audit results

**Timeline**: 4 days

**Dependencies**: All component development complete

---

### 3.10 QA & Testing Agent Tasks

**Primary Responsibility**: Testing strategy and execution

**Assigned Tasks**:
1. Create test plan for company tile carousel (scroll, lazy load, navigation)
2. Write integration tests for inline approval workflow
3. Test company detail view navigation (back button, deep linking)
4. Mobile testing (responsive layout, touch gestures)
5. Cross-browser testing (Chrome, Firefox, Safari, Edge)
6. Accessibility testing (keyboard nav, screen readers)
7. Performance testing (4 companies, 100 companies, 1000 companies)
8. Data edge case testing (company with 0 requests, 100 requests)

**Deliverables**:
- Test plan document
- Integration test suite
- Mobile test report
- Browser compatibility matrix
- Accessibility audit results
- Performance test results
- Edge case documentation

**Timeline**: 1.5 weeks

**Dependencies**: All components built, deployed to staging

---

### 3.11 Knowledge Management Agent Tasks

**Primary Responsibility**: Documentation and training materials

**Assigned Tasks**:
1. Update admin user documentation for new tile-based interface
2. Create admin onboarding guide (how to use company tiles)
3. Document approval workflow changes
4. Update API documentation for new query patterns
5. Create changelog entry for redesign
6. Write migration guide (tab-based → tile-based)
7. Update TECHNICAL_ARCHITECTURE.md with new component structure

**Deliverables**:
- Admin user guide
- Onboarding tutorial (with screenshots/diagrams)
- API documentation updates
- CHANGELOG.md entry
- Migration guide
- Architecture documentation update

**Timeline**: 1 week

**Dependencies**: All components built, QA testing complete

---

## Phase 4: Architecture Decisions

### ADR-001: Company-Centric Tile Layout

**Date**: 2025-11-07
**Status**: Proposed
**Deciders**: Orchestration Agent, UI/UX Agent, Admin Operations Agent

**Context**:
The current admin dashboard uses a tab-based interface organized by data type (Requests, Inventory, Shipments). Users requested a tile-based interface organized by company, similar to the customer dashboard. This requires a fundamental reorganization of the information architecture.

**Decision**:
We will implement a company-centric tile-based layout as the primary admin dashboard view.

**Rationale**:
1. **User Mental Model**: Admins think in terms of companies/customers, not data types
2. **Workflow Efficiency**: All relevant data for a company is visible in one place
3. **Consistency**: Matches successful customer dashboard UX patterns
4. **Scalability**: Horizontal scroll + lazy loading handles many companies efficiently
5. **Context Preservation**: Reduces tab-switching and context loss

**Consequences**:

**Positive**:
- Reduced cognitive load (all company data in one view)
- Faster approvals (inline workflow vs. navigating to separate tab)
- Better mobile UX (scrollable tiles vs. complex tabs)
- Improved visual hierarchy (status badges, cards, metrics)
- Consistent brand experience (customer + admin use similar patterns)

**Negative**:
- Requires significant refactoring of AdminDashboard component
- Initial learning curve for admins accustomed to tab-based layout
- More complex state management (per-tile data loading)
- Risk of information overload if tiles are too dense
- Potential performance issues with many companies (mitigated by lazy loading)

**Alternatives Considered**:

1. **Keep tab-based layout, add tile view as separate tab**
   - Pros: No disruption, easier to implement
   - Cons: Doesn't solve core UX problem, adds complexity
   - Rejected: Doesn't achieve user goals

2. **Hybrid approach: Tabs within company tiles**
   - Pros: Combines both paradigms
   - Cons: Confusing navigation, inconsistent with customer dashboard
   - Rejected: Overly complex

3. **List-based company view (not tiles)**
   - Pros: More compact, shows more companies at once
   - Cons: Doesn't match customer dashboard, less visual impact
   - Rejected: Doesn't meet user request for tile-based interface

**Implementation**:
- UI/UX Agent: Design tile components
- Admin Operations Agent: Refactor approval workflows
- Database Integrity Agent: Optimize company-scoped queries
- Timeline: 4 weeks for full implementation

---

### ADR-002: React Query for Data Fetching

**Date**: 2025-11-07
**Status**: Accepted
**Deciders**: Orchestration Agent, Database Integrity Agent

**Context**:
The new tile-based interface requires efficient data fetching with lazy loading, caching, and optimistic updates. Current approach passes all data as props from parent container.

**Decision**:
We will use TanStack React Query (already in use) with company-scoped queries and lazy loading.

**Rationale**:
1. **Already Integrated**: React Query v5.20 is already in the project
2. **Lazy Loading**: IntersectionObserver triggers query only when tile scrolls into view
3. **Caching**: Prevents redundant fetches when user returns to a company tile
4. **Optimistic Updates**: Approval actions update UI immediately, sync in background
5. **Real-time**: Integrates with Supabase Realtime subscriptions

**Query Strategy**:
```typescript
// Summary query (all companies)
useCompaniesWithStats() → lightweight aggregates

// Detail query (per company, lazy loaded)
useCompanyDetails(companyId, { enabled: isInView })

// Full data (detail view only)
useCompanyFullData(companyId, { enabled: isDetailView })
```

**Consequences**:

**Positive**:
- Excellent developer experience (hooks-based API)
- Built-in loading/error states
- Automatic refetching on window focus
- Query invalidation on mutations
- DevTools for debugging

**Negative**:
- Adds ~13KB to bundle (already included, so no new cost)
- Learning curve for developers unfamiliar with React Query
- Complex invalidation logic for related queries

**Alternatives Considered**:

1. **SWR (Vercel's data fetching library)**
   - Pros: Smaller bundle size, simpler API
   - Cons: Less feature-rich, not currently in project
   - Rejected: React Query already integrated

2. **Redux Toolkit Query**
   - Pros: Integrates with Redux if we add state management
   - Cons: Requires Redux setup (currently don't use Redux)
   - Rejected: Overkill for current needs

3. **Custom fetch hooks with useEffect**
   - Pros: No dependencies, full control
   - Cons: Reinventing the wheel, error-prone
   - Rejected: React Query is better tested

**Implementation**:
- Database Integrity Agent: Define query schemas
- UI/UX Agent: Integrate lazy loading with IntersectionObserver
- Timeline: 1 week

---

### ADR-003: Inline Approval vs. Modal Workflow

**Date**: 2025-11-07
**Status**: Proposed
**Deciders**: Orchestration Agent, UI/UX Agent, Admin Operations Agent

**Context**:
Approval workflow currently navigates to separate tab. New design requires approvals within company tile context. Decision: inline form or modal dialog?

**Decision**:
We will use a **modal dialog** for approval workflow, triggered from inline button on request card.

**Rationale**:
1. **Complexity**: Approval requires rack selection (112 racks), joint count confirmation, notes
2. **Focus**: Modal provides dedicated focus area without cluttering tile
3. **Validation**: Modal can show errors and warnings before submission
4. **Consistency**: Other complex actions (document viewer) also use modals
5. **Mobile UX**: Modal provides better mobile experience than inline form

**Modal Design**:
```
┌───────────────────────────────────────┐
│ Approve Request: AFE-158970-1         │
├───────────────────────────────────────┤
│                                        │
│ Customer: Summit Drilling              │
│ Pipe: 120 joints L80 BTC, 9.625"      │
│                                        │
│ Assign Storage Location:              │
│ [Dropdown: Yard A - North]            │
│                                        │
│ Assign Racks:                          │
│ [Multi-select: Rack 1, Rack 2]        │
│ Capacity: 60 joints/rack (30% each)   │
│                                        │
│ Joints to Store: [120] ✓              │
│                                        │
│ Internal Notes (optional):            │
│ [Text area]                            │
│                                        │
│ [Cancel]  [✓ Approve & Notify]        │
└───────────────────────────────────────┘
```

**Consequences**:

**Positive**:
- Clean tile interface (no inline forms)
- Focused approval experience
- Room for AI suggestions (rack recommendations)
- Easy to add validation and warnings
- Works well on mobile

**Negative**:
- Requires modal overlay state management
- One extra click (button → modal → approve)
- Modal can obscure tile context

**Alternatives Considered**:

1. **Inline expansion within tile**
   - Pros: No modal, single view
   - Cons: Tiles become very tall, complex layout
   - Rejected: Clutters tile interface

2. **Slide-out panel from right**
   - Pros: Keeps tile visible, modern pattern
   - Cons: Complex for mobile, requires more state management
   - Rejected: Doesn't match existing UI patterns

3. **Navigate to full-page approval form**
   - Pros: Maximum space for complex form
   - Cons: Loses context, multiple clicks to return
   - Rejected: Poor UX for quick approvals

**Implementation**:
- UI/UX Agent: Design modal component
- Admin Operations Agent: Implement approval logic
- AI Services Agent: Add rack suggestion feature
- Timeline: 1 week

---

### ADR-004: Mobile Responsiveness Strategy

**Date**: 2025-11-07
**Status**: Proposed
**Deciders**: Orchestration Agent, UI/UX Agent

**Context**:
Admin dashboard must work on tablets and potentially mobile phones. Current tab-based layout is difficult to use on small screens.

**Decision**:
We will implement a **mobile-first responsive design** with three breakpoints:

1. **Mobile (< 640px)**: Vertical stack, full-width tiles, no carousel
2. **Tablet (640px - 1024px)**: Horizontal carousel, 1 tile + 50% next tile
3. **Desktop (> 1024px)**: Horizontal carousel, 1.5-2 tiles visible

**Mobile-Specific Adaptations**:
- Touch-friendly targets (44px minimum)
- Swipe gestures for carousel navigation
- Bottom sheet modals (instead of center overlays)
- Compressed request cards (fewer details, expandable)
- Pull-to-refresh for data updates
- Fixed header with hide-on-scroll behavior

**Consequences**:

**Positive**:
- Admins can perform tasks from tablets in yard
- Consistent experience across devices
- Better touch UX than current tab-based design
- Progressive enhancement (works on all screen sizes)

**Negative**:
- More CSS complexity (media queries, flex/grid variations)
- Testing burden (multiple device types)
- Potential performance issues on older mobile devices
- Some features may need simplification for mobile

**Alternatives Considered**:

1. **Desktop-only, no mobile support**
   - Pros: Simpler development
   - Cons: Misses opportunity for field use
   - Rejected: Tablets are common in warehouse/yard environments

2. **Separate mobile app**
   - Pros: Optimized native experience
   - Cons: Additional codebase to maintain
   - Rejected: Overkill, responsive web is sufficient

3. **Tablet-only responsive (640px+), redirect mobile to desktop view**
   - Pros: Fewer breakpoints to support
   - Cons: Poor UX on phones
   - Rejected: Modern web should support all screen sizes

**Implementation**:
- UI/UX Agent: Design responsive layouts and breakpoints
- QA Agent: Mobile testing plan
- Timeline: Integrated into component development (no separate phase)

---

## Phase 5: Implementation Plan

### 5.1 Development Phases

**PHASE 1: Foundation (Weeks 1-2)**
- Database Integrity Agent: Design and test company-scoped queries
- UI/UX Agent: Design CompanyTile and RequestCard components
- Admin Operations Agent: Plan approval workflow refactor
- Deliverables: Query library, component designs, workflow specs

**PHASE 2: Core Components (Weeks 3-4)**
- UI/UX Agent: Build CompanyTileCarousel, CompanyTile, RequestCard
- Admin Operations Agent: Build ApprovalActions modal
- Inventory Agent: Build StorageSummary component
- Deliverables: Functional tile carousel with mock data

**PHASE 3: Data Integration (Weeks 5-6)**
- Database Integrity Agent: Integrate React Query hooks
- Admin Operations Agent: Connect approval workflow to Supabase
- Inventory Agent: Connect inventory display to live data
- AI Services Agent: Adapt AdminAIAssistant for new layout
- Deliverables: Fully functional tiles with live data

**PHASE 4: Detail Views & Polish (Weeks 7-8)**
- UI/UX Agent: Build CompanyDetailView, SystemOverviewPanel
- Admin Operations Agent: Build bulk operations
- Integration Agent: Update notifications (Slack, email)
- Deliverables: Complete feature set matching old dashboard

**PHASE 5: Testing & Deployment (Weeks 9-10)**
- QA Agent: Execute test plan (integration, mobile, accessibility)
- Security Agent: Security audit and code review
- DevOps Agent: Deploy to staging, set up feature flags
- Knowledge Management Agent: Write documentation
- Deliverables: Production-ready build, documentation, training

### 5.2 File Structure

```
components/admin/
├── AdminDashboard.tsx (REDESIGNED - container)
├── AdminHeader.tsx (MINOR UPDATES - add filters)
├── AdminAIAssistant.tsx (RELOCATED - sidebar version)
│
├── tiles/ (NEW DIRECTORY)
│   ├── CompanyTileCarousel.tsx (NEW)
│   ├── CompanyTile.tsx (NEW)
│   ├── CompanyHeader.tsx (NEW)
│   ├── RequestCard.tsx (NEW)
│   ├── StorageSummary.tsx (NEW)
│   └── QuickActions.tsx (NEW)
│
├── modals/ (NEW DIRECTORY)
│   ├── ApprovalModal.tsx (NEW)
│   ├── RackSelectionModal.tsx (NEW)
│   ├── DocumentViewerModal.tsx (REFACTORED - from inline)
│   └── CompanyDetailView.tsx (NEW - could be modal or page)
│
├── panels/ (NEW DIRECTORY)
│   ├── SystemOverviewPanel.tsx (NEW - replaces Overview tab)
│   └── StorageManagementPanel.tsx (NEW - replaces Storage tab)
│
└── [existing components]
    ├── TruckReceiving.tsx (NO CHANGES)
    ├── TruckLoadHistory.tsx (NO CHANGES)
    └── ManifestDataDisplay.tsx (NO CHANGES - reused in modals)

hooks/
├── useCompaniesWithStats.ts (NEW)
├── useCompanyDetails.ts (NEW)
├── useCompanyFullData.ts (NEW)
├── useApproveRequest.ts (NEW)
└── [existing hooks]

utils/admin/
├── tileHelpers.ts (NEW - tile calculations, scroll logic)
├── approvalHelpers.ts (NEW - rack suggestions, validation)
└── [existing utils]
```

### 5.3 API Changes

**New Supabase Queries**:

```sql
-- Company summary stats (for tile headers)
SELECT
  c.id,
  c.name,
  COUNT(DISTINCT sr.id) FILTER (WHERE sr.status = 'PENDING') as pending_approvals,
  COUNT(DISTINCT sr.id) FILTER (WHERE sr.status IN ('APPROVED', 'COMPLETED')) as active_requests,
  COALESCE(SUM(i.quantity), 0) as total_inventory_joints
FROM companies c
LEFT JOIN storage_requests sr ON sr.company_id = c.id AND sr.archived_at IS NULL
LEFT JOIN inventory i ON i.company_id = c.id AND i.status = 'IN_STORAGE'
GROUP BY c.id, c.name
ORDER BY pending_approvals DESC, c.name ASC;

-- Company detail data (for expanded tile)
SELECT
  c.*,
  json_agg(DISTINCT jsonb_build_object(
    'id', sr.id,
    'referenceId', sr.reference_id,
    'status', sr.status,
    'requestDetails', sr.request_details,
    'assignedLocation', sr.assigned_location,
    'createdAt', sr.created_at,
    'truckingLoads', (
      SELECT json_agg(jsonb_build_object(
        'id', tl.id,
        'direction', tl.direction,
        'status', tl.status,
        'sequenceNumber', tl.sequence_number,
        'documentCount', (SELECT COUNT(*) FROM trucking_documents WHERE trucking_load_id = tl.id)
      ))
      FROM trucking_loads tl
      WHERE tl.storage_request_id = sr.id
    )
  )) FILTER (WHERE sr.id IS NOT NULL) as requests,
  json_agg(DISTINCT jsonb_build_object(
    'location', i.storage_area_id,
    'quantity', SUM(i.quantity),
    'status', i.status
  )) FILTER (WHERE i.id IS NOT NULL) as inventory_summary
FROM companies c
LEFT JOIN storage_requests sr ON sr.company_id = c.id AND sr.archived_at IS NULL
LEFT JOIN inventory i ON i.company_id = c.id
WHERE c.id = $1
GROUP BY c.id;
```

**React Query Hooks**:

```typescript
// hooks/useCompaniesWithStats.ts
export function useCompaniesWithStats() {
  return useQuery({
    queryKey: ['companies', 'with-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_companies_with_stats');
      if (error) throw error;
      return data as CompanyWithStats[];
    },
    staleTime: 30000, // 30 seconds
  });
}

// hooks/useCompanyDetails.ts
export function useCompanyDetails(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ['company', companyId, 'details'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          *,
          storage_requests!inner (
            *,
            trucking_loads (
              *,
              documents:trucking_documents(*)
            )
          ),
          inventory (*)
        `)
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data as CompanyDetails;
    },
    enabled,
    staleTime: 60000, // 1 minute
  });
}

// hooks/useApproveRequest.ts
export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ApprovalParams) => {
      const { data, error } = await supabase.rpc('approve_storage_request', {
        request_id: params.requestId,
        rack_ids: params.rackIds,
        required_joints: params.joints,
        notes: params.notes,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company', variables.companyId] });
    },
  });
}
```

### 5.4 Testing Strategy

**Unit Tests** (Jest + React Testing Library):
- CompanyTile rendering with mock data
- RequestCard status badge variants
- ApprovalModal form validation
- StorageSummary calculations
- Query hook mocking

**Integration Tests** (Playwright/Cypress):
- Complete approval workflow (button → modal → submit → success)
- Tile carousel navigation (scroll, prev/next buttons)
- Lazy loading (IntersectionObserver triggers queries)
- Detail view navigation (tile → detail → back)
- Real-time updates (Supabase subscription updates tile)

**E2E Tests**:
- Admin logs in → views company tiles → approves request → verifies customer receives email
- Admin scrolls to company → views inventory → updates rack assignment
- Admin uses AI Assistant → asks company-specific query → receives filtered results

**Performance Tests**:
- Page load time with 10 companies (target: < 2 seconds)
- Tile render time (target: < 100ms per tile)
- Scroll performance (target: 60fps)
- Query response time (target: < 500ms)

**Accessibility Tests**:
- Keyboard navigation (tab through tiles, enter to open detail)
- Screen reader support (ARIA labels, semantic HTML)
- Color contrast (WCAG AA compliance)
- Focus management (modals trap focus)

**Browser/Device Matrix**:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- iOS Safari (iPad)
- Android Chrome (tablet)

### 5.5 Rollback Plan

**Feature Flag Implementation**:
```typescript
// lib/features.ts
export const FEATURES = {
  TILE_BASED_ADMIN: process.env.NEXT_PUBLIC_ENABLE_TILE_ADMIN === 'true',
};

// components/admin/AdminDashboard.tsx
export function AdminDashboard(props: AdminDashboardProps) {
  if (FEATURES.TILE_BASED_ADMIN) {
    return <TileBasedAdminDashboard {...props} />;
  }
  return <TabBasedAdminDashboard {...props} />; // old version
}
```

**Deployment Steps**:
1. Deploy to staging with feature flag OFF → test old interface still works
2. Enable feature flag on staging → test new tile interface
3. Deploy to production with feature flag OFF
4. Gradual rollout: Enable for 10% of admin users (A/B test)
5. Monitor metrics (page load time, error rate, user feedback)
6. If successful: Enable for 100%
7. If issues: Disable feature flag, debug, redeploy

**Rollback Trigger Conditions**:
- Page load time increases > 50%
- Error rate increases > 5%
- Critical functionality broken (can't approve requests)
- User feedback overwhelmingly negative (> 30% complaints)

**Rollback Procedure** (< 5 minutes):
1. Set environment variable: `NEXT_PUBLIC_ENABLE_TILE_ADMIN=false`
2. Redeploy (or use instant env var update if supported)
3. Verify old interface is active
4. Investigate issues in staging
5. Fix and redeploy when ready

---

## Risk Assessment & Mitigation

### Risk 1: Performance Degradation
**Severity**: High
**Probability**: Medium
**Impact**: Slow page loads, poor scroll performance

**Mitigation**:
- Lazy load tile data (IntersectionObserver)
- Implement query pagination for companies
- Use React.memo for tile components
- Monitor bundle size (code splitting if needed)
- Performance testing with 100+ companies in staging

---

### Risk 2: Data Fetching Complexity
**Severity**: Medium
**Probability**: Medium
**Impact**: Incorrect data display, stale caches

**Mitigation**:
- Comprehensive React Query invalidation strategy
- Real-time subscriptions for critical updates
- Cache time tuning based on data volatility
- Fallback to polling if real-time fails
- Extensive integration testing

---

### Risk 3: Admin User Resistance
**Severity**: Medium
**Probability**: Medium
**Impact**: Users prefer old interface, request rollback

**Mitigation**:
- Feature flag allows instant rollback
- Gradual rollout (10% → 50% → 100%)
- User training materials before launch
- Feedback mechanism (in-app survey)
- Keep old interface as fallback option for 1 month

---

### Risk 4: Mobile UX Issues
**Severity**: Low
**Probability**: Medium
**Impact**: Poor experience on tablets/phones

**Mitigation**:
- Mobile-first design approach
- Extensive mobile testing (real devices, not just emulators)
- Touch gesture refinement based on QA feedback
- Progressive enhancement (graceful degradation if features fail)

---

### Risk 5: Scope Creep
**Severity**: Medium
**Probability**: High
**Impact**: Timeline extends beyond 10 weeks

**Mitigation**:
- Strict MVP definition (feature parity with old dashboard)
- Defer enhancements to Phase 2 (post-launch iteration)
- Weekly progress reviews with clear milestones
- Time-box each agent's work (hard deadlines)

---

## Success Metrics

### Quantitative Metrics

**Performance**:
- Page load time: < 2 seconds (target), < 3 seconds (acceptable)
- Tile render time: < 100ms per tile
- Time to first contentful paint: < 1 second
- Scroll FPS: 60fps (smooth)

**Efficiency**:
- Time to approve request: < 30 seconds (vs. current ~2 minutes)
- Clicks to view company data: 1 (tile) vs. 3+ (tabs)
- Data staleness: < 30 seconds with real-time updates

**Adoption**:
- % of admins using tile view (after rollout): > 80%
- Feature flag rollback rate: < 5%
- User preference (survey): > 70% prefer tile view

### Qualitative Metrics

**User Feedback**:
- Post-launch survey: "Easier to use than old dashboard" (agree/strongly agree)
- Support tickets: No increase in "how do I..." questions
- Admin testimonials: Positive feedback on efficiency gains

**Functionality**:
- Zero regression bugs (all old features work in new interface)
- No critical bugs in first week post-launch
- All accessibility standards met (WCAG AA)

---

## Timeline Summary

**Total Duration**: 10 weeks

**Week 1-2**: Foundation (queries, component design, planning)
**Week 3-4**: Core component development
**Week 5-6**: Data integration and approval workflow
**Week 7-8**: Detail views, polish, secondary features
**Week 9-10**: Testing, documentation, deployment

**Key Milestones**:
- End of Week 2: Component designs approved, queries tested
- End of Week 4: Tile carousel functional with mock data
- End of Week 6: Approval workflow working end-to-end
- End of Week 8: Feature-complete, ready for QA
- End of Week 10: Deployed to production with feature flag

---

## Next Steps (Immediate Actions)

1. **Review & Approve This Plan** (Orchestration Agent + Stakeholders)
   - Review all ADRs
   - Approve agent assignments
   - Set final timeline

2. **Kickoff Meetings** (Week 1)
   - Database Integrity Agent: Query design session
   - UI/UX Agent: Component wireframing session
   - Admin Operations Agent: Workflow planning session

3. **Create GitHub Issues** (Week 1)
   - One issue per agent with clear deliverables
   - Label: `admin-redesign`, `P1-high-priority`
   - Assign to appropriate agent/developer

4. **Set Up Project Board** (Week 1)
   - Columns: Backlog, In Progress, Review, Done
   - Track agent progress weekly

5. **Schedule Weekly Standups** (Ongoing)
   - Every Monday: Progress review
   - Blockers, dependencies, timeline adjustments

---

## Appendix A: Component Specifications

### CompanyTile Component

**Props**:
```typescript
interface CompanyTileProps {
  companyId: string;
  isExpanded?: boolean;
  onExpand?: () => void;
  onViewDetail?: () => void;
}
```

**Data Requirements**:
- Company name
- Pending approval count
- Active request count
- Total inventory joints
- Recent requests (3-5 most recent)
- Storage summary (locations + quantities)

**Visual Specs**:
- Width: 600px (desktop), 100% (mobile)
- Height: 480px (fixed)
- Border radius: 16px
- Background: Gradient from gray-900 to gray-800
- Border: 1px gray-700/50
- Shadow: 2xl
- Glow effect: Based on urgency (red for pending approvals, blue for active, gray for none)

**States**:
- Default (collapsed)
- Expanded (shows more requests)
- Loading (skeleton)
- Error (retry button)

---

### RequestCard Component

**Props**:
```typescript
interface RequestCardProps {
  request: StorageRequest;
  compact?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onViewDocuments?: () => void;
}
```

**Visual Specs**:
- Background: gray-800/50
- Border radius: 8px
- Border: 1px gray-700/30
- Padding: 16px
- Status badge: Color-coded (pending=yellow, approved=green, rejected=red)

**Layout**:
```
┌────────────────────────────────────┐
│ [Status Badge]     [Doc Count: 3]  │
│ REF-2024-001                        │
│ 120 joints L80 BTC, 9.625"         │
│ Inbound: 1 load complete           │
│ [Approve] [Reject] [View Details]  │
└────────────────────────────────────┘
```

---

### ApprovalModal Component

**Props**:
```typescript
interface ApprovalModalProps {
  request: StorageRequest;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (params: ApprovalParams) => void;
}

interface ApprovalParams {
  rackIds: string[];
  joints: number;
  notes?: string;
}
```

**Features**:
- Rack multi-select with capacity preview
- Joint count validation
- AI-suggested racks (highlighted)
- Notes field (optional)
- Submit button with loading state

---

## Appendix B: Query Performance Benchmarks

**Target Response Times** (95th percentile):

| Query | Target | Acceptable |
|-------|--------|------------|
| Companies with stats | < 200ms | < 500ms |
| Company details (single) | < 300ms | < 800ms |
| Approve request mutation | < 500ms | < 1000ms |
| Real-time subscription latency | < 100ms | < 300ms |

**Optimization Strategies**:
- Index on `companies.id`, `storage_requests.company_id`, `inventory.company_id`
- Materialized view for company stats (refresh every 5 minutes)
- Query result caching with React Query (30s stale time)
- Connection pooling (Supabase default)

---

## Appendix C: Accessibility Checklist

**Keyboard Navigation**:
- [ ] Tab through company tiles
- [ ] Enter to open detail view
- [ ] Arrow keys to navigate carousel
- [ ] Escape to close modals
- [ ] Tab trap within modals

**Screen Reader Support**:
- [ ] ARIA labels on all interactive elements
- [ ] ARIA live regions for status updates
- [ ] Semantic HTML (header, main, section, article)
- [ ] Alt text for icons

**Visual Accessibility**:
- [ ] Color contrast ratio ≥ 4.5:1 for text
- [ ] Color contrast ratio ≥ 3:1 for UI components
- [ ] No reliance on color alone for information
- [ ] Focus indicators visible on all interactive elements

**Testing Tools**:
- axe DevTools
- WAVE browser extension
- NVDA screen reader
- VoiceOver (macOS/iOS)

---

**END OF STRATEGIC PLAN**

This plan will be reviewed and updated as implementation progresses. All architectural decisions will be documented as ADRs. Weekly progress reports will track agent deliverables and timeline adherence.
