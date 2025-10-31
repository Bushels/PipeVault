// Email service for PipeVault notifications
// Uses Resend API for production, console.log for development

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;
const FROM_EMAIL = 'PipeVault <pipevault@mpsgroup.ca>';
const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Sends an approval email to the customer celebrating their free storage!
 * @param to - The recipient's email address.
 * @param referenceId - The customer's project reference ID.
 * @param assignedLocation - The storage location assigned by the admin.
 */
export const sendApprovalEmail = async (to: string, referenceId: string, assignedLocation: string): Promise<void> => {
  const subject = `Congratulations! Your FREE Pipe Storage has been Approved! 🎉`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
        .highlight { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; }
        .location { background: #D1FAE5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
        .button { background: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">Your FREE Pipe Storage is Approved!</p>
        </div>

        <div class="content">
          <p>Dear Valued Customer,</p>

          <p><strong>Great news!</strong> We're thrilled to inform you that your storage request for project <strong>"${referenceId}"</strong> has been approved!</p>

          <div class="highlight">
            <p style="margin: 0;"><strong>🎊 Celebrating 20 Years of MPS Group!</strong></p>
            <p style="margin: 10px 0 0 0;">As we celebrate two decades of excellence in the energy industry, we're honored to offer you FREE pipe storage as part of our anniversary promotion. Thank you for being part of our journey!</p>
          </div>

          <div class="location">
            <p style="margin: 0; color: #065F46;"><strong>📍 Your Assigned Storage Location:</strong></p>
            <p style="margin: 10px 0 0 0; font-size: 18px; color: #047857;"><strong>${assignedLocation}</strong></p>
          </div>

          <p>We're excited to serve you and happy for this opportunity to support your operations. Your trust in MPS Group means everything to us!</p>

          <p><strong>What's Next?</strong></p>
          <ul>
            <li>Log in to your PipeVault dashboard to view your project details</li>
            <li>Schedule delivery to our facility using the "Schedule Delivery to MPS" option</li>
            <li>Track your inventory and storage timeline</li>
            <li>Chat with Roughneck, our AI assistant, for any questions</li>
          </ul>

          <center>
            <a href="https://kyle gronning.github.io/PipeVault/" class="button">View Your Dashboard</a>
          </center>

          <p>If you have any questions or need assistance, please don't hesitate to reach out to our team at <a href="mailto:pipevault@mpsgroup.ca">pipevault@mpsgroup.ca</a>.</p>

          <p>Thank you for choosing MPS Group!</p>

          <p><strong>The PipeVault Team</strong><br>
          MPS Group - 20 Years of Excellence</p>
        </div>

        <div class="footer">
          <p>MPS Group | Celebrating 20 Years in the Energy Industry | pipevault@mpsgroup.ca</p>
          <p>This email was sent regarding your storage request ${referenceId}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
Congratulations! Your FREE Pipe Storage has been Approved! 🎉

Dear Valued Customer,

Great news! We're thrilled to inform you that your storage request for project "${referenceId}" has been approved!

🎊 Celebrating 20 Years of MPS Group!
As we celebrate two decades of excellence in the energy industry, we're honored to offer you FREE pipe storage as part of our anniversary promotion. Thank you for being part of our journey!

📍 Your Assigned Storage Location:
${assignedLocation}

We're excited to serve you and happy for this opportunity to support your operations. Your trust in MPS Group means everything to us!

What's Next?
• Log in to your PipeVault dashboard to view your project details
• Schedule delivery to our facility using the "Schedule Delivery to MPS" option
• Track your inventory and storage timeline
• Chat with Roughneck, our AI assistant, for any questions

Visit your dashboard: https://kylegronning.github.io/PipeVault/

If you have any questions or need assistance, please reach out at pipevault@mpsgroup.ca.

Thank you for choosing MPS Group!

The PipeVault Team
MPS Group - 20 Years of Excellence
  `;

  await sendEmail(to, subject, htmlBody, textBody);
};

/**
 * Sends a rejection email to the customer with next steps.
 * @param to - The recipient's email address.
 * @param referenceId - The customer's project reference ID.
 * @param reason - The reason for rejection provided by the admin.
 */
export const sendRejectionEmail = async (to: string, referenceId: string, reason: string): Promise<void> => {
  const subject = `Update on Your PipeVault Storage Request (${referenceId})`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4B5563; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
        .reason-box { background: #FEE2E2; padding: 15px; border-left: 4px solid #DC2626; margin: 20px 0; border-radius: 4px; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
        .button { background: #DC2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">Update on Your Storage Request</h1>
          <p style="margin: 10px 0 0 0;">Project Reference: ${referenceId}</p>
        </div>

        <div class="content">
          <p>Dear Valued Customer,</p>

          <p>Thank you for your interest in our FREE pipe storage promotion as we celebrate 20 Years of MPS Group.</p>

          <p>We've reviewed your storage request for project "${referenceId}", and unfortunately, we're unable to approve it at this time.</p>

          <div class="reason-box">
            <p style="margin: 0;"><strong>Reason:</strong></p>
            <p style="margin: 10px 0 0 0;">${reason}</p>
          </div>

          <p><strong>What's Next?</strong></p>
          <ul>
            <li>Reply to this email to discuss your request with our team</li>
            <li>Resubmit with updated information if applicable</li>
            <li>Contact us at <a href="mailto:pipevault@mpsgroup.ca">pipevault@mpsgroup.ca</a> for clarification</li>
          </ul>

          <center>
            <a href="mailto:pipevault@mpsgroup.ca" class="button">Contact Our Team</a>
          </center>

          <p>We're here to help and appreciate your understanding. Thank you for considering MPS Group for your storage needs.</p>

          <p><strong>The PipeVault Team</strong><br>
          MPS Group - 20 Years of Excellence</p>
        </div>

        <div class="footer">
          <p>MPS Group | pipevault@mpsgroup.ca</p>
          <p>This email was sent regarding your storage request ${referenceId}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
Update on Your PipeVault Storage Request (${referenceId})

Dear Valued Customer,

Thank you for your interest in our FREE pipe storage promotion as we celebrate 20 Years of MPS Group.

We've reviewed your storage request for project "${referenceId}", and unfortunately, we're unable to approve it at this time.

Reason: ${reason}

What's Next?
• Reply to this email to discuss your request with our team
• Resubmit with updated information if applicable
• Contact us at pipevault@mpsgroup.ca for clarification

We're here to help and appreciate your understanding. Thank you for considering MPS Group for your storage needs.

The PipeVault Team
MPS Group - 20 Years of Excellence
  `;

  await sendEmail(to, subject, htmlBody, textBody);
};

/**
 * Helper function to send emails via Resend API or log to console in development
 */
async function sendEmail(to: string, subject: string, htmlBody: string, textBody: string): Promise<void> {
  // If Resend API key is not configured, log to console (development mode)
  if (!RESEND_API_KEY || RESEND_API_KEY === 'your_resend_key_here') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 EMAIL (Development Mode - Configure VITE_RESEND_API_KEY to send real emails)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`To: ${to}`);
    console.log(`From: ${FROM_EMAIL}`);
    console.log(`Subject: ${subject}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Text Body:');
    console.log(textBody);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return;
  }

  // Send via Resend API (production mode)
  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Email sent successfully:', data.id);
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    // Fallback to console logging if API fails
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 EMAIL (Fallback - API Failed)');
    console.log(`To: ${to} | Subject: ${subject}`);
    console.log(textBody);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}
