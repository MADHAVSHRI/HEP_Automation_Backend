// The names are typed by an agent, so they are escaped before they reach the
// HTML; the link is escaped too, since it sits inside an attribute.
const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const photoCaptureTemplate = ({ personName, agentName, link }) => {
  personName = escapeHtml(personName || "Applicant");
  agentName = escapeHtml(agentName || "An agent");
  link = escapeHtml(link);
  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#0a1e4d,#1a3a7c); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Chennai Port — Photo Capture Request</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Automated Port Access and Control System (APACS)
      </p>
    </div>

    <div style="border:1px solid #d1d5db; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${personName || "Applicant"},</p>

      <p>
        <strong>${agentName || "An agent"}</strong> has initiated a Harbour Entry Permit (HEP)
        pass request on your behalf at Chennai Port. To complete your application,
        please capture your photo using the secure link below.
      </p>

      <p>Please follow these steps:</p>
      <ol style="font-size:14px; color:#374151; line-height:1.8;">
        <li>Click the link below to open the photo capture page.</li>
        <li>Allow camera access when prompted.</li>
        <li>Position your face within the frame and capture your photo.</li>
        <li>Once captured, notify your agent that your photo has been submitted.</li>
      </ol>

      <p style="margin:28px 0; text-align:center;">
        <a href="${link}"
           style="background:#0a1e4d; color:#fff; text-decoration:none;
                  padding:14px 28px; border-radius:6px; font-weight:600;
                  display:inline-block; font-size:15px;">
          Capture Your Face
        </a>
      </p>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:14px 16px; font-size:13px; color:#475569; margin-top:8px;">
        <strong>Link:</strong>
        <a href="${link}" style="color:#0a1e4d; word-break:break-all;">${link}</a>
      </div>

      <p style="margin-top:24px; font-size:13px; color:#6b7280;">
        If you did not expect this email or have questions, please contact your
        agent directly. Do not share this link with others.
      </p>

      <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
      <p style="font-size:12px; color:#9ca3af; text-align:center;">
        Chennai Port Authority — APACS | This is an automated message, please do not reply.
      </p>
    </div>
  </div>
  `;
};

module.exports = photoCaptureTemplate;