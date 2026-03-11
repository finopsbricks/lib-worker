/**
 * Email utility using Zepto Mail API
 *
 * Sends transactional email with optional file attachments.
 * Env vars: ZEPTOMAIL_API_KEY, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME
 */

/**
 * Send an email via Zepto Mail
 *
 * @param {object} options
 * @param {string} options.to - Recipient email address
 * @param {string} [options.toName] - Recipient name
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text body (optional)
 * @param {Array<{name: string, content: string, mime_type: string}>} [options.attachments] - File attachments (base64 content)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail({ to, toName, subject, html, text, attachments }) {
  const api_key = process.env.ZEPTOMAIL_API_KEY;
  const from_address = process.env.EMAIL_FROM_ADDRESS || 'noreply@finopsbricks.com';
  const from_name = process.env.EMAIL_FROM_NAME || 'FinOpsBricks';

  if (!api_key) {
    console.error('[email] ZEPTOMAIL_API_KEY not configured');
    return { success: false, error: 'ZEPTOMAIL_API_KEY not configured' };
  }

  const payload = {
    from: {
      address: from_address,
      name: from_name,
    },
    to: [
      {
        email_address: {
          address: to,
          name: toName || to,
        },
      },
    ],
    subject,
    htmlbody: html,
  };

  if (text) {
    payload.textbody = text;
  }

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments;
  }

  try {
    const response = await fetch('https://api.zeptomail.com/v1.1/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Zoho-enczapikey ${api_key}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error_text = await response.text();
      console.error(`[email] Zepto Mail API error: ${response.status} - ${error_text}`);
      return { success: false, error: `API error ${response.status}: ${error_text}` };
    }

    const result = await response.json();
    console.log(`[email] Email sent successfully to ${to}`);

    return {
      success: true,
      messageId: result.data?.[0]?.message_id || result.message_id,
    };
  } catch (error) {
    console.error(`[email] Failed to send email: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Send email to multiple recipients
 *
 * @param {object} options
 * @param {string[]} options.recipients - Array of email addresses
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text body
 * @param {Array<{name: string, content: string, mime_type: string}>} [options.attachments] - File attachments (base64 content)
 * @returns {Promise<{success: boolean, results: Array}>}
 */
export async function sendEmailToMultiple({ recipients, subject, html, text, attachments }) {
  const results = [];

  for (const to of recipients) {
    const result = await sendEmail({ to, subject, html, text, attachments });
    results.push({ to, ...result });
  }

  const all_success = results.every((r) => r.success);

  return {
    success: all_success,
    results,
  };
}
