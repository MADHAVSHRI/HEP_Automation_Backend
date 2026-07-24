const licenseExpiryWarningTemplate = (name, licenseNumber, licenseValidityDate, daysRemaining) => {
  const formatDateLong = (dateVal) => {
    if (!dateVal) return 'N/A';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      const parts = String(dateVal).split('T')[0].split('-');
      if (parts.length === 3) {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = String(parseInt(parts[2], 10)).padStart(2, '0');
        if (months[monthIdx]) return `${day} ${months[monthIdx]} ${year}`;
      }
      return 'N/A';
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-GB', { month: 'long' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const formattedDate = formatDateLong(licenseValidityDate);

  return `
  <div style="font-family: Arial, sans-serif; color:#1f2937; max-width:600px; margin:0 auto;">
    <div style="background: linear-gradient(90deg,#ea580c,#f97316); color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">⚠️ Chennai Port — License Expiry Warning</h2>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">
        Chennai Port Authority
      </p>
    </div>

    <div style="border:1px solid #ffedd5; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
      <p>Dear ${name},</p>

      <p style="background:#ffedd5; padding:12px 16px; border-radius:6px; color:#c2410c; font-weight: 500;">
        <strong>Notice:</strong> Your port entry license (No: <strong>${licenseNumber || 'N/A'}</strong>) will expire in <strong>${daysRemaining} days</strong> on <strong>${formattedDate}</strong>.
      </p>

      <div style="margin-top:20px; padding:16px; background:#fff7ed; border-radius:6px; border-left:4px solid #f97316;">
        <p style="margin:0; font-size:13px; font-weight:bold; color:#9a3412;">
          Pass Issuance Lock Notice:
        </p>
        <p style="margin:4px 0 0; font-size:13px; color:#9a3412;">
          Pass applications exceeding your license validity date will be restricted. Please submit a Profile/License Update Request with your renewed license copy as soon as possible to avoid pass issuance interruption.
        </p>
      </div>

      <p style="margin:24px 0; text-align:center;">
        <a href="http://localhost:3000"
           style="background:#ea580c; color:#fff; text-decoration:none;
                  padding:12px 24px; border-radius:6px; font-weight:600;
                  display:inline-block; font-size:14px;">
          Update License in Portal
        </a>
      </p>

      <p style="margin-top:24px; font-size:12px; color:#94a3b8;">
        This is an automated system warning. Please do not reply directly to this email.
      </p>

      <p style="margin-top:24px;">Regards,<br/><strong>Chennai Port Authority</strong></p>
    </div>
  </div>
  `;
};

module.exports = licenseExpiryWarningTemplate;
