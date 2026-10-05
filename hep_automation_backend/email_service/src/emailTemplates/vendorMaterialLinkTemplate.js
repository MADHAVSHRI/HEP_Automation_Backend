const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDate = (value) => {
  if (!value) return "Not specified";

  const dateValue =
    typeof value === "string"
      ? value.slice(0, 10)
      : value;

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

const vendorMaterialLinkTemplate = ({
  companyName,
  referenceNo,
  link,
  validFrom,
  validTo,
  departmentName,
}) => {
  const safeCompanyName =
    escapeHtml(companyName || "Vendor");

  const safeReferenceNo =
    escapeHtml(referenceNo);

  const safeDepartmentName =
    escapeHtml(
      departmentName ||
        "Chennai Port Authority"
    );

  /*
   * The link comes from our own frontend URL, but encode it
   * before inserting it into an HTML attribute.
   */
  const safeLink = escapeHtml(link);

  return `
    <div style="
      font-family:Arial,Helvetica,sans-serif;
      color:#1f2937;
      max-width:620px;
      margin:0 auto;
      background:#ffffff;
    ">
      <div style="
        background:linear-gradient(90deg,#f97316,#f59e0b);
        color:#ffffff;
        padding:20px 24px;
        border-radius:8px 8px 0 0;
      ">
        <h2 style="margin:0;">
          Chennai Port — Material Movement Pass
        </h2>

        <p style="
          margin:6px 0 0;
          font-size:13px;
          opacity:0.9;
        ">
          Issued by ${safeDepartmentName}
        </p>
      </div>

      <div style="
        border:1px solid #fde7d2;
        border-top:none;
        padding:24px;
        border-radius:0 0 8px 8px;
      ">
        <p>
          Dear ${safeCompanyName},
        </p>

        <p style="line-height:1.6;">
          ${safeDepartmentName} has initiated a Material
          Movement Pass application for your company.
          Please use the secure link below to enter the
          material, vehicle and responsible-person details
          and submit the application for review.
        </p>

        <p style="
          margin:26px 0;
          text-align:center;
        ">
          <a
            href="${safeLink}"
            style="
              background:#f97316;
              color:#ffffff;
              text-decoration:none;
              padding:13px 24px;
              border-radius:6px;
              font-weight:600;
              display:inline-block;
            "
          >
            Open Material Pass Form
          </a>
        </p>

        <table style="
          width:100%;
          margin-top:20px;
          border-collapse:collapse;
          font-size:14px;
        ">
          <tr>
            <td style="
              padding:8px 0;
              color:#64748b;
              width:42%;
            ">
              Reference Number
            </td>

            <td style="
              padding:8px 0;
              font-weight:600;
            ">
              ${safeReferenceNo}
            </td>
          </tr>

          <tr>
            <td style="
              padding:8px 0;
              color:#64748b;
            ">
              Valid From
            </td>

            <td style="
              padding:8px 0;
              font-weight:600;
            ">
              ${formatDate(validFrom)}
            </td>
          </tr>

          <tr>
            <td style="
              padding:8px 0;
              color:#64748b;
            ">
              Valid Up To
            </td>

            <td style="
              padding:8px 0;
              font-weight:600;
            ">
              ${formatDate(validTo)}
            </td>
          </tr>

          <tr>
            <td style="
              padding:8px 0;
              color:#64748b;
            ">
              Concerned Department
            </td>

            <td style="
              padding:8px 0;
              font-weight:600;
            ">
              ${safeDepartmentName}
            </td>
          </tr>
        </table>

        <div style="
          margin-top:22px;
          padding:12px 14px;
          background:#fff7ed;
          border-left:4px solid #f97316;
          border-radius:4px;
          font-size:13px;
          line-height:1.5;
        ">
          <strong>Important:</strong>
          This link is unique to your company and material
          movement application. Do not share or forward it
          to unauthorized persons.
        </div>

        <p style="
          margin-top:22px;
          font-size:12px;
          color:#64748b;
          line-height:1.5;
        ">
          The application must be submitted within the
          validity period shown above. If the button does
          not work, copy and paste the following address
          into your browser:
        </p>

        <p style="
          font-size:12px;
          word-break:break-all;
          color:#2563eb;
        ">
          ${safeLink}
        </p>

        <p style="margin-top:24px;">
          Regards,<br />
          Chennai Port Authority
        </p>
      </div>
    </div>
  `;
};

module.exports =
  vendorMaterialLinkTemplate;