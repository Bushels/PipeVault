/**
 * Company Tile Carousel
 *
 * Horizontal scrolling container displaying company summary tiles.
 * Reuses the scroll pattern from RequestSummaryPanel with admin-specific styling.
 *
 * Features:
 * - Horizontal scroll with snap-to-tile
 * - Wheel scroll support (vertical → horizontal)
 * - Prev/Next navigation buttons
 * - Touch/swipe support on mobile
 * - Keyboard navigation (arrow keys)
 *
 * Responsive:
 * - Desktop (>1024px): 2-3 tiles visible, wheel + buttons
 * - Tablet (640-1024px): 1.5 tiles visible, touch + buttons
 * - Mobile (<640px): 1 tile visible, touch only
 */

import React, { useRef, useState, useEffect } from 'react';
import { useCompanySummaries } from '../../../hooks/useCompanyData';
import type { Yard } from '../../../types';
import CompanyTile from './CompanyTile';

interface CompanyTileCarouselProps {
  onCompanyClick: (companyId: string) => void;
  onViewCompanyDetails?: (companyId: string) => void;
  selectedCompanyId?: string | null;
  yards: Yard[];
}

const CompanyTileCarousel: React.FC<CompanyTileCarouselProps> = ({
  onCompanyClick,
  onViewCompanyDetails,
  selectedCompanyId,
  yards,
}) => {
  const { data: companies, isLoading, error } = useCompanySummaries();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Update scroll button visibility
  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    updateScrollButtons();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollButtons);
      window.addEventListener('resize', updateScrollButtons);
      return () => {
        container.removeEventListener('scroll', updateScrollButtons);
        window.removeEventListener('resize', updateScrollButtons);
      };
    }
  }, [companies]);

  // Wheel scroll handler: Only intercept with Shift key for horizontal scroll
  // This fixes the passive listener preventDefault error and allows normal page scrolling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only intercept if Shift is held down (horizontal scroll intent)
      if (e.shiftKey && Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        container.scrollBy({
          left: e.deltaY,
          behavior: 'smooth',
        });
      }
      // Otherwise, let normal vertical scrolling work
    };

    // Add with { passive: false } to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Keyboard navigation for accessibility
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

  // Scroll to next tile
  const scrollToNext = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const tileWidth = container.querySelector('div')?.offsetWidth || 600;
    container.scrollBy({ left: tileWidth + 24, behavior: 'smooth' });
  };

  // Scroll to previous tile
  const scrollToPrev = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const tileWidth = container.querySelector('div')?.offsetWidth || 600;
    container.scrollBy({ left: -(tileWidth + 24), behavior: 'smooth' });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-800 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="flex gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-none w-full sm:w-[calc(100%-2rem)] lg:w-[600px] h-[480px] bg-gray-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-red-300 mb-2">Error Loading Companies</h3>
        <p className="text-sm text-red-400">{error.message}</p>
      </div>
    );
  }

  // Empty state
  if (!companies || companies.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8 text-center">
        <h3 className="text-lg font-bold text-white mb-2">No Companies Found</h3>
        <p className="text-sm text-gray-400">
          Companies will appear here once customers create storage requests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Company Overview</h2>
          <p className="text-sm text-gray-400 mt-1">
            {companies.length === 1
              ? '1 company'
              : `${companies.length} companies`}
          </p>
        </div>
        {companies.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="hidden sm:inline">Use arrow buttons, Shift+wheel, or swipe</span>
            <span className="sm:hidden">Swipe to view all</span>
          </div>
        )}
      </div>

      {/* Carousel Container */}
      <div className="relative -mx-4 px-4">
        {/* Hide scrollbar */}
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>

        {/* Previous Button */}
        {canScrollLeft && (
          <button
            onClick={scrollToPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-gray-900/95 hover:bg-gray-800 border-2 border-cyan-700 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 group"
            aria-label="Previous company"
          >
            <svg
              className="w-6 h-6 text-cyan-400 group-hover:text-cyan-300 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Next Button */}
        {canScrollRight && (
          <button
            onClick={scrollToNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-gray-900/95 hover:bg-gray-800 border-2 border-cyan-700 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 group"
            aria-label="Next company"
          >
            <svg
              className="w-6 h-6 text-cyan-400 group-hover:text-cyan-300 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Tile Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-6 overflow-x-auto overflow-y-visible pb-6 snap-x snap-mandatory scrollbar-hide"
          role="region"
          aria-label="Company overview tiles"
          aria-live="polite"
          tabIndex={0}
        >
          {companies.map((company) => (
            <CompanyTile
              key={company.id}
              company={company}
              onSelect={() => onCompanyClick(company.id)}
              onViewDetails={() =>
                (onViewCompanyDetails ?? onCompanyClick)(company.id)
              }
              isSelected={selectedCompanyId === company.id}
              yards={yards}
            />
          ))}
        </div>

        {/* Scroll Indicator Dots (visible on mobile) */}
        {companies.length > 1 && (
          <div className="flex justify-center gap-2 mt-4 sm:hidden">
            {companies.map((_, index) => (
              <div
                key={index}
                className="w-2 h-2 rounded-full bg-gray-600"
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyTileCarousel;
