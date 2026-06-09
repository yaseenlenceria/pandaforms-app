import nodemailer from "nodemailer";
import db from "./db.server";

interface SendEmailArgs {
  shop: string;
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  success: boolean;
  log: string;
}

export async function sendEmail({
  shop,
  to,
  subject,
  html,
}: SendEmailArgs): Promise<SendEmailResult> {
  try {
    // 1. Fetch SMTP settings for the shop
    const settings = await db.setting.findUnique({
      where: { shop },
    });

    if (
      !settings ||
      !settings.smtpHost ||
      !settings.smtpUser ||
      !settings.smtpPass
    ) {
      return {
        success: false,
        log: "SMTP not configured. Please set up SMTP in the Integrations page.",
      };
    }

    const port = settings.smtpPort || 587;
    const secure = settings.smtpSecure || port === 465;

    // 2. Create nodemailer transport
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: port,
      secure: secure,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
      tls: {
        rejectUnauthorized: false, // Prevents certificate verification failures on some hosts
      },
    });

    const fromAddress = settings.smtpFrom || settings.smtpUser;

    // 3. Send email
    const info = await transporter.sendMail({
      from: `"PandaForms" <${fromAddress}>`,
      to,
      subject,
      html,
    });

    return {
      success: true,
      log: `Email sent successfully. Message ID: ${info.messageId}`,
    };
  } catch (error: any) {
    console.error("SMTP Error sending email:", error);
    return {
      success: false,
      log: `SMTP Error: ${error.message || error}`,
    };
  }
}

// Helper to test SMTP connection
export async function testSMTPConnection(shop: string, testEmail: string): Promise<SendEmailResult> {
  const subject = "PandaForms SMTP Connection Test";
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #4f46e5;">🐼 SMTP Connection Successful!</h2>
      <p>Your SMTP credentials for PandaForms have been verified.</p>
      <p>Outgoing notification emails will now be delivered successfully using your mail server.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <small style="color: #777;">Sent via PandaForms for Shopify.</small>
    </div>
  `;
  return sendEmail({ shop, to: testEmail, subject, html });
}
