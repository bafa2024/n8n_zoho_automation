import nodemailer from 'nodemailer';

/**
 * Email Service for Gmail Notifications
 * Sends summary emails after bill processing
 */

// Environment variables
const GMAIL_USER = process.env.GMAIL_USER || process.env.EMAIL_USER || '';
const GMAIL_PASS = process.env.GMAIL_PASS || process.env.EMAIL_PASS || '';
const EMAIL_TO = process.env.EMAIL_TO || GMAIL_USER || '';
const EMAIL_FROM = GMAIL_USER || 'automation@zoho-bills.local';

/**
 * Create Gmail transporter
 */
function createTransporter() {
  if (!GMAIL_USER || !GMAIL_PASS) {
    throw new Error('Gmail credentials not configured: GMAIL_USER and GMAIL_PASS required');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  });
}

/**
 * Send email summary of bill processing
 * @param summary Summary object with processing details
 */
export async function sendBillSummaryEmail(summary: {
  runId: string;
  invoiceNo?: string | null;
  vendorName: string;
  billId: string;
  billNumber: string;
  newVendor: boolean;
  newItems: string[];
  billLink?: string;
}): Promise<void> {
  // Skip if email not configured
  if (!GMAIL_USER || !GMAIL_PASS || !EMAIL_TO) {
    console.warn('Email not configured, skipping email notification');
    return;
  }

  try {
    const transporter = createTransporter();

    // Build email content
    const subject = `Bill Processed: ${summary.invoiceNo || summary.billNumber} - ${summary.vendorName}`;
    
    let body = `
Bill Processing Summary
======================

Run ID: ${summary.runId}
Invoice Number: ${summary.invoiceNo || 'N/A'}
Vendor: ${summary.vendorName}
Bill ID: ${summary.billId}
Bill Number: ${summary.billNumber}
${summary.billLink ? `Bill Link: ${summary.billLink}` : ''}

Processing Details:
-------------------
`;

    if (summary.newVendor) {
      body += `✓ New vendor created: ${summary.vendorName}\n`;
    } else {
      body += `✓ Vendor found: ${summary.vendorName}\n`;
    }

    if (summary.newItems.length > 0) {
      body += `\n✓ New items created (${summary.newItems.length}):\n`;
      summary.newItems.forEach((item, index) => {
        body += `  ${index + 1}. ${item}\n`;
      });
    } else {
      body += `\n✓ All items found (no new items created)\n`;
    }

    body += `\n✓ Bill draft created successfully\n`;

    body += `
---
This is an automated message from Zoho Bills Automation System.
`;

    const mailOptions = {
      from: `"Zoho Bills Automation" <${EMAIL_FROM}>`,
      to: EMAIL_TO,
      subject: subject,
      text: body,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Bill Processing Summary</h2>
            <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
              <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Run ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${summary.runId}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Invoice Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${summary.invoiceNo || 'N/A'}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Vendor:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${summary.vendorName}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Bill ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${summary.billId}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Bill Number:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${summary.billNumber}</td></tr>
              ${summary.billLink ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Bill Link:</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><a href="${summary.billLink}">${summary.billLink}</a></td></tr>` : ''}
            </table>
            
            <h3>Processing Details:</h3>
            <ul>
              <li>${summary.newVendor ? `✓ <strong>New vendor created:</strong> ${summary.vendorName}` : `✓ <strong>Vendor found:</strong> ${summary.vendorName}`}</li>
              ${summary.newItems.length > 0 
                ? `<li>✓ <strong>New items created (${summary.newItems.length}):</strong><ul>${summary.newItems.map(item => `<li>${item}</li>`).join('')}</ul></li>`
                : `<li>✓ <strong>All items found</strong> (no new items created)</li>`
              }
              <li>✓ <strong>Bill draft created successfully</strong></li>
            </ul>
            
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px;">This is an automated message from Zoho Bills Automation System.</p>
          </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully: ${info.messageId}`);
    console.log(`Email sent to: ${EMAIL_TO}`);

  } catch (error: any) {
    console.error('Failed to send email:', error.message);
    // Don't throw - email failure shouldn't break the process
  }
}


