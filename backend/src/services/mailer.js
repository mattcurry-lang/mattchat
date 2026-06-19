const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASS
  }
})

/**
 * Send a Mattchat message as an email to an external recipient
 */
async function sendEmailNotification({ toEmail, toName, fromUsername, message, conversationId }) {
  const fromAddress = `matt+${fromUsername}@${process.env.MAIL_DOMAIN}`
  const replyTo = fromAddress

  await transporter.sendMail({
    from: `${fromUsername} via Mattchat <noreply@${process.env.MAIL_DOMAIN}>`,
    replyTo,
    to: toEmail,
    subject: `Message from ${fromUsername} on Mattchat`,
    text: `${fromUsername} says:\n\n${message}\n\n---\nReply to this email to respond, or open Mattchat: ${process.env.FRONTEND_URL}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#534AB7;padding:16px 24px;border-radius:12px 12px 0 0;">
          <h2 style="color:white;margin:0;font-size:18px;">Mattchat</h2>
        </div>
        <div style="background:#fafaf8;padding:24px;border:1px solid #e0dfd8;border-top:none;border-radius:0 0 12px 12px;">
          <p style="color:#888780;font-size:13px;margin-bottom:8px;">Message from <strong>${fromUsername}</strong></p>
          <div style="background:white;border-radius:12px;padding:16px;border:1px solid #e0dfd8;font-size:15px;line-height:1.6;color:#1a1a18;">${message}</div>
          <p style="margin-top:20px;font-size:13px;color:#888780;">Reply to this email to respond directly, or <a href="${process.env.FRONTEND_URL}" style="color:#534AB7;">open Mattchat</a>.</p>
        </div>
      </div>
    `
  })
}

module.exports = { sendEmailNotification }
