/**
 * bulkPassExpiringTemplate.js
 *
 * One-time notice sent a few days before a reusable Bulk Pass link stops
 * accepting batches. The organisation keeps read access to its submission
 * history afterwards, so the message is about the closing window, not about
 * losing anything.
 */
const bulkPassExpiringTemplate = ({
  companyName,
  refNo,
  validityUpto,
  daysRemaining,
  submissionsCount,
  uploadLink,
}) => {
  const { formatValidityDate } = require("../utils/formatDate");
  const validUpto = formatValidityDate(validityUpto);
  const days = Number(daysRemaining);
  const whenPhrase =
    !Number.isFinite(days) || days <= 0
      ? "today"
      : days === 1
      ? "tomorrow"
      : `in ${days} days`;

  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#f97316,#f59e0b); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Bulk Pass Closing Soon</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority
      </p>
    </div>

    <div style="border:1px solid #fde7d2; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${companyName || "Applicant"},</p>

      <p style="background:#fff7ed; border:1px solid #fed7aa; padding:12px 16px; border-radius:6px; color:#9a3412;">
        Your bulk pass <strong>${refNo}</strong> stops accepting new batches
        <strong>${whenPhrase}</strong>. If you still have people or vehicles to send,
        please submit them before then.
      </p>

      <table style="width:100%; margin-top:24px; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0; color:#64748b;">Bulk Pass</td>
          <td style="padding:6px 0; font-weight:600;">${refNo}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Accepting submissions until</td>
          <td style="padding:6px 0; font-weight:600;">${validUpto}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Batches submitted so far</td>
          <td style="padding:6px 0; font-weight:600;">${submissionsCount ?? 0}</td>
        </tr>
      </table>

      ${uploadLink ? `
      <p style="margin:24px 0; text-align:center;">
        <a href="${uploadLink}"
           style="background:#f97316; color:#fff; text-decoration:none;
                  padding:12px 24px; border-radius:6px; font-weight:600;
                  display:inline-block;">
          Submit Another Batch
        </a>
      </p>

      <p style="font-size:13px; color:#475569;">
        If the button above doesn't work, copy and paste this URL into your browser:
      </p>
      <p style="word-break:break-all; font-size:13px;">
        <a href="${uploadLink}" style="color:#2563eb;">${uploadLink}</a>
      </p>` : ""}

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        After this date the link will stop accepting new batches, but you will still be able to
        open it to view everything you have already submitted.
        This is an automated reminder sent once — please do not reply.
      </p>

      <p style="margin-top:24px;">Regards,<br/>Chennai Port Authority</p>
    </div>
  </div>
  `;
};

module.exports = bulkPassExpiringTemplate;
