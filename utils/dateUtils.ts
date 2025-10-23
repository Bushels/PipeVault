/**
 * Calculate the number of days between two dates
 */
export const calculateDaysBetween = (startDate: string, endDate?: string): number => {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffInMs = end.getTime() - start.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  return diffInDays;
};

/**
 * Calculate days in storage for a pipe
 * Returns the number of days from drop-off to pick-up (or current date if not picked up)
 */
export const calculateDaysInStorage = (
  dropOffTimestamp?: string,
  pickUpTimestamp?: string
): number => {
  if (!dropOffTimestamp) return 0;
  return calculateDaysBetween(dropOffTimestamp, pickUpTimestamp);
};

/**
 * Format a date string to a readable format
 */
export const formatDate = (isoString: string, includeTime = false): string => {
  const date = new Date(isoString);

  if (includeTime) {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format duration in days to a human-readable string
 */
export const formatDuration = (days: number): string => {
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    if (remainingDays === 0) {
      return weeks === 1 ? '1 week' : `${weeks} weeks`;
    }
    return `${weeks}w ${remainingDays}d`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    if (remainingDays === 0) {
      return months === 1 ? '1 month' : `${months} months`;
    }
    return `${months}mo ${remainingDays}d`;
  }
  const years = Math.floor(days / 365);
  const remainingDays = days % 365;
  const months = Math.floor(remainingDays / 30);
  if (months === 0) {
    return years === 1 ? '1 year' : `${years} years`;
  }
  return `${years}y ${months}mo`;
};

/**
 * Get status badge color based on pipe status
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'IN_STORAGE':
      return 'bg-green-900/30 text-green-400 border-green-700';
    case 'PICKED_UP':
      return 'bg-gray-700 text-gray-400 border-gray-600';
    case 'PENDING_DELIVERY':
      return 'bg-yellow-900/30 text-yellow-400 border-yellow-700';
    case 'IN_TRANSIT':
      return 'bg-blue-900/30 text-blue-400 border-blue-700';
    default:
      return 'bg-gray-700 text-gray-400 border-gray-600';
  }
};

/**
 * Format status for display
 */
export const formatStatus = (status: string): string => {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
};
