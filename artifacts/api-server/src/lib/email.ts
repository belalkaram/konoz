import nodemailer from "nodemailer";
import { logger } from "./logger.js";

import { db, systemSettingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

async function getTransporter() {
  const keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass"];
  const rows = await db.select().from(systemSettingsTable).where(inArray(systemSettingsTable.key, keys));
  
  const settings: Record<string, string> = {};
  rows.forEach(r => {
    settings[r.key] = r.value;
  });

  const host = settings.smtp_host || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(settings.smtp_port || process.env.SMTP_PORT || "587");
  const user = settings.smtp_user || process.env.SMTP_USER;
  const pass = settings.smtp_pass || process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const keys = ["smtp_pass", "smtp_user", "smtp_from_name"];
  const rows = await db.select().from(systemSettingsTable).where(inArray(systemSettingsTable.key, keys));
  const settings: Record<string, string> = {};
  rows.forEach(r => {
    settings[r.key] = r.value;
  });

  const pass = settings.smtp_pass || process.env.SMTP_PASS;
  const user = settings.smtp_user || process.env.SMTP_USER;
  const fromName = settings.smtp_from_name || process.env.SMTP_FROM_NAME || "Konoz System";

  if (!pass || pass === "your_gmail_app_password_here") {
    logger.warn("Email not sent: SMTP_PASS is not configured.");
    return;
  }

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to,
      subject,
      html,
    });
    logger.info({ msg: "Email sent", messageId: info.messageId, to });
    return info;
  } catch (error) {
    logger.error({ msg: "Failed to send email", error, to });
    throw error;
  }
}

export async function sendNewTravelerNotification(employeeEmail: string, travelerName: string, details: any) {
  const subject = `✈️ New Traveler Assigned: ${travelerName}`;
  const brandColor = "#064e3b"; // Deep Emerald
  const accentColor = "#d4af37"; // Gold

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, ${brandColor} 0%, #022c22 100%); padding: 32px 24px; text-align: center;">
        <div style="display: inline-block; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 50%; margin-bottom: 16px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <polyline points="16 11 18 13 22 9"></polyline>
          </svg>
        </div>
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">New Traveler Assigned</h1>
        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0 0; font-size: 16px;">A new customer profile has been assigned to you.</p>
      </div>
      
      <div style="padding: 32px 24px;">
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="color: ${brandColor}; margin: 0 0 16px 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">
            Traveler Details
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px;">Full Name</td>
              <td style="padding: 8px 0; color: #1e293b; font-size: 15px; font-weight: 600;">${travelerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Phone</td>
              <td style="padding: 8px 0; color: #1e293b; font-size: 15px;">${details.phone || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">PNR / Ref</td>
              <td style="padding: 8px 0; color: #0f172a; font-size: 15px; font-family: monospace; font-weight: 700; color: ${brandColor};">${details.pnr || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Travel Date</td>
              <td style="padding: 8px 0; color: #1e293b; font-size: 15px;">${details.travelDate ? new Date(details.travelDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center;">
          <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/customers" style="display: inline-block; background: ${accentColor}; color: #022c22; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            View Traveler Profile
          </a>
        </div>
      </div>

      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">
          This is an automated notification from <strong>Konoz System</strong>.<br>
          Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to: employeeEmail, subject, html });
}

export async function sendTripReminderNotification(employeeEmail: string, travelerName: string, departureTime: string) {
  const subject = `⏰ Urgent Reminder: ${travelerName} travels in 24 hours`;
  const brandColor = "#991b1b"; // Deep Red for urgency
  const accentColor = "#ffffff";
  const dateStr = new Date(departureTime).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, ${brandColor} 0%, #7f1d1d 100%); padding: 32px 24px; text-align: center;">
        <div style="display: inline-block; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 50%; margin-bottom: 16px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">24-Hour Trip Reminder</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 16px;">Final preparations required.</p>
      </div>
      
      <div style="padding: 32px 24px; text-align: center;">
        <p style="font-size: 18px; color: #1e293b; margin-top: 0;">
          Hi there, just a reminder that <strong>${travelerName}</strong> is scheduled to travel in exactly one day.
        </p>
        
        <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <div style="font-size: 13px; color: #991b1b; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; letter-spacing: 1px;">Departure Time</div>
          <div style="font-size: 22px; color: #7f1d1d; font-weight: 800;">${dateStr}</div>
        </div>

        <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
          Please ensure all tickets have been issued, visas are checked, and the traveler has been notified of their departure details.
        </p>

        <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/tickets" style="display: inline-block; background: #1e293b; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px;">
          Review Ticket Details
        </a>
      </div>

      <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">
          Sent with care by <strong>Konoz System</strong>.
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to: employeeEmail, subject, html });
}
