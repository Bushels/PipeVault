// Slack notification service for PipeVault
// Sends notifications to admin Slack channel when new storage requests are submitted

const SLACK_WEBHOOK_URL = import.meta.env.VITE_SLACK_WEBHOOK_URL;

/**
 * Sends a notification to Slack when a new storage request is submitted
 * @param referenceId - The customer's project reference ID
 * @param companyName - The company name
 * @param contactEmail - Contact email of the requestor
 * @param itemType - Type of item being stored (e.g., "Pipe", "Casing")
 * @param totalJoints - Total number of joints requested
 * @param storageStartDate - Requested storage start date
 * @param storageEndDate - Requested storage end date
 */
export const sendNewRequestNotification = async (
  referenceId: string,
  companyName: string,
  contactEmail: string,
  itemType: string,
  totalJoints: number,
  storageStartDate: string,
  storageEndDate: string
): Promise<void> => {
  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔔 New Storage Request Submitted',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Project Reference:*\n${referenceId}`
          },
          {
            type: 'mrkdwn',
            text: `*Company:*\n${companyName}`
          },
          {
            type: 'mrkdwn',
            text: `*Contact Email:*\n${contactEmail}`
          },
          {
            type: 'mrkdwn',
            text: `*Item Type:*\n${itemType}`
          },
          {
            type: 'mrkdwn',
            text: `*Quantity:*\n${totalJoints} joints`
          },
          {
            type: 'mrkdwn',
            text: `*Storage Period:*\n${storageStartDate} to ${storageEndDate}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⏰ *Action Required:* Review and approve this request in the PipeVault Admin Dashboard.'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔍 Review in PipeVault',
              emoji: true
            },
            url: 'https://kylegronning.github.io/PipeVault/',
            style: 'primary'
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📅 Submitted: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|just now>`
          }
        ]
      }
    ]
  };

  await sendSlackMessage(message);
};

/**
 * Helper function to send messages to Slack via webhook
 */
async function sendSlackMessage(payload: any): Promise<void> {
  // If Slack webhook URL is not configured, log to console (development mode)
  if (!SLACK_WEBHOOK_URL || SLACK_WEBHOOK_URL === 'your_slack_webhook_url_here') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💬 SLACK NOTIFICATION (Development Mode - Configure VITE_SLACK_WEBHOOK_URL to send real notifications)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Payload:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return;
  }

  // Send to Slack webhook (production mode)
  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send Slack notification: ${error}`);
    }

    console.log('✅ Slack notification sent successfully');
  } catch (error) {
    console.error('❌ Failed to send Slack notification:', error);
    // Fallback to console logging if webhook fails
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💬 SLACK NOTIFICATION (Fallback - Webhook Failed)');
    console.log(JSON.stringify(payload, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}
