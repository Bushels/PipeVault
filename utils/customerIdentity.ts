import type { User } from '@supabase/supabase-js';
import type { StorageRequest } from '../types';

export interface CustomerIdentityOptions {
  user?: User | null;
  fallbackEmail?: string | null;
  fallbackCompany?: string | null;
  requests?: StorageRequest[];
}

const toTitleCase = (value: string): string =>
  value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((chunk) => {
      const lower = chunk.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ')
    .trim();

export const resolveCustomerIdentity = ({
  user,
  fallbackEmail,
  fallbackCompany,
  requests = [],
}: CustomerIdentityOptions) => {
  // Construct full name from first and last name
  const firstName = typeof user?.user_metadata?.first_name === 'string'
    ? user.user_metadata.first_name.trim()
    : '';
  const lastName = typeof user?.user_metadata?.last_name === 'string'
    ? user.user_metadata.last_name.trim()
    : '';

  const metadataFullName = firstName && lastName
    ? `${firstName} ${lastName}`.trim()
    : firstName || lastName || '';

  const metadataCompany =
    typeof user?.user_metadata?.company_name === 'string'
      ? user.user_metadata.company_name.trim()
      : '';

  const candidateEmail = (user?.email ?? fallbackEmail ?? '').toLowerCase();

  const requestContactName = requests.find((request) => {
    if (!candidateEmail || !request.userId) {
      return false;
    }
    return (
      request.userId.toLowerCase() === candidateEmail &&
      typeof request.requestDetails?.fullName === 'string' &&
      request.requestDetails.fullName.trim().length > 0
    );
  })?.requestDetails?.fullName?.trim();

  const emailName =
    candidateEmail.length > 0 ? toTitleCase(candidateEmail.split('@')[0] ?? '') : '';

  const displayName = metadataFullName || requestContactName || emailName || 'Valued Customer';
  const displayCompany = metadataCompany || (fallbackCompany ?? '');

  return { displayName, displayCompany };
};

