// This is a mock email service. In a real application, this would integrate
// with an email sending service like SendGrid, Mailgun, or AWS SES.

/**
 * Simulates sending an approval email to the customer.
 * @param to - The recipient's email address.
 * @param referenceId - The customer's project reference ID.
 * @param assignedLocation - The storage location assigned by the admin.
 */
export const sendApprovalEmail = (to: string, referenceId: string, assignedLocation: string): void => {
  const subject = `Your PipeVault Storage Request has been Approved! (Ref: ${referenceId})`;
  const body = `
Dear Customer,

Great news! Your storage request for project reference "${referenceId}" has been approved.

Your items have been assigned to the following location in our facility:
${assignedLocation}

You can now log in to the PipeVault portal to view your inventory and chat with our AI assistant about your stored items.

Thank you for choosing PipeVault.

Sincerely,
The PipeVault Team
  `;

  console.log('--- SIMULATING EMAIL ---');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('Body:', body);
  console.log('--- END EMAIL SIMULATION ---');
};

/**
 * Simulates sending a rejection email to the customer.
 * @param to - The recipient's email address.
 * @param referenceId - The customer's project reference ID.
 * @param reason - The reason for rejection provided by the admin.
 */
export const sendRejectionEmail = (to: string, referenceId: string, reason: string): void => {
  const subject = `Update on Your PipeVault Storage Request (Ref: ${referenceId})`;
  const body = `
Dear Customer,

We are writing to inform you about an update on your storage request for project reference "${referenceId}".

Unfortunately, we are unable to approve your request at this time.
Reason provided: ${reason}

If you have any questions or would like to discuss this further, please reply to this email or contact our support team.

We apologize for any inconvenience.

Sincerely,
The PipeVault Team
  `;

  console.log('--- SIMULATING EMAIL ---');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('Body:', body);
  console.log('--- END EMAIL SIMULATION ---');
};
