/**
 * Notification Service - Abstraction Layer
 *
 * Central service for all load approval notifications.
 * Currently uses Slack; designed to support email notifications in future.
 *
 * Design Principles:
 * - Consistent payload shape (load, company, admin) for all channels
 * - Channel-agnostic interface (caller doesn't care about Slack vs Email)
 * - Type-safe with clear error handling
 */

import type { TruckingLoad, Company } from '../types';

const SLACK_WEBHOOK_URL = import.meta.env.VITE_SLACK_WEBHOOK_URL;

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationPayload {
  load: {
    id: string;
    sequenceNumber: number;
    scheduledSlotStart: string;
    scheduledSlotEnd: string;
    truckingCompany: string | null;
    driverName: string | null;
    totalJointsPlanned: number | null;
    totalLengthFtPlanned: number | null;
  };
  company: {
    id: string;
    name: string;
    domain: string | null;
  };
  admin: {
    userId: string;
    email: string | null;
  };
}

export interface RejectionPayload extends NotificationPayload {
  reason: string;
}

export interface CorrectionPayload extends NotificationPayload {
  issues: string[];
}

export interface InTransitPayload {
  load: {
    id: string;
    sequenceNumber: number;
    scheduledSlotEnd: string; // ETA
    driverName: string | null;
    driverPhone: string | null;
    totalJointsPlanned: number | null;
  };
  company: {
    id: string;
    name: string;
    domain: string | null;
  };
}

export interface CompletionPayload {
  load: {
    id: string;
    sequenceNumber: number;
    completedAt: string;
    actualJointsReceived: number;
    rackLocation: string;
  };
  company: {
    id: string;
    name: string;
    domain: string | null;
  };
  inventory: {
    totalOnSite: number;
    availableCapacity: number;
  };
}

// ============================================================================
// NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Notify customer that their load has been approved by admin
 * @param payload - Load, company, and admin information
 */
export async function notifyLoadApproved(payload: NotificationPayload): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('[notificationService] Slack webhook not configured - skipping notification');
    return;
  }

  const { load, company, admin } = payload;
  const slotDate = new Date(load.scheduledSlotStart).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const slotTime = new Date(load.scheduledSlotStart).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ Load Approved - Ready for Delivery',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Company:*\n${company.name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Load #:*\n${load.sequenceNumber}`,
          },
          {
            type: 'mrkdwn',
            text: `*Scheduled Delivery:*\n${slotDate} at ${slotTime}`,
          },
          {
            type: 'mrkdwn',
            text: `*Trucking Company:*\n${load.truckingCompany || 'Not specified'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Driver:*\n${load.driverName || 'Not specified'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Pipe Quantity:*\n${load.totalJointsPlanned || 0} joints`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Approved by admin user ${admin.email || admin.userId}`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    console.log(`[notificationService] Load ${load.id} approval notification sent to ${company.name}`);
  } catch (error) {
    console.error('[notificationService] Failed to send approval notification:', error);
    // Don't throw - notification failure shouldn't block approval
  }
}

/**
 * Notify customer that their load has been rejected by admin
 * @param payload - Load, company, admin, and rejection reason
 */
export async function notifyLoadRejected(payload: RejectionPayload): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('[notificationService] Slack webhook not configured - skipping notification');
    return;
  }

  const { load, company, admin, reason } = payload;
  const slotDate = new Date(load.scheduledSlotStart).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '❌ Load Rejected',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Company:*\n${company.name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Load #:*\n${load.sequenceNumber}`,
          },
          {
            type: 'mrkdwn',
            text: `*Scheduled Date:*\n${slotDate}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Rejection Reason:*\n${reason}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Rejected by admin user ${admin.email || admin.userId}. Customer can reschedule or contact support.`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    console.log(`[notificationService] Load ${load.id} rejection notification sent to ${company.name}`);
  } catch (error) {
    console.error('[notificationService] Failed to send rejection notification:', error);
    // Don't throw - notification failure shouldn't block rejection
  }
}

/**
 * Notify customer that admin needs corrections to manifest data
 * @param payload - Load, company, admin, and list of issues
 */
export async function notifyManifestCorrectionNeeded(payload: CorrectionPayload): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('[notificationService] Slack webhook not configured - skipping notification');
    return;
  }

  const { load, company, admin, issues } = payload;
  const issuesList = issues.map(issue => `• ${issue}`).join('\n');

  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Manifest Correction Needed',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Company:*\n${company.name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Load #:*\n${load.sequenceNumber}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Issues Found:*\n${issuesList}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please re-upload your manifest with corrected information or contact MPS support for assistance.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Requested by admin user ${admin.email || admin.userId}`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    console.log(`[notificationService] Manifest correction request sent to ${company.name}`);
  } catch (error) {
    console.error('[notificationService] Failed to send correction request:', error);
    // Don't throw - notification failure shouldn't block request
  }
}

/**
 * Notify customer that their load is in transit (truck departed)
 * @param payload - Load and company information
 */
export async function notifyLoadInTransit(payload: InTransitPayload): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('[notificationService] Slack webhook not configured - skipping notification');
    return;
  }

  const { load, company } = payload;
  const eta = new Date(load.scheduledSlotEnd).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚛 Load In Transit - On the Way',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Company:*\n${company.name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Load #:*\n${load.sequenceNumber}`,
          },
          {
            type: 'mrkdwn',
            text: `*Driver:*\n${load.driverName || 'Not specified'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Driver Phone:*\n${load.driverPhone || 'Not specified'}`,
          },
          {
            type: 'mrkdwn',
            text: `*ETA:*\n${eta}`,
          },
          {
            type: 'mrkdwn',
            text: `*Expected Joints:*\n${load.totalJointsPlanned || 0} joints`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Your delivery is on the way to MPS facility. We\'ll notify you when the truck arrives and unloading is complete.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Track your delivery status in your dashboard',
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    console.log(`[notificationService] Load ${load.id} in-transit notification sent to ${company.name}`);
  } catch (error) {
    console.error('[notificationService] Failed to send in-transit notification:', error);
    // Don't throw - notification failure shouldn't block status update
  }
}

/**
 * Notify customer that their load has been completed (arrived and unloaded)
 * @param payload - Load, company, and inventory information
 */
export async function notifyLoadCompleted(payload: CompletionPayload): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn('[notificationService] Slack webhook not configured - skipping notification');
    return;
  }

  const { load, company, inventory } = payload;
  const completedDate = new Date(load.completedAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ Load Completed - Stored at MPS',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Company:*\n${company.name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Load #:*\n${load.sequenceNumber}`,
          },
          {
            type: 'mrkdwn',
            text: `*Completed:*\n${completedDate}`,
          },
          {
            type: 'mrkdwn',
            text: `*Joints Received:*\n${load.actualJointsReceived} joints`,
          },
          {
            type: 'mrkdwn',
            text: `*Storage Location:*\n${load.rackLocation}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Inventory Summary*',
        },
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Pipe On Site:*\n${inventory.totalOnSite} joints`,
          },
          {
            type: 'mrkdwn',
            text: `*Available Capacity:*\n${inventory.availableCapacity} joints remaining`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Your pipe has been unloaded and stored. You can now schedule your next delivery if needed.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'View your inventory in the dashboard or contact support@mpsgroup.com',
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    console.log(`[notificationService] Load ${load.id} completion notification sent to ${company.name}`);
  } catch (error) {
    console.error('[notificationService] Failed to send completion notification:', error);
    // Don't throw - notification failure shouldn't block completion
  }
}

// ============================================================================
// EMAIL STUB (Future Implementation)
// ============================================================================

/**
 * TODO: Email notification implementation
 *
 * When ready to add email support:
 * 1. Install email service (Resend already configured in .env)
 * 2. Create email templates matching Slack message structure
 * 3. Add email channel preference to company settings
 * 4. Update functions above to call both sendSlackNotification() and sendEmailNotification()
 *
 * Payload signature is already shaped for email reuse:
 * - notifyLoadApproved(payload) -> emailService.sendApprovalEmail(payload)
 * - notifyLoadRejected(payload) -> emailService.sendRejectionEmail(payload)
 * - notifyManifestCorrectionNeeded(payload) -> emailService.sendCorrectionEmail(payload)
 */
