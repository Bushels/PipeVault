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
 * Sends a notification to Slack when a trucking quote is requested
 * @param quoteNumber - The quote number (e.g., PV-0001)
 * @param companyName - The company name
 * @param contactEmail - Contact email of the requestor
 * @param originAddress - Storage yard address where pipe is located
 * @param referenceId - The project reference ID
 */
export const sendTruckingQuoteRequest = async (
  quoteNumber: string,
  companyName: string,
  contactEmail: string,
  originAddress: string,
  referenceId: string
): Promise<void> => {
  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚛 New Trucking Quote Request',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Quote Number:*\n${quoteNumber}`
          },
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
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Pickup Location:*\n${originAddress}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⏰ *Action Required:* Calculate distance and provide trucking quote in PipeVault Admin Dashboard.'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '💰 Create Quote',
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
            text: `📅 Requested: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|just now> | ⏱️ Customer expects quote within 24-48 hours`
          }
        ]
      }
    ]
  };

  await sendSlackMessage(message);
};

/**
 * Sends a notification to Slack when a trucking quote is approved by customer
 * @param quoteNumber - The quote number (e.g., PV-0001)
 * @param companyName - The company name
 * @param quotedAmount - The approved quote amount
 * @param originAddress - Storage yard address
 */
export const sendTruckingQuoteApproved = async (
  quoteNumber: string,
  companyName: string,
  quotedAmount: number,
  originAddress: string
): Promise<void> => {
  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ Trucking Quote Approved',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Quote Number:*\n${quoteNumber}`
          },
          {
            type: 'mrkdwn',
            text: `*Company:*\n${companyName}`
          },
          {
            type: 'mrkdwn',
            text: `*Approved Amount:*\n$${quotedAmount.toFixed(2)}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Pickup Location:*\n${originAddress}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🎉 *Action Required:* Coordinate trucking logistics and schedule delivery.'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📋 View Details',
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
            text: `📅 Approved: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|just now>`
          }
        ]
      }
    ]
  };

  await sendSlackMessage(message);
};

/**
 * Sends a notification when a customer schedules an inbound delivery
 */
export const sendInboundDeliveryNotification = async (payload: {
  referenceId: string;
  companyName: string;
  contactEmail: string;
  slotStart: string;
  slotEnd: string;
  isAfterHours: boolean;
  surchargeAmount: number;
  storage: {
    companyName: string;
    address: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
  };
  trucking: {
    companyName: string;
    driverName?: string | null;
    driverPhone?: string | null;
  };
  loadSummary?: {
    total_joints?: number | null;
    total_length_ft?: number | null;
    total_weight_lbs?: number | null;
  } | null;
}) => {
  const slotStart = new Date(payload.slotStart);
  const slotEnd = new Date(payload.slotEnd);
  const slotStartEpoch = Math.floor(slotStart.getTime() / 1000);
  const slotEndEpoch = Math.floor(slotEnd.getTime() / 1000);

  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Inbound Delivery Scheduled',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Project Reference:*
${payload.referenceId}` },
          { type: 'mrkdwn', text: `*Company:*
${payload.companyName}` },
          { type: 'mrkdwn', text: `*Requested By:*
${payload.contactEmail}` },
          { type: 'mrkdwn', text: `*Trucking Company:*
${payload.trucking.companyName || 'Customer Provided'}` }
        ]
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Scheduled Slot:*
<!date^${slotStartEpoch}^{date_short_pretty} at {time}|${slotStart.toLocaleString()}>`
          },
          {
            type: 'mrkdwn',
            text: `*Ends:*
<!date^${slotEndEpoch}^{date_short_pretty} at {time}|${slotEnd.toLocaleString()}>`
          }
        ]
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Storage Yard:*
${payload.storage.companyName}` },
          { type: 'mrkdwn', text: `*Address:*
${payload.storage.address}` },
          { type: 'mrkdwn', text: `*Contact:*
${payload.storage.contactName}` },
          { type: 'mrkdwn', text: `*Phone:*
${payload.storage.contactPhone}` }
        ]
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Driver:*\n${payload.trucking.driverName || 'TBD'}` },
          { type: 'mrkdwn', text: `*Driver Phone:*\n${payload.trucking.driverPhone || 'TBD'}` },
          {
            type: 'mrkdwn',
            text:
              payload.loadSummary?.total_joints !== undefined && payload.loadSummary?.total_joints !== null
                ? `*Joints:*\n${payload.loadSummary.total_joints}`
                : '*Joints:*\nPending',
          },
          {
            type: 'mrkdwn',
            text:
              payload.loadSummary?.total_length_ft !== undefined && payload.loadSummary?.total_length_ft !== null
                ? `*Length (ft):*\n${payload.loadSummary.total_length_ft}`
                : '*Length (ft):*\nPending',
          }
        ]
      },
      payload.isAfterHours
        ? {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `After-hours delivery. Apply surcharge of $${payload.surchargeAmount}.`
              }
            ]
          }
        : {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Standard receiving hours slot.'
              }
            ]
          },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Scheduled: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|just now>`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Trucking request logged automatically—no Portal follow-up required.'
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

