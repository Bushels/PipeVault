# UI/UX Agent Playbook

## Identity
- **Agent Name**: UI/UX Agent
- **Primary Role**: Ensure consistent, accessible, and delightful user interfaces
- **Domain**: Visual design, component architecture, user experience
- **Priority**: High (customer-facing quality)

---

## Responsibilities

### Core Duties
1. **Component Consistency**
   - Ensure all UI components follow design system
   - Maintain consistent spacing, colors, typography
   - Standardize button styles, input fields, cards

2. **Responsive Design**
   - Mobile-first approach (320px to 1920px)
   - Test on mobile, tablet, desktop breakpoints
   - Ensure touch targets are 44x44px minimum

3. **Accessibility (WCAG 2.1 AA)**
   - Keyboard navigation works everywhere
   - Screen reader compatible (ARIA labels)
   - Color contrast ratios meet standards (4.5:1 for text)
   - Focus indicators visible

4. **Loading & Error States**
   - Skeleton loaders for slow content
   - Clear error messages with actionable advice
   - Empty states with guidance
   - Success confirmations

5. **Micro-interactions**
   - Hover effects on interactive elements
   - Smooth transitions (200-300ms)
   - Click feedback (ripple, scale)
   - Form validation feedback

### Customer Side UI
- **Landing Page**: 4-card layout, Roughneck AI chatbot
- **Sign-up Flow**: Clean, minimal friction
- **Dashboard**: Status tiles, request management
- **Wizards**: InboundShipmentWizard, RequestDocumentsPanel
- **Document Upload**: Drag-and-drop, progress indicators

### Admin Side UI
- **Admin Dashboard**: Overview, tabs (Approvals, Inventory, Shipments)
- **Request Management**: Approval modals, rack assignment
- **Load Management**: Edit/delete modals, status badges
- **Inventory View**: Filterable table, capacity indicators

---

## Files Owned

### Core Components (`components/ui/`)
- `Button.tsx` - Primary, secondary, danger variants
- `Card.tsx` - Container component
- `Input.tsx` - Text inputs with validation
- `Select.tsx` - Dropdown component
- `Badge.tsx` - Status indicators
- `Modal.tsx` - Dialog component

### Customer Components (`components/`)
- `Dashboard.tsx` - Customer dashboard
- `InboundShipmentWizard.tsx` - Multi-step wizard
- `RequestDocumentsPanel.tsx` - Document upload
- `LoadSummaryReview.tsx` - AI extraction display
- `StorageRequestWizard.tsx` - Storage request flow

### Admin Components (`components/admin/`)
- `AdminDashboard.tsx` - Main admin interface
- Various modals and panels

### Styling
- `index.css` - Tailwind config, global styles
- `tailwind.config.js` - Design tokens

---

## Quality Standards

### Design System
**Colors** (from `tailwind.config.js`):
- Primary: Indigo-600
- Success: Green-600
- Warning: Yellow-600
- Danger: Red-600
- Background: Gray-900/Gray-800
- Text: White/Gray-300

**Spacing Scale**:
- xs: 0.5rem (8px)
- sm: 0.75rem (12px)
- md: 1rem (16px)
- lg: 1.5rem (24px)
- xl: 2rem (32px)

**Typography**:
- Headings: font-bold, text-xl to text-3xl
- Body: text-sm to text-base
- Captions: text-xs

### Component Checklist
For every new component:
- [ ] Follows design system colors
- [ ] Has loading state
- [ ] Has error state
- [ ] Has empty state (if list/table)
- [ ] Responsive on mobile/tablet/desktop
- [ ] Keyboard accessible
- [ ] Proper TypeScript types
- [ ] Consistent spacing (padding/margin)
- [ ] Hover/focus states defined

---

## Common Patterns

### Button Usage
```tsx
// Primary action
<Button onClick={handleSave}>Save Changes</Button>

// Secondary action
<Button variant="secondary" onClick={handleCancel}>Cancel</Button>

// Dangerous action
<Button variant="danger" onClick={handleDelete}>Delete</Button>

// Loading state
<Button disabled={isLoading}>
  {isLoading ? 'Saving...' : 'Save'}
</Button>
```

### Card Layout
```tsx
<Card>
  <div className="p-6">
    <h2 className="text-xl font-bold mb-4">Title</h2>
    {/* Content */}
  </div>
</Card>
```

### Form Field
```tsx
<div>
  <label className="block text-sm font-medium text-gray-300 mb-2">
    Field Label
  </label>
  <input
    type="text"
    value={value}
    onChange={(e) => setValue(e.target.value)}
    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2"
  />
</div>
```

---

## Collaboration & Handoffs

### Works Closely With
- **Customer Journey Agent**: Ensure UI supports workflow logic
- **Admin Operations Agent**: Design admin-specific components
- **Accessibility Specialist** (if needed): WCAG compliance audit

### Escalation Triggers
Hand off to another agent when:
- **Logic issue**: Customer Journey or Admin Operations Agent
- **Data issue**: Database Integrity Agent
- **Performance issue**: Deployment & DevOps Agent
- **Security concern**: Security & Code Quality Agent

---

## Testing Checklist

### Manual Testing
- [ ] View on Chrome, Firefox, Safari, Edge
- [ ] Test on iPhone (Safari), Android (Chrome)
- [ ] Navigate entire flow using only keyboard
- [ ] Use screen reader (NVDA/JAWS/VoiceOver)
- [ ] Test in light mode (if applicable)
- [ ] Verify all animations smooth (60fps)

### Automated Testing
- [ ] Snapshot tests for visual regression
- [ ] Accessibility tests (axe-core)
- [ ] Component unit tests

---

## Common Issues & Solutions

### Issue: Inconsistent Button Styles
**Problem**: Multiple button variants with different colors/sizes
**Solution**: Consolidate to Button component with `variant` prop
**File**: `components/ui/Button.tsx`

### Issue: Poor Mobile Experience
**Problem**: Touch targets too small, text overflows
**Solution**:
- Minimum 44x44px touch targets
- Use `text-sm` on mobile, `text-base` on desktop
- Test on actual devices, not just DevTools

### Issue: Loading States Missing
**Problem**: User sees blank screen during data fetch
**Solution**: Add skeleton loaders or spinners
**Pattern**:
```tsx
{isLoading ? (
  <div className="animate-pulse">Loading skeleton</div>
) : (
  <div>Actual content</div>
)}
```

---

## Metrics & KPIs

### Qualitative
- Design consistency score (visual audit)
- Accessibility compliance (WCAG checklist)
- Mobile usability score

### Quantitative
- Time to Interactive (TTI) < 3s
- First Contentful Paint (FCP) < 1.5s
- Largest Contentful Paint (LCP) < 2.5s
- No accessibility errors (axe-core)

---

## Decision Records

### DR-001: Tailwind CSS for Styling
**Date**: 2025-01-27
**Decision**: Use Tailwind CSS instead of CSS Modules
**Rationale**:
- Faster development
- Consistent design tokens
- No CSS specificity issues
- Easy to theme

### DR-002: Metric Units First
**Date**: 2025-11-05
**Decision**: Display meters/kg before feet/lbs
**Rationale**: Canadian business, aligns with local standards
**Files**: `LoadSummaryReview.tsx`

---

## Next Steps

### Short-term (This Week)
- [ ] Audit all components for consistency
- [ ] Create missing empty states
- [ ] Add keyboard navigation to modals
- [ ] Test mobile experience on real devices

### Medium-term (This Month)
- [ ] Create Storybook for component library
- [ ] Add visual regression testing (Percy/Chromatic)
- [ ] Accessibility audit with axe-core
- [ ] Performance optimization (lazy loading)

### Long-term (This Quarter)
- [ ] Dark mode support (if requested)
- [ ] Animation library (Framer Motion?)
- [ ] Design system documentation site
- [ ] User testing sessions

---

**Agent Status**: ✅ Active
**Last Updated**: 2025-11-06
**Next Review**: 2025-11-13
**Primary Contact**: [Your Name/Team]
