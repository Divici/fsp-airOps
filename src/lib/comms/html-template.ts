// ---------------------------------------------------------------------------
// HTML Email Template — responsive, inline-styled wrapper for branded emails
// ---------------------------------------------------------------------------

export interface HtmlTemplateOptions {
  body: string;
  subject?: string;
  brandColor: string;
  logoUrl?: string;
  operatorName: string;
  unsubscribeUrl?: string;
}

/**
 * Wrap plain-text body content in a responsive HTML email template.
 *
 * Uses table-based layout with inline styles for maximum email client
 * compatibility. The template includes:
 * - Optional logo at top
 * - Colored header bar using the operator's brand color
 * - Body content area with clean sans-serif typography
 * - Footer with operator name, "Powered by AirOps", and optional unsubscribe
 */
export function wrapInHtmlTemplate(options: HtmlTemplateOptions): string {
  const {
    body,
    subject,
    brandColor,
    logoUrl,
    operatorName,
    unsubscribeUrl,
  } = options;

  // Convert plain text line breaks to <br> for HTML rendering
  const htmlBody = escapeHtml(body).replace(/\n/g, "<br>");

  const logoSection = logoUrl
    ? `<tr>
        <td align="center" style="padding: 24px 0 16px 0;">
          <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(operatorName)}" style="max-width: 180px; max-height: 60px; height: auto; display: block;" />
        </td>
      </tr>`
    : "";

  const unsubscribeSection = unsubscribeUrl
    ? ` | <a href="${escapeHtml(unsubscribeUrl)}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${subject ? escapeHtml(subject) : ""}</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .fallback-font { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <!-- Main container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          ${logoSection}
          <!-- Header bar -->
          <tr>
            <td style="background-color: ${escapeHtml(brandColor)}; padding: 16px 24px;">
              <p style="margin: 0; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 18px; font-weight: 600;">
                ${subject ? escapeHtml(subject) : escapeHtml(operatorName)}
              </p>
            </td>
          </tr>
          <!-- Body content -->
          <tr>
            <td style="padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1f2937;">
              ${htmlBody}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; border-top: 1px solid #e5e7eb; background-color: #f9fafb;">
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #9ca3af; text-align: center;">
                ${escapeHtml(operatorName)} &middot; Powered by AirOps${unsubscribeSection}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Escape HTML special characters to prevent injection. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
