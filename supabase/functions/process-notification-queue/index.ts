/**
 * Notification Queue Worker - Edge Function
 *
 * Processes queued notifications from the notification_queue table.
 * Sends emails via Resend API and Slack notifications via webhook.
 *
 * Trigger: Cron schedule (every 5 minutes) or manual invocation
 *
 * Flow:
 * 1. Query notification_queue WHERE processed = false
 * 2. For each notification:
 *    - Send email (if type includes email)
 *    - Send Slack notification (if webhook configured)
 *    - Mark as processed on success
 *    - Increment attempts on failure (max 3 retries)
 * 3. Return processing summary
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_WEBHOOK_URL');
const FROM_EMAIL = Deno.env.get('NOTIFICATION_FROM_EMAIL') || 'noreply@pipevault.mpsgroup.ca';
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50; // Process up to 50 notifications per invocation

// Types
interface NotificationQueueEntry {
  id: string;
  type: string;
  payload: NotificationPayload;
  processed: boolean;
  attempts: number;
  last_attempt_at: string | null;
  processed_at: string | null;
  created_at: string;
}

interface NotificationPayload {
  requestId?: string;
  referenceId: string;
  companyName: string;
  userEmail: string;
  subject: string;
  assignedRacks?: string[];
  requiredJoints?: number;
  notes?: string;
  rejectionReason?: string;
  notificationType: 'email' | 'slack' | 'both';
}

interface ProcessingResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Send email via Resend API
 */
async function sendEmail(notification: NotificationQueueEntry): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const { payload } = notification;
  let htmlBody = '';
  let textBody = '';

  // Build email content based on notification type
  if (notification.type === 'storage_request_approved') {
    htmlBody = `
      <h2>Storage Request Approved</h2>
      <p>Dear Customer,</p>
      <p>Your storage request <strong>${payload.referenceId}</strong> has been approved!</p>

      <h3>Details:</h3>
      <ul>
        <li><strong>Company:</strong> ${payload.companyName}</li>
        <li><strong>Reference ID:</strong> ${payload.referenceId}</li>
        <li><strong>Assigned Racks:</strong> ${payload.assignedRacks?.join(', ') || 'N/A'}</li>
        <li><strong>Required Joints:</strong> ${payload.requiredJoints || 'N/A'}</li>
        ${payload.notes ? `<li><strong>Notes:</strong> ${payload.notes}</li>` : ''}
      </ul>

      <p>Please log in to PipeVault to view your storage details and schedule your delivery.</p>

      <p>Thank you for choosing MPS Group!</p>

      <hr>
      <p style="color: #666; font-size: 12px;">This is an automated notification from PipeVault. Please do not reply to this email.</p>
    `;

    textBody = `
Storage Request Approved

Dear Customer,

Your storage request ${payload.referenceId} has been approved!

Details:
- Company: ${payload.companyName}
- Reference ID: ${payload.referenceId}
- Assigned Racks: ${payload.assignedRacks?.join(', ') || 'N/A'}
- Required Joints: ${payload.requiredJoints || 'N/A'}
${payload.notes ? `- Notes: ${payload.notes}` : ''}

Please log in to PipeVault to view your storage details and schedule your delivery.

Thank you for choosing MPS Group!
    `.trim();

  } else if (notification.type === 'storage_request_rejected') {
    htmlBody = `
      <h2>Storage Request Update</h2>
      <p>Dear Customer,</p>
      <p>We have reviewed your storage request <strong>${payload.referenceId}</strong>.</p>

      <h3>Details:</h3>
      <ul>
        <li><strong>Company:</strong> ${payload.companyName}</li>
        <li><strong>Reference ID:</strong> ${payload.referenceId}</li>
        <li><strong>Status:</strong> Unable to approve at this time</li>
        <li><strong>Reason:</strong> ${payload.rejectionReason || 'Please contact us for details'}</li>
        ${payload.notes ? `<li><strong>Additional Notes:</strong> ${payload.notes}</li>` : ''}
      </ul>

      <p>Please contact our team to discuss alternative solutions or timing for your storage needs.</p>

      <p>Thank you for your interest in MPS Group!</p>

      <hr>
      <p style="color: #666; font-size: 12px;">This is an automated notification from PipeVault. Please do not reply to this email.</p>
    `;

    textBody = `
Storage Request Update

Dear Customer,

We have reviewed your storage request ${payload.referenceId}.

Details:
- Company: ${payload.companyName}
- Reference ID: ${payload.referenceId}
- Status: Unable to approve at this time
- Reason: ${payload.rejectionReason || 'Please contact us for details'}
${payload.notes ? `- Additional Notes: ${payload.notes}` : ''}

Please contact our team to discuss alternative solutions or timing for your storage needs.

Thank you for your interest in MPS Group!
    `.trim();
  }

  // Send via Resend API
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [payload.userEmail],
      subject: payload.subject,
      html: htmlBody,
      text: textBody,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log(`✅ Email sent successfully:`, { id: result.id, to: payload.userEmail });
}

/**
 * Send Slack notification via webhook
 */
async function sendSlackNotification(notification: NotificationQueueEntry): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.log('⚠️  SLACK_WEBHOOK_URL not configured, skipping Slack notification');
    return;
  }

  const { payload } = notification;
  let message = '';
  let color = '#36a64f'; // Green for approvals

  if (notification.type === 'storage_request_approved') {
    color = '#36a64f'; // Green
    message = `:white_check_mark: *Storage Request Approved*\n\n` +
              `*Company:* ${payload.companyName}\n` +
              `*Reference:* ${payload.referenceId}\n` +
              `*Racks:* ${payload.assignedRacks?.join(', ') || 'N/A'}\n` +
              `*Joints:* ${payload.requiredJoints || 'N/A'}\n` +
              `*Customer:* ${payload.userEmail}`;
  } else if (notification.type === 'storage_request_rejected') {
    color = '#ff0000'; // Red
    message = `:x: *Storage Request Rejected*\n\n` +
              `*Company:* ${payload.companyName}\n` +
              `*Reference:* ${payload.referenceId}\n` +
              `*Reason:* ${payload.rejectionReason || 'See details'}\n` +
              `*Customer:* ${payload.userEmail}`;
  }

  // Send to Slack using Block Kit format
  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color,
        text: message,
        footer: 'PipeVault Notification',
        ts: Math.floor(Date.now() / 1000),
      }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Slack webhook error: ${response.status} ${errorText}`);
  }

  console.log(`✅ Slack notification sent successfully`);
}

/**
 * Process a single notification entry
 */
async function processNotification(
  supabase: any,
  notification: NotificationQueueEntry
): Promise<{ success: boolean; error?: string }> {
  try {
    const { payload } = notification;

    // Send email if required
    if (payload.notificationType === 'email' || payload.notificationType === 'both') {
      await sendEmail(notification);
    }

    // Send Slack notification if required
    if (payload.notificationType === 'slack' || payload.notificationType === 'both') {
      await sendSlackNotification(notification);
    }

    // Mark as processed
    const { error: updateError } = await supabase
      .from('notification_queue')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', notification.id);

    if (updateError) {
      throw new Error(`Failed to mark notification as processed: ${updateError.message}`);
    }

    return { success: true };

  } catch (error) {
    console.error(`❌ Failed to process notification ${notification.id}:`, error);

    // Increment attempt counter
    const newAttempts = notification.attempts + 1;
    const shouldGiveUp = newAttempts >= MAX_ATTEMPTS;

    const { error: updateError } = await supabase
      .from('notification_queue')
      .update({
        attempts: newAttempts,
        last_attempt_at: new Date().toISOString(),
        processed: shouldGiveUp, // Mark as processed if max attempts reached
        processed_at: shouldGiveUp ? new Date().toISOString() : null,
      })
      .eq('id', notification.id);

    if (updateError) {
      console.error(`Failed to update attempt counter:`, updateError);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch unprocessed notifications (limited batch size)
    const { data: notifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('processed', false)
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No notifications to process', processed: 0 }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`📬 Processing ${notifications.length} notifications...`);

    // Process each notification
    const result: ProcessingResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    for (const notification of notifications) {
      const { success, error } = await processNotification(supabase, notification);

      if (success) {
        result.success++;
      } else {
        result.failed++;
        result.errors.push({ id: notification.id, error: error || 'Unknown error' });
      }
    }

    console.log(`✅ Processing complete:`, result);

    return new Response(
      JSON.stringify({
        message: 'Notification processing complete',
        ...result,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Worker error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
