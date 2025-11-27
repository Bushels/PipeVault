# PipeVault Navigation Mappings

**Last Updated:** 2025-11-19
**Maintainer:** Keep this document synchronized with route changes in [App.tsx](../../App.tsx)

> **Note:** This document maps the complete navigation flow for both Customer and Admin users. Update this file whenever you modify routing logic, add new pages, or change the navigation structure.

---

## 📊 Quick Reference

| User Type | Entry Point | Main Container | Default View |
|-----------|-------------|----------------|--------------|
| **Customer** | [Auth.tsx](../../components/Auth.tsx) | [Dashboard.tsx](../../components/Dashboard.tsx) | [StorageRequestMenu.tsx](../../components/StorageRequestMenu.tsx) |
| **Admin** | [Auth.tsx](../../components/Auth.tsx) | [AdminDashboard.tsx](../../components/admin/AdminDashboard.tsx) | Overview Tab |

**Route Decision Point:** [App.tsx:165](../../App.tsx#L165) - `if (isAdmin)` determines which dashboard to render

---

## 🔄 Customer Navigation Flow

```
┌─────────────────────────────────────────────────────┐
│                   Auth.tsx                          │
│         components/Auth.tsx:18-446                  │
│                                                     │
│  Customer Authentication Card:                      │
│  - Toggle: "Sign In" / "Create Account" (260-285)  │
│  - Email + Password fields                          │
│  - Sign Up Fields (shown when mode='signup'):       │
│    • Company Name (336-351)                         │
│    • First Name / Last Name (353-382)               │
│    • Contact Number (384-397)                       │
│  - Submit button (412-427)                          │
│  - "Why create an account?" callout (430-437)       │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓ Authenticated as Customer
                 │ (App.tsx:159-162 - renders when !user)
                 │
┌─────────────────────────────────────────────────────┐
│              App.tsx:163-223                        │
│      Creates Session & Routes to Dashboard          │
│                                                     │
│  Logic:                                             │
│  - Auto-create session from user (183-196)          │
│  - Match company by email domain (186)              │
│  - Filter requests by company/user (198-205)        │
│  - Pass data to Dashboard component (211-222)       │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│             Dashboard.tsx:28-222                    │
│         components/Dashboard.tsx                    │
│                                                     │
│  Main Container Component:                          │
│  - Header with logout (215)                         │
│  - Welcome message (191-211)                        │
│  - Content router via renderContent() (121-189)     │
│  - State: selectedOption (30)                       │
│    Values: 'menu' | 'new-storage' | 'delivery-in'  │
│            | 'delivery-out' | 'upload-docs'         │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓ Default: selectedOption = 'menu'
                 │
┌─────────────────────────────────────────────────────┐
│        StorageRequestMenu.tsx:25-86                 │
│      components/StorageRequestMenu.tsx              │
│                                                     │
│  Customer Landing Page:                             │
│  - "Request Storage" button (54-61)                 │
│  - RequestSummaryPanel with cards (64-74)           │
│  - FloatingRoughneckChat button (77-82)             │
└────────────────┬────────────────────────────────────┘
                 │
         ┌───────┴────────┬──────────────┬─────────────┐
         │                │              │             │
         ↓                ↓              ↓             ↓
    [new-storage]   [delivery-in]  [upload-docs]   [chat]
         │                │              │             │
         │                │              │             │
┌────────▼─────────┐ ┌───▼──────────┐ ┌─▼───────────┐ │
│ StorageRequest   │ │ InboundShip  │ │ Request     │ │
│ Wizard.tsx       │ │ mentWizard   │ │ Documents   │ │
│                  │ │ .tsx         │ │ Panel.tsx   │ │
│ Components/      │ │ Components/  │ │ Components/ │ │
│ StorageRequest   │ │ InboundShip  │ │ RequestDoc  │ │
│ Wizard.tsx       │ │ mentWizard   │ │ umentsPanel │ │
│                  │ │ .tsx         │ │ .tsx        │ │
│                  │ │              │ │             │ │
│ Dashboard.tsx    │ │ Dashboard.   │ │ Dashboard.  │ │
│ :131-146         │ │ tsx:148-155  │ │ tsx:163-169 │ │
│                  │ │              │ │             │ │
│ Features:        │ │ Features:    │ │ Features:   │ │
│ - Multi-step     │ │ - Schedule   │ │ - Upload    │ │
│   wizard         │ │   truck      │ │   manifests │ │
│ - Pipe specs     │ │   delivery   │ │ - AI vision │ │
│   input          │ │ - UWI &      │ │   extraction│ │
│ - FormHelper     │ │   delivery   │ │ - Document  │ │
│   chatbot        │ │   details    │ │   review    │ │
│   sidebar (143)  │ │ - Calendar   │ │             │ │
│                  │ │   integration│ │             │ │
└──────────────────┘ └──────────────┘ └─────────────┘ │
         │                │              │             │
         │                │              │             │
         └────────────────┴──────────────┘             │
                     │                                 │
                     ↓ "Back to Menu" button          │
         ┌───────────────────────┐                    │
         │ StorageRequestMenu    │                    │
         │ (selectedOption='menu')│                   │
         └───────────────────────┘                    │
                                                       │
┌──────────────────────────────────────────────────────▼┐
│          FloatingRoughneckChat.tsx                     │
│        components/FloatingRoughneckChat.tsx            │
│                                                        │
│  AI Assistant (Floating Button):                       │
│  - Always available on StorageRequestMenu              │
│  - Expands inline chat interface                       │
│  - Context: All company requests                       │
│  - Features: Weather integration, inventory Q&A        │
└────────────────────────────────────────────────────────┘
```

### Customer Route States

| State | Component | File Path | Triggered By |
|-------|-----------|-----------|--------------|
| `menu` | StorageRequestMenu | [StorageRequestMenu.tsx](../../components/StorageRequestMenu.tsx) | Default view |
| `new-storage` | StorageRequestWizard | [StorageRequestWizard.tsx](../../components/StorageRequestWizard.tsx) | "Request Storage" button |
| `delivery-in` | InboundShipmentWizard | [InboundShipmentWizard.tsx](../../components/InboundShipmentWizard.tsx) | "Schedule Delivery" on request card |
| `upload-docs` | RequestDocumentsPanel | [RequestDocumentsPanel.tsx](../../components/RequestDocumentsPanel.tsx) | "Upload Documents" on request card |

---

## 🔧 Admin Navigation Flow

```
┌─────────────────────────────────────────────────────┐
│                   Auth.tsx                          │
│         components/Auth.tsx:18-446                  │
│                                                     │
│  Admin Authentication Card:                         │
│  - Triggered by: Click PipeVault logo (163-169)     │
│  - State: showAdminLogin = true (180-253)           │
│  - Admin Email field (184-197)                      │
│  - Password field (199-212)                         │
│  - "Sign In" button (225-227)                       │
│  - "Create Admin Account" button (231-238)          │
│  - "Back to Customer Access" link (245-251)         │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓ Authenticated as Admin
                 │ (App.tsx:165-180 - if (isAdmin))
                 │
┌─────────────────────────────────────────────────────┐
│           AdminDashboard.tsx:90-2303                │
│      components/admin/AdminDashboard.tsx            │
│                                                     │
│  Main Admin Interface:                              │
│  - AdminHeader with logout (line ~2265)             │
│  - Global search bar (state: globalSearch)          │
│  - Tab navigation (state: activeTab)                │
│  - Content area (renders based on activeTab)        │
│                                                     │
│  State Management:                                  │
│  - activeTab: TabType (103) - Controls which view   │
│  - globalSearch: string (104) - Search filter       │
│  - requestFilter: RequestStatus (105) - Filter      │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓ Tab-based navigation
                 │
    ┌────────────┴────────────┬──────────────┐
    │                         │              │
    ↓                         ↓              ↓
[Primary Tabs]      [Logistics Tabs]    [Management]

┌─────────────────────────────────────────────────────┐
│ Tab Rendering Logic (Lines 2292-2303)               │
│                                                     │
│  {activeTab === 'overview' && renderOverview()}    │
│  {activeTab === 'approvals' && renderApprovals()}  │
│  {activeTab === 'pending-loads' && <PendingLoads/>}│
│  {activeTab === 'approved-loads' && <Approved...>} │
│  {activeTab === 'in-transit' && <InTransitTile/>}  │
│  {activeTab === 'outbound-loads' && <Outbound...>} │
│  {activeTab === 'requests' && renderRequests()}    │
│  {activeTab === 'companies' && renderCompanies()}  │
│  {activeTab === 'inventory' && renderInventory()}  │
│  {activeTab === 'storage' && renderStorage()}      │
│  {activeTab === 'shipments' && renderShipments()}  │
│  {activeTab === 'ai' && renderAI()}                │
└─────────────────────────────────────────────────────┘
```

### Admin Tabs Reference

| Tab ID | Component/Render | Purpose | Badge Count |
|--------|------------------|---------|-------------|
| `overview` | `renderOverview()` | Statistics tiles, company carousel, quick actions | - |
| `approvals` | `renderApprovals()` | Pending storage requests approval workflow | Pending requests |
| `pending-loads` | `<PendingLoadsTile />` | Trucking loads awaiting approval | `usePendingLoadsCount()` |
| `approved-loads` | `<ApprovedLoadsTile />` | Approved trucking loads ready for dispatch | `useApprovedLoadsCount()` |
| `in-transit` | `<InTransitTile />` | Active shipments en route | `useInTransitLoadsCount()` |
| `outbound-loads` | `<OutboundLoadsTile />` | Outbound shipments to well sites | - |
| `requests` | `renderRequests()` | All storage requests with filters | - |
| `companies` | `renderCompanies()` | Company management, CompanyDetailModal | - |
| `inventory` | `renderInventory()` | Pipe inventory with pagination | - |
| `storage` | `renderStorage()` | Yard/rack management, capacity overview | - |
| `shipments` | `renderShipments()` | Shipment coordination, dock appointments | - |
| `ai` | `renderAI()` | AdminAIAssistant chatbot | - |

### Admin Tile Components

Logistics tiles are standalone components in `components/admin/tiles/`:

| Component | File Path | Usage |
|-----------|-----------|-------|
| PendingLoadsTile | [tiles/PendingLoadsTile.tsx](../../components/admin/tiles/PendingLoadsTile.tsx) | Displays loads pending admin approval |
| ApprovedLoadsTile | [tiles/ApprovedLoadsTile.tsx](../../components/admin/tiles/ApprovedLoadsTile.tsx) | Displays approved loads ready for dispatch |
| InTransitTile | [tiles/InTransitTile.tsx](../../components/admin/tiles/InTransitTile.tsx) | Tracks shipments in transit |
| OutboundLoadsTile | [tiles/OutboundLoadsTile.tsx](../../components/admin/tiles/OutboundLoadsTile.tsx) | Manages outbound shipments |
| CompanyTileCarousel | [tiles/CompanyTileCarousel.tsx](../../components/admin/tiles/CompanyTileCarousel.tsx) | Company overview carousel on Overview tab |

---

## 🔀 Routing Decision Logic

### Main Router: [App.tsx](../../App.tsx)

```typescript
// Line 159-162: Authentication Gate
if (!user) {
  return <Auth />;
}

// Line 165-180: Admin Route
if (isAdmin) {
  return (
    <AdminDashboard
      session={{ isAdmin: true, username: user.email || 'Admin' }}
      onLogout={handleLogout}
      requests={requests}
      companies={companies}
      yards={yards}
      inventory={inventory}
      shipments={shipments}
      approveRequest={approveRequest}
      rejectRequest={rejectRequest}
      pickUpPipes={pickUpPipes}
      updateRequest={updateRequest}
    />
  );
}

// Line 183-222: Customer Route
const session: Session = {
  company: companyMatch || {
    id: 'temp',
    name: user?.user_metadata?.company_name || 'Your Company',
    domain: userDomain,
  },
  userId: userEmail,
};

return (
  <Dashboard
    session={session}
    onLogout={handleLogout}
    requests={userRequests}
    companyRequests={companyRequests}
    projectInventory={[]}
    allCompanyInventory={allCompanyInventory}
    documents={companyDocuments}
    updateRequest={updateRequest}
    addRequest={addRequest}
  />
);
```

### Admin Detection

**Source:** [AuthContext.tsx](../../lib/AuthContext.tsx)

The `isAdmin` flag is determined by checking the `admin_users` table in Supabase:

```typescript
// Checks if user.email exists in admin_users table
const isAdmin = /* query admin_users table */
```

**Database Query:**
```sql
SELECT EXISTS (
  SELECT 1 FROM admin_users
  WHERE email = user.email
)
```

---

## 📦 Component Hierarchy

### Customer Side

```
App.tsx
└── Auth.tsx (if not authenticated)
└── Dashboard.tsx (if authenticated as customer)
    ├── Header.tsx
    └── Content Router (based on selectedOption state)
        ├── StorageRequestMenu.tsx (default)
        │   ├── RequestSummaryPanel.tsx
        │   └── FloatingRoughneckChat.tsx
        ├── StorageRequestWizard.tsx
        │   └── FormHelperChatbot.tsx
        ├── InboundShipmentWizard.tsx
        └── RequestDocumentsPanel.tsx
```

### Admin Side

```
App.tsx
└── Auth.tsx (if not authenticated)
└── AdminDashboard.tsx (if authenticated as admin)
    ├── AdminHeader.tsx
    └── Content Area (based on activeTab state)
        ├── Overview: renderOverview()
        │   └── CompanyTileCarousel.tsx
        ├── Approvals: renderApprovals()
        ├── Pending Loads: PendingLoadsTile.tsx
        ├── Approved Loads: ApprovedLoadsTile.tsx
        ├── In Transit: InTransitTile.tsx
        ├── Outbound Loads: OutboundLoadsTile.tsx
        ├── Requests: renderRequests()
        ├── Companies: renderCompanies()
        │   └── CompanyDetailModal.tsx
        ├── Inventory: renderInventory()
        ├── Storage: renderStorage()
        │   └── ManualRackAdjustmentModal.tsx
        ├── Shipments: renderShipments()
        └── AI: renderAI()
            └── AdminAIAssistant.tsx
```

---

## 🔧 State Management

### Customer Dashboard State

**Component:** [Dashboard.tsx](../../components/Dashboard.tsx)

| State Variable | Type | Purpose | Line |
|----------------|------|---------|------|
| `selectedOption` | `'menu' \| 'new-storage' \| 'delivery-in' \| 'delivery-out' \| 'upload-docs'` | Controls which view is rendered | 30 |
| `archivingRequestId` | `string \| null` | Tracks which request is being archived | 31 |
| `selectedRequest` | `StorageRequest \| null` | Currently selected request for operations | 32 |
| `pendingSubmission` | `StorageRequest \| null` | Newly submitted request awaiting render | 33 |

### Admin Dashboard State

**Component:** [AdminDashboard.tsx](../../components/admin/AdminDashboard.tsx)

| State Variable | Type | Purpose | Line |
|----------------|------|---------|------|
| `activeTab` | `TabType` | Controls which admin tab is displayed | 103 |
| `globalSearch` | `string` | Search filter across all data | 104 |
| `requestFilter` | `'ALL' \| RequestStatus` | Filters requests by status | 105 |
| `selectedCompanyId` | `string \| null` | Company selected for detail modal | 118 |
| `selectedRack` | `Rack \| null` | Rack selected for adjustment modal | 120 |

---

## 🚦 Navigation Triggers

### Customer Navigation

| From State | Trigger | To State | Component |
|------------|---------|----------|-----------|
| `menu` | Click "Request Storage" button | `new-storage` | StorageRequestWizard |
| `menu` | Click "Schedule Delivery" on card | `delivery-in` | InboundShipmentWizard |
| `menu` | Click "Upload Documents" on card | `upload-docs` | RequestDocumentsPanel |
| `new-storage` | Click "< Back to Menu" | `menu` | StorageRequestMenu |
| `delivery-in` | Click "< Back to Menu" | `menu` | StorageRequestMenu |
| `upload-docs` | Click "< Back to Menu" | `menu` | StorageRequestMenu |

**Code Reference:** [Dashboard.tsx:39-46](../../components/Dashboard.tsx#L39-L46)

### Admin Navigation

| Tab | Trigger | Code Reference |
|-----|---------|----------------|
| Overview | Default on login, click tab | `activeTab === 'overview'` |
| Approvals | Click "Approvals" tab | `setActiveTab('approvals')` line ~776 |
| Pending Loads | Click "Pending Loads" tab | `setActiveTab('pending-loads')` |
| All tabs | Tab buttons in navigation | Lines 2276-2278 (tab mapping) |

**Code Reference:** [AdminDashboard.tsx:2276-2290](../../components/admin/AdminDashboard.tsx#L2276-L2290)

---

## 🔄 Update Checklist

When modifying navigation structure, update the following:

- [ ] This document ([NAVIGATION_MAPPINGS.md](./NAVIGATION_MAPPINGS.md))
- [ ] Update component hierarchy if new components added
- [ ] Update state management tables if new states added
- [ ] Update routing decision logic if conditions change
- [ ] Verify all file path links are correct
- [ ] Update "Last Updated" date at top of document

### Key Files to Monitor

| File | What to Update Here When Changed |
|------|----------------------------------|
| [App.tsx](../../App.tsx) | Update routing decision logic section, admin detection logic |
| [Dashboard.tsx](../../components/Dashboard.tsx) | Update customer flow chart, state management table, navigation triggers |
| [AdminDashboard.tsx](../../components/admin/AdminDashboard.tsx) | Update admin tabs reference table, tab rendering logic, state management |
| [Auth.tsx](../../components/Auth.tsx) | Update authentication flow in both customer and admin sections |

---

## 🔗 Related Documentation

- [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md) - System architecture overview
- [User Workflows](../guides/USER_WORKFLOWS.md) - End-to-end user workflows
- [Component Architecture](../architecture/COMPONENT_ARCHITECTURE.md) - Component design patterns

---

## 📝 Notes

- **Customer sessions** are auto-created from authenticated user data (App.tsx:183-196)
- **Admin detection** relies on `admin_users` table in Supabase database
- **Logo click** in Auth.tsx toggles between customer and admin login (line 163-169)
- **FloatingRoughneckChat** is always available on StorageRequestMenu but not on wizard pages
- **PendingLoadsTile, ApprovedLoadsTile, InTransitTile, OutboundLoadsTile** use real-time Supabase subscriptions for live updates
