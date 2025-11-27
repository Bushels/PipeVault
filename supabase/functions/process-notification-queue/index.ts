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
const RESEND_API_KEY = Deno.env.get('RESEND_API'); // Updated to match Supabase secret name
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

  } else if (notification.type === 'load_approved') {
    htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0 0 10px 0; font-size: 28px; }
          .header p { margin: 0; font-size: 16px; opacity: 0.9; }
          .content { padding: 30px; }
          .content p { margin: 0 0 15px 0; }
          .details-box { background: #D1FAE5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981; }
          .details-box h3 { margin: 0 0 15px 0; color: #065F46; font-size: 18px; }
          .details-box ul { margin: 0; padding: 0; list-style: none; }
          .details-box li { padding: 8px 0; border-bottom: 1px solid #A7F3D0; }
          .details-box li:last-child { border-bottom: none; }
          .details-box strong { color: #065F46; }
          .cta-button { display: inline-block; background: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .footer { background: #F9FAFB; padding: 20px; text-align: center; color: #6B7280; font-size: 14px; border-top: 1px solid #E5E7EB; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Load #${payload.loadNumber} Approved!</h1>
            <p>Your delivery has been scheduled</p>
          </div>

          <div class="content">
            <p>Hi <strong>${payload.companyName}</strong> team,</p>
            <p>Great news! Your <strong>Load #${payload.loadNumber}</strong> for storage request <strong>${payload.referenceId}</strong> has been approved and scheduled.</p>

            <div class="details-box">
              <h3>📅 Delivery Details</h3>
              <ul>
                <li><strong>Scheduled Date:</strong> ${payload.scheduledDate}</li>
                <li><strong>Scheduled Time:</strong> ${payload.scheduledTime}</li>
                <li><strong>Trucking Company:</strong> ${payload.truckingCompany}</li>
                <li><strong>Driver:</strong> ${payload.driverName}</li>
                <li><strong>Driver Phone:</strong> ${payload.driverPhone}</li>
                <li><strong>Expected Joints:</strong> ${payload.totalJoints}</li>
              </ul>
            </div>

            <p><strong>What's Next?</strong></p>
            <ul>
              <li>Your driver should arrive at the scheduled time</li>
              <li>Have your manifest ready for upload upon arrival</li>
              <li>Track your load status in real-time on your dashboard</li>
            </ul>

            <a href="https://kylegronning.github.io/PipeVault/" class="cta-button">View Dashboard</a>

            <p>If you need to make any changes or have questions, please contact our team immediately.</p>

            <p>Thank you for choosing MPS Group!</p>
          </div>

          <div class="footer">
            <p>This is an automated notification from PipeVault.</p>
            <p>MPS Group | Free Pipe Storage | pipevault@mpsgroup.ca</p>
          </div>
        </div>
      </body>
      </html>
    `.trim();

    textBody = `
✅ Load #${payload.loadNumber} Approved!

Hi ${payload.companyName} team,

Great news! Your Load #${payload.loadNumber} for storage request ${payload.referenceId} has been approved and scheduled.

📅 DELIVERY DETAILS
- Scheduled Date: ${payload.scheduledDate}
- Scheduled Time: ${payload.scheduledTime}
- Trucking Company: ${payload.truckingCompany}
- Driver: ${payload.driverName}
- Driver Phone: ${payload.driverPhone}
- Expected Joints: ${payload.totalJoints}

WHAT'S NEXT?
- Your driver should arrive at the scheduled time
- Have your manifest ready for upload upon arrival
- Track your load status in real-time on your dashboard

View Dashboard: https://kylegronning.github.io/PipeVault/

If you need to make any changes or have questions, please contact our team immediately.

Thank you for choosing MPS Group!

---
This is an automated notification from PipeVault.
MPS Group | Free Pipe Storage | pipevault@mpsgroup.ca
    `.trim();

  } else if (notification.type === 'load_completed') {
    htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0 0 10px 0; font-size: 28px; }
          .header p { margin: 0; font-size: 16px; opacity: 0.9; }
          .content { padding: 30px; }
          .content p { margin: 0 0 15px 0; }
          .details-box { background: #DBEAFE; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3B82F6; }
          .details-box h3 { margin: 0 0 15px 0; color: #1E40AF; font-size: 18px; }
          .details-box ul { margin: 0; padding: 0; list-style: none; }
          .details-box li { padding: 8px 0; border-bottom: 1px solid #BFDBFE; }
          .details-box li:last-child { border-bottom: none; }
          .details-box strong { color: #1E40AF; }
          .highlight-box { background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B; }
          .cta-button { display: inline-block; background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .footer { background: #F9FAFB; padding: 20px; text-align: center; color: #6B7280; font-size: 14px; border-top: 1px solid #E5E7EB; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Load #${payload.loadNumber} Delivered!</h1>
            <p>Your pipe is now safely stored at MPS</p>
          </div>

          <div class="content">
            <p>Hi <strong>${payload.companyName}</strong> team,</p>
            <p>Excellent news! <strong>Load #${payload.loadNumber}</strong> has been successfully delivered and your pipe is now in secure storage.</p>

            <div class="details-box">
              <h3>📦 Delivery Summary</h3>
              <ul>
                <li><strong>Joints Received:</strong> ${payload.jointsReceived}</li>
                <li><strong>Total Length:</strong> ${payload.totalLength} ft</li>
                <li><strong>Total Weight:</strong> ${payload.totalWeight} tonnes</li>
                <li><strong>Storage Location:</strong> ${payload.rackLocation}</li>
              </ul>
            </div>

            <div class="highlight-box">
              <p style="margin: 0;"><strong>📊 Project Total:</strong> ${payload.projectTotalJoints} joints now in storage for request ${payload.referenceId}</p>
            </div>

            <p><strong>What You Can Do Now:</strong></p>
            <ul>
              <li>View detailed inventory breakdown on your dashboard</li>
              <li>Schedule additional loads if needed</li>
              <li>Request outbound shipment when ready</li>
            </ul>

            <a href="https://kylegronning.github.io/PipeVault/" class="cta-button">View Inventory</a>

            <p>Your pipe is secure and ready whenever you need it. Thank you for trusting MPS Group with your storage needs!</p>
          </div>

          <div class="footer">
            <p>This is an automated notification from PipeVault.</p>
            <p>MPS Group | Free Pipe Storage | pipevault@mpsgroup.ca</p>
          </div>
        </div>
      </body>
      </html>
    `.trim();

    textBody = `
🎉 Load #${payload.loadNumber} Delivered!

Hi ${payload.companyName} team,

Excellent news! Load #${payload.loadNumber} has been successfully delivered and your pipe is now in secure storage.

📦 DELIVERY SUMMARY
- Joints Received: ${payload.jointsReceived}
- Total Length: ${payload.totalLength} ft
- Total Weight: ${payload.totalWeight} tonnes
- Storage Location: ${payload.rackLocation}

📊 PROJECT TOTAL
${payload.projectTotalJoints} joints now in storage for request ${payload.referenceId}

WHAT YOU CAN DO NOW
- View detailed inventory breakdown on your dashboard
- Schedule additional loads if needed
- Request outbound shipment when ready

View Inventory: https://kylegronning.github.io/PipeVault/

Your pipe is secure and ready whenever you need it. Thank you for trusting MPS Group with your storage needs!

---
This is an automated notification from PipeVault.
MPS Group | Free Pipe Storage | pipevault@mpsgroup.ca
    `.trim();

  } else if (notification.type === 'load_in_transit') {
    htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0 0 10px 0; font-size: 28px; }
          .header p { margin: 0; font-size: 16px; opacity: 0.9; }
          .content { padding: 30px; }
          .content p { margin: 0 0 15px 0; }
          .details-box { background: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B; }
          .details-box h3 { margin: 0 0 15px 0; color: #92400E; font-size: 18px; }
          .details-box ul { margin: 0; padding: 0; list-style: none; }
          .details-box li { padding: 8px 0; border-bottom: 1px solid #FDE68A; }
          .details-box li:last-child { border-bottom: none; }
          .details-box strong { color: #92400E; }
          .cta-button { display: inline-block; background: #F59E0B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .footer { background: #F9FAFB; padding: 20px; text-align: center; color: #6B7280; font-size: 14px; border-top: 1px solid #E5E7EB; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚛 Load #${payload.loadNumber} En Route!</h1>
            <p>Your delivery is on the way to MPS</p>
          </div>

          <div class="content">
            <p>Hi <strong>${payload.companyName}</strong> team,</p>
            <p><strong>Load #${payload.loadNumber}</strong> for storage request <strong>${payload.referenceId}</strong> is now in transit to MPS Group.</p>

            <div class="details-box">
              <h3>🚚 Transit Details</h3>
              <ul>
                <li><strong>Driver:</strong> ${payload.driverName}</li>
                <li><strong>Driver Phone:</strong> ${payload.driverPhone}</li>
                <li><strong>Estimated Arrival:</strong> ${payload.eta}</li>
                <li><strong>Expected Joints:</strong> ${payload.totalJoints}</li>
              </ul>
            </div>

            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Driver is en route to MPS facility</li>
              <li>We'll inspect and count upon arrival</li>
              <li>You'll receive confirmation once delivery is complete</li>
              <li>Track real-time status on your dashboard</li>
            </ul>

            <a href="https://kylegronning.github.io/PipeVault/" class="cta-button">Track Load</a>

            <p>We'll notify you as soon as your pipe is safely stored.</p>
          </div>

          <div class="footer">
            <p>This is an automated notification from PipeVault.</p>
            <p>MPS Group | Free Pipe Storage | pipevault@mpsgroup.ca</p>
          </div>
        </div>
      </body>
      </html>
    `.trim();

    textBody = `
🚛 Load #${payload.loadNumber} En Route!

Hi ${payload.companyName} team,

Load #${payload.loadNumber} for storage request ${payload.referenceId} is now in transit to MPS Group.

🚚 TRANSIT DETAILS
- Driver: ${payload.driverName}
- Driver Phone: ${payload.driverPhone}
- Estimated Arrival: ${payload.eta}
- Expected Joints: ${payload.totalJoints}

NEXT STEPS
- Driver is en route to MPS facility
- We'll inspect and count upon arrival
- You'll receive confirmation once delivery is complete
- Track real-time status on your dashboard

Track Load: https://kylegronning.github.io/PipeVault/

We'll notify you as soon as your pipe is safely stored.

---
This is an automated notification from PipeVault.
MPS Group | Free Pipe Storage | pipevault@mpsgroup.ca
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
