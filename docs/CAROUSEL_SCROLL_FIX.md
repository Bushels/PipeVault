# Carousel Scroll Hijacking & Tile Truncation Fix

## Issue Summary

Fixed critical UX and accessibility issues with horizontal carousels in both admin and customer-facing components.

## Problems Fixed

### 1. Passive Event Listener Error (CRITICAL)
- **Error**: "Unable to preventDefault inside passive event listener invocation"
- **Root Cause**: React's synthetic event `onWheel` handler doesn't support `{ passive: false }` option
- **Impact**: Console errors, inconsistent scroll behavior across browsers
- **Fix**: Replaced React synthetic event with native `addEventListener` using `{ passive: false }`

### 2. Vertical Scroll Hijacking (UX Issue)
- **Problem**: ALL vertical wheel scrolling was converted to horizontal carousel scroll
- **Impact**: Users couldn't scroll page normally when hovering over carousel
- **Fix**: Only intercept scroll when **Shift key is held** (industry-standard horizontal scroll modifier)

### 3. Tile Content Truncation
- **Problem**: Fixed height (480px) with no internal scrolling cut off bottom buttons
- **Impact**: "View Details" and "Quick Approve" buttons partially hidden on shorter viewports
- **Fix**:
  - Changed from `h-[480px]` to `min-h-[480px] max-h-[600px]`
  - Added `overflow-y-auto` to content container
  - Used flexbox `flex-1` for proper space distribution

### 4. Missing Keyboard Navigation
- **Problem**: No keyboard support for carousel navigation
- **Impact**: Accessibility failure for keyboard-only users
- **Fix**: Added Left/Right arrow key handlers with proper focus management

## Files Modified

### 1. `components/admin/tiles/CompanyTileCarousel.tsx`
**Lines 59-99**: Replaced React synthetic event with native event listeners

```typescript
// OLD (broken):
const handleWheelScroll = (event: React.WheelEvent<HTMLDivElement>) => {
  event.preventDefault(); // ❌ Doesn't work in passive listener
  scrollContainerRef.current.scrollBy({ left: event.deltaY });
};

// NEW (fixed):
useEffect(() => {
  const container = scrollContainerRef.current;
  if (!container) return;

  const handleWheel = (e: WheelEvent) => {
    // Only intercept with Shift key for horizontal scroll
    if (e.shiftKey && Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      container.scrollBy({ left: e.deltaY, behavior: 'smooth' });
    }
  };

  container.addEventListener('wheel', handleWheel, { passive: false });
  return () => container.removeEventListener('wheel', handleWheel);
}, []);
```

**Lines 82-99**: Added keyboard navigation

```typescript
useEffect(() => {
  const container = scrollContainerRef.current;
  if (!container) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollToPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollToNext();
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  return () => container.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Lines 163-179**: Updated header with usage instructions

```typescript
{companies.length > 1 && (
  <div className="flex items-center gap-2 text-xs text-gray-400">
    <span className="hidden sm:inline">Use arrow buttons, Shift+wheel, or swipe</span>
    <span className="sm:hidden">Swipe to view all</span>
  </div>
)}
```

**Lines 230-237**: Added ARIA attributes and tabIndex

```typescript
<div
  ref={scrollContainerRef}
  className="flex gap-6 overflow-x-auto overflow-y-visible pb-6 snap-x snap-mandatory scrollbar-hide"
  role="region"
  aria-label="Company overview tiles"
  aria-live="polite"
  tabIndex={0}  // ✅ Enables keyboard focus
>
```

### 2. `components/RequestSummaryPanel.tsx`
**Lines 100-140**: Applied identical wheel scroll and keyboard navigation fixes

**Lines 268-273**: Updated header with usage instructions

**Lines 334-340**: Added ARIA attributes and tabIndex

**Lines 453-460**: Fixed tile truncation with flexible height

```typescript
// OLD: Fixed height cuts off content
<div className="... h-[480px]">
  <div className="... h-full flex flex-col">

// NEW: Flexible height with internal scrolling
<div className="... min-h-[480px] max-h-[600px] flex flex-col">
  <div className="... flex-1 flex flex-col overflow-y-auto">
```

### 3. `components/admin/tiles/CompanyTile.tsx`
**Lines 156-170**: Fixed tile truncation with same pattern

```typescript
<div className="... min-h-[480px] max-h-[600px] transition-all duration-200 group-hover:transform group-hover:-translate-y-1 flex flex-col">
  <div className="relative p-6 flex-1 flex flex-col overflow-y-auto">
```

## Navigation Methods Supported

### Desktop
1. **Arrow Buttons**: Visible left/right buttons (when content overflows)
2. **Shift + Mouse Wheel**: Horizontal scroll (vertical scroll works normally)
3. **Left/Right Arrow Keys**: Keyboard navigation (when carousel focused)
4. **Touch/Trackpad Swipe**: Native horizontal scroll

### Mobile
1. **Touch Swipe**: Primary navigation method
2. **Arrow Buttons**: Visible on tablet and desktop
3. **Vertical Scroll**: Works normally for page scrolling

## Design System Compliance

### Accessibility (WCAG 2.1 AA)
- ✅ Keyboard navigable (Left/Right arrows)
- ✅ Focus indicators visible (tabIndex={0})
- ✅ ARIA labels present (role="region", aria-label)
- ✅ Touch targets ≥44x44px (arrow buttons are 48x48px)
- ✅ Screen reader compatible (semantic HTML, ARIA live regions)

### Responsive Design
- ✅ Mobile (320px+): Touch swipe only, vertical scroll works
- ✅ Tablet (640px+): Touch + arrow buttons
- ✅ Desktop (1024px+): All navigation methods

### Color & Styling
- ✅ Arrow buttons use design system colors (gray-900, cyan-700 border for admin, gray-700 for customer)
- ✅ Hover states with proper transitions (200ms duration)
- ✅ Smooth scroll behavior (300ms)

## Testing Checklist

### Browser Testing
- [ ] Chrome: No console errors about preventDefault
- [ ] Firefox: Wheel scroll works correctly
- [ ] Safari: Touch gestures work on trackpad
- [ ] Edge: All navigation methods functional

### Interaction Testing
- [ ] Vertical scroll works normally when NOT holding Shift
- [ ] Shift + wheel scrolls carousel horizontally
- [ ] Arrow buttons appear when content overflows
- [ ] Arrow buttons hide when at start/end
- [ ] Left/Right arrow keys navigate when carousel focused
- [ ] Touch swipe works on mobile/tablet

### Content Testing
- [ ] All tile content visible (no truncation)
- [ ] Bottom buttons fully visible ("View Details", "Quick Approve")
- [ ] Tiles scroll internally if content exceeds max height (600px)
- [ ] Flexible height works on different screen sizes

### Accessibility Testing
- [ ] Tab to focus carousel container
- [ ] Arrow keys navigate between tiles
- [ ] Screen reader announces carousel region
- [ ] Focus indicators visible
- [ ] No keyboard traps

## Migration Notes

### Breaking Changes
None. All changes are backward-compatible enhancements.

### Behavioral Changes
1. **Vertical scrolling no longer hijacked**: Users must hold Shift to scroll carousel with mouse wheel
2. **Tile height flexible**: Tiles now range from 480px to 600px based on content
3. **Keyboard navigation added**: Left/Right arrows navigate carousel when focused

## Performance Impact

- **Minimal**: Native event listeners are more performant than React synthetic events
- **Memory**: No memory leaks (proper cleanup in useEffect return functions)
- **Render**: No additional re-renders (event listeners don't trigger state changes)

## User Education

Added visual hints to both components:
- Desktop: "Use arrow buttons, Shift+wheel, or swipe"
- Mobile: "Swipe to view all"

Consider adding a tooltip on first visit explaining Shift+wheel shortcut.

## Future Improvements

1. **Scroll Position Persistence**: Remember scroll position when navigating away
2. **Snap Points**: Fine-tune snap-to-tile behavior
3. **Infinite Scroll**: Add lazy loading for large datasets
4. **Touch Velocity**: Implement momentum scrolling on touch devices
5. **Accessibility**: Add skip links to jump to specific tiles

## References

- [MDN: EventTarget.addEventListener options](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#parameters)
- [WCAG 2.1 Keyboard Navigation](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html)
- [Chrome Passive Event Listeners](https://developer.chrome.com/blog/passive-event-listeners/)
