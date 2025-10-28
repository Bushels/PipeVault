// Mock Wix Email Service for local development
// In production, this will use Wix's email API

import type { ApiResponse } from '../types';

export interface EmailData {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

// Mock email sending (logs to console in development)
export const sendEmail = async (emailData: EmailData): Promise<ApiResponse<void>> => {
  try {
    console.log('📧 EMAIL SENT:', {
      to: emailData.to,
      subject: emailData.subject,
      body: emailData.body,
    });

    // In production, this would call Wix's email API
    // await wixEmail.sendEmail({
    //   to: emailData.to,
    //   subject: emailData.subject,
    //   body: emailData.body,
    // });

    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: 'Failed to send email' };
  }
};

// Send approval email to customer
export const sendApprovalEmail = async (
  customerEmail: string,
  customerName: string,
  projectReference: string,
  requestNumber: string
): Promise<ApiResponse<void>> => {
  const subject = `Storage Request Approved - ${requestNumber}`;

  const body = `
Dear ${customerName},

Congratulations! Your free storage request ${requestNumber} for project "${projectReference}" has been approved by MPS.

You can now proceed with the next steps:

LOGIN CREDENTIALS:
Username: ${customerEmail}
Password: ${projectReference}

Please save these credentials to access your account and manage your storage.

Next Steps:
1. Log in to the PipeVault portal
2. Schedule your pipe delivery
3. Upload any relevant shipping documents

If you need to arrange trucking, we can provide a quote. Simply select the "Request MPS Trucking Quote" option when scheduling your delivery.

If you have any questions or need assistance, please don't hesitate to contact us.

Best regards,
MPS Team

---
This is an automated message from PipeVault.
  `.trim();

  return sendEmail({
    to: customerEmail,
    subject,
    body,
  });
};

// Send rejection email to customer
export const sendRejectionEmail = async (
  customerEmail: string,
  customerName: string,
  projectReference: string,
  requestNumber: string,
  reason: string
): Promise<ApiResponse<void>> => {
  const subject = `Storage Request Update - ${requestNumber}`;

  const body = `
Dear ${customerName},

Thank you for your storage request ${requestNumber} for project "${projectReference}".

Unfortunately, we are unable to approve your request at this time.

Reason: ${reason}

If you have any questions or would like to discuss alternative options, please contact us directly.

Best regards,
MPS Team

---
This is an automated message from PipeVault.
  `.trim();

  return sendEmail({
    to: customerEmail,
    subject,
    body,
  });
};

// Send quote provided notification
export const sendQuoteEmail = async (
  customerEmail: string,
  customerName: string,
  projectReference: string,
  quoteAmount: number
): Promise<ApiResponse<void>> => {
  const subject = `Trucking Quote for ${projectReference}`;

  const body = `
Dear ${customerName},

We have prepared a trucking quote for your project "${projectReference}".

Quote Amount: $${quoteAmount.toFixed(2)}

To accept this quote and schedule your delivery, please log in to the PipeVault portal using your credentials.

If you have any questions about this quote, please contact us.

Best regards,
MPS Team

---
This is an automated message from PipeVault.
  `.trim();

  return sendEmail({
    to: customerEmail,
    subject,
    body,
  });
};

// Send delivery confirmation email
export const sendDeliveryConfirmationEmail = async (
  customerEmail: string,
  customerName: string,
  projectReference: string,
  deliveryNumber: string,
  deliveryDate: string,
  deliveryTime: string
): Promise<ApiResponse<void>> => {
  const subject = `Delivery Scheduled - ${deliveryNumber}`;

  const body = `
Dear ${customerName},

Your pipe delivery has been scheduled for project "${projectReference}".

Delivery Details:
- Delivery Number: ${deliveryNumber}
- Date: ${deliveryDate}
- Time: ${deliveryTime}

Please ensure your trucking company arrives at the scheduled time. If you need to make any changes, please log in to the PipeVault portal.

Best regards,
MPS Team

---
This is an automated message from PipeVault.
  `.trim();

  return sendEmail({
    to: customerEmail,
    subject,
    body,
  });
};

// Send pickup confirmation email
export const sendPickupConfirmationEmail = async (
  customerEmail: string,
  customerName: string,
  projectReference: string,
  pickupNumber: string,
  pickupDate: string,
  pickupTime: string
): Promise<ApiResponse<void>> => {
  const subject = `Pickup Scheduled - ${pickupNumber}`;

  const body = `
Dear ${customerName},

Your pipe pickup has been scheduled for project "${projectReference}".

Pickup Details:
- Pickup Number: ${pickupNumber}
- Date: ${pickupDate}
- Time: ${pickupTime}

Please ensure your trucking company arrives at the scheduled time. If you need to make any changes, please log in to the PipeVault portal.

Best regards,
MPS Team

---
This is an automated message from PipeVault.
  `.trim();

  return sendEmail({
    to: customerEmail,
    subject,
    body,
  });
};
