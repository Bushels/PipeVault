# AI Manifest Display - Testing Guide

**Quick Reference for QA and Admin Testing**

---

## Pre-Testing Setup

### 1. Apply Database Migration
```bash
# Option A: Using Supabase CLI
cd c:\Users\kyle\MPS\PipeVault
supabase db push

# Option B: Manually via Supabase Dashboard
# Go to: Dashboard > SQL Editor > New Query
# Paste contents of: supabase/migrations/20251107000002_add_parsed_payload_to_trucking_documents.sql
# Click RUN
```

### 2. Verify Column Added
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'trucking_documents'
AND column_name = 'parsed_payload';

-- Should return: parsed_payload | jsonb
```

---

## Test Scenarios

### Scenario 1: New Document Upload (Expected: Show Data)

**Steps**:
1. Login as customer
2. Start inbound shipment wizard
3. Upload a pipe manifest (PDF or JPG)
4. Wait for AI extraction (5-10 seconds)
5. Complete booking
6. Login as admin
7. Open "Documents" tab in admin dashboard
8. Click on the storage request
9. View the document in document viewer modal

**Expected Result**:
- ✅ See "AI-Extracted Manifest Data" section
- ✅ Summary cards show: Total Joints, Total Length, Total Weight
- ✅ Data quality badge shows green (90%+) or yellow (70-89%)
- ✅ Table displays all pipe joints with:
  - Heat numbers
  - Serial numbers
  - Tally lengths (ft)
  - Grades (shown as colored pills)
  - Dimensions (OD, weight/ft)
- ✅ Info box at bottom explains AI extraction
- ✅ "View" button still works to see raw document

---

### Scenario 2: Existing Document (Expected: No Data Message)

**Steps**:
1. Login as admin
2. Find a storage request with documents uploaded BEFORE this feature
3. Open document viewer modal
4. Check the document display

**Expected Result**:
- ✅ See "No manifest data extracted from this document" message
- ✅ Explanation text: "This may be a proof of delivery, photos, or other non-manifest document"
- ✅ No error messages or console errors
- ✅ "View" button still works
- ✅ Document header still shows filename and upload date

---

### Scenario 3: Non-Manifest Document (Expected: Graceful Message)

**Steps**:
1. Upload a proof of delivery (POD) or truck photo
2. Complete booking
3. Login as admin
4. View document in document viewer modal

**Expected Result**:
- ✅ See "No manifest data extracted" message
- ✅ UI doesn't break or show empty table
- ✅ Info icon and helpful explanation visible

---

### Scenario 4: Partial Extraction (Expected: Quality Warning)

**Steps**:
1. Upload a low-quality manifest scan (blurry, faded, or handwritten)
2. AI may extract some data but miss many fields
3. View in admin dashboard

**Expected Result**:
- ✅ Data quality badge shows yellow (70-89%) or red (<70%)
- ✅ Table shows "N/A" for missing fields
- ✅ Totals calculation only includes available data
- ✅ Info box reminds: "Please verify accuracy before using for critical operations"
- ✅ Admin can click "View" to manually check raw document

---

### Scenario 5: Multiple Documents per Load (Expected: Isolated Display)

**Steps**:
1. Create a load with 3 documents:
   - Document 1: Manifest (should show data)
   - Document 2: POD (should show "No data" message)
   - Document 3: Photos (should show "No data" message)
2. View in admin dashboard

**Expected Result**:
- ✅ Each document shows its own data display independently
- ✅ Manifest document shows table with joints
- ✅ POD and Photos show "No manifest data" message
- ✅ No cross-contamination between documents

---

## Visual Regression Checks

### Colors & Theming
- ✅ Dark background matches AdminDashboard (`bg-gray-900`)
- ✅ Borders use consistent gray-800 theme
- ✅ Quality badges use correct colors:
  - Green: `bg-green-900/30 text-green-400 border-green-800`
  - Yellow: `bg-yellow-900/30 text-yellow-400 border-yellow-800`
  - Red: `bg-red-900/30 text-red-400 border-red-800`
- ✅ Grade pills use indigo theme (`bg-indigo-900/30 text-indigo-300 border-indigo-800`)

### Layout & Spacing
- ✅ Summary cards have equal width (3-column grid)
- ✅ Table header is sticky during scroll
- ✅ Max height 24rem (96px) with scroll for long manifests
- ✅ Document spacing increased to `space-y-4` (not cramped)

### Typography
- ✅ Font mono used for: heat numbers, serial numbers, dimensions
- ✅ Font semibold used for: manufacturer, quantity
- ✅ "N/A" text is gray italic (`text-gray-600 italic`)

---

## Edge Cases to Test

### Edge Case 1: Empty Manifest
- Upload blank page as manifest
- AI returns `[]` (no joints)
- Should show "No manifest data" message

### Edge Case 2: Very Long Manifest (200+ joints)
- Upload manifest with 200 joints
- Table should scroll properly
- Summary cards should calculate correctly
- No performance lag in rendering

### Edge Case 3: Special Characters in Data
- Manifest with Unicode characters in manufacturer names
- Heat numbers with hyphens, slashes, underscores
- Should render correctly without breaking layout

### Edge Case 4: Missing Document Type
- Document with `document_type = null`
- Should show "Uncategorized" in header
- Manifest display should still work

---

## Browser Compatibility

Test in:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Edge (latest)
- ✅ Safari (latest)

**Mobile Responsive**:
- ✅ Summary cards stack vertically on mobile
- ✅ Table scrolls horizontally if needed
- ✅ Document header stacks on mobile (flex-col)

---

## Performance Testing

### Metrics to Check
- ✅ Document viewer modal opens in <500ms
- ✅ Manifest data renders in <100ms (client-side calculation)
- ✅ No console errors or warnings
- ✅ No React warnings about missing keys
- ✅ Smooth scroll in table (no jank)

### Large Dataset Test
1. Create request with 5 loads
2. Each load has 3 documents
3. Total 15 documents in viewer
4. All manifest displays should render without lag

---

## Accessibility Testing

### Keyboard Navigation
- ✅ Tab through document list
- ✅ Enter on "View" button opens preview
- ✅ Table rows highlight on focus
- ✅ Escape closes modal

### Screen Reader
- ✅ Table announces headers correctly
- ✅ Summary cards read in logical order
- ✅ Quality badge announces percentage
- ✅ Info box is read with icon description

### Color Contrast
- ✅ All text meets WCAG AA standards
- ✅ Quality badges readable for colorblind users (use shape/icon if needed)

---

## Regression Testing

### Ensure No Breakage
- ✅ Document viewer modal still works
- ✅ "View" button still previews documents
- ✅ "Edit Load" button still works
- ✅ "Delete Load" button still works
- ✅ Document filters (direction, status, type) still work
- ✅ Global search in dashboard still works

---

## Production Readiness Checklist

### Database
- [ ] Migration applied successfully
- [ ] Column exists: `trucking_documents.parsed_payload`
- [ ] Index created: `idx_trucking_documents_parsed_payload`
- [ ] No existing data corrupted

### Code
- [ ] TypeScript compiles without errors
- [ ] No console errors in browser
- [ ] Component renders correctly
- [ ] Data mapper includes `parsedPayload`

### Documentation
- [ ] CHANGELOG.md updated (version 2.0.5)
- [ ] AI_MANIFEST_DISPLAY_IMPLEMENTATION.md complete
- [ ] coordination-log.md updated

### User Experience
- [ ] Manifest data displays correctly
- [ ] Null data handled gracefully
- [ ] Quality indicators helpful
- [ ] Performance acceptable

---

## Troubleshooting

### Issue: "No manifest data" for ALL documents (even new uploads)

**Diagnosis**:
1. Check if migration applied: `SELECT * FROM information_schema.columns WHERE table_name = 'trucking_documents' AND column_name = 'parsed_payload';`
2. Check if data is being saved: `SELECT id, file_name, parsed_payload FROM trucking_documents ORDER BY uploaded_at DESC LIMIT 5;`
3. Check browser console for errors

**Fix**:
- If column missing: Apply migration
- If data not saving: Check document upload service (manifestProcessingService.ts)
- If mapper issue: Verify `mapTruckingDocumentRow` includes `parsedPayload`

---

### Issue: Quality badge always shows 0%

**Diagnosis**:
- Check data structure: `SELECT parsed_payload FROM trucking_documents WHERE parsed_payload IS NOT NULL LIMIT 1;`
- Verify field names match `ManifestItem` interface

**Fix**:
- If structure mismatch: Update either AI service or component to match
- If calculation error: Check `qualityMetrics` logic in ManifestDataDisplay.tsx

---

### Issue: Table doesn't scroll

**Diagnosis**:
- Inspect element and check for CSS conflicts
- Verify `max-h-96 overflow-y-auto` classes present

**Fix**:
- Add inline styles if Tailwind classes not applying: `style={{ maxHeight: '24rem', overflowY: 'auto' }}`

---

## Rollback Procedure

If critical issues found:

### Quick Disable (Non-Breaking)
```typescript
// In AdminDashboard.tsx line 2027-2031, comment out:
{/* <ManifestDataDisplay
  data={document.parsedPayload}
  documentFileName={document.fileName}
/> */}
```

### Full Rollback
```bash
git revert <commit-hash-for-this-feature>
git push
```

Then remove database column:
```sql
ALTER TABLE trucking_documents DROP COLUMN parsed_payload;
DROP INDEX IF EXISTS idx_trucking_documents_parsed_payload;
```

---

**Test Coverage Goal**: 100% of scenarios above passing before production deploy

**Estimated Testing Time**: 30-45 minutes for full suite

**Last Updated**: 2025-11-07
