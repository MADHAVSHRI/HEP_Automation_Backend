/**
 * _correctionParts.js
 *
 * Shared fragments for the two emails that ask an applicant to fix a batch,
 * so a rejection and a return read consistently.
 */

/**
 * Renders the officer's per-row verdicts so the applicant can see exactly which
 * people or vehicles need attention, rather than one batch-level sentence.
 */
function renderIssueList(issues) {
  const items = Array.isArray(issues?.items) ? issues.items : [];
  if (!items.length) return "";

  const rows = items
    .map(
      (i) => `
        <tr>
          <td style="padding:10px 12px; border-bottom:1px solid #fee2e2; font-weight:600; color:#7f1d1d;">
            ${i.label || "—"}${i.identifier ? `<br/><span style="font-weight:400; font-size:12px; color:#b91c1c;">${i.identifier}</span>` : ""}
          </td>
          <td style="padding:10px 12px; border-bottom:1px solid #fee2e2; font-size:13px; color:#991b1b;">
            ${i.reason || "Marked for correction"}
          </td>
        </tr>`
    )
    .join("");

  return `
      <h3 style="margin-top:24px; margin-bottom:8px; font-size:14px; color:#7f1d1d;">
        What needs to be corrected (${items.length})
      </h3>
      <table style="width:100%; border-collapse:collapse; background:#fef2f2; border-radius:6px; overflow:hidden;">
        <tr>
          <th style="text-align:left; padding:10px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#b91c1c; border-bottom:1px solid #fecaca;">Entry</th>
          <th style="text-align:left; padding:10px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#b91c1c; border-bottom:1px solid #fecaca;">Reason</th>
        </tr>
        ${rows}
      </table>`;
}

/** Call-to-action returning the applicant to their pre-filled batch. */
function renderCorrectionCta(uploadLink) {
  if (!uploadLink) return "";
  return `
      <p style="margin:24px 0; text-align:center;">
        <a href="${uploadLink}"
           style="background:#f97316; color:#fff; text-decoration:none;
                  padding:12px 24px; border-radius:6px; font-weight:600;
                  display:inline-block;">
          Open &amp; Correct This Batch
        </a>
      </p>
      <p style="font-size:13px; color:#475569;">
        Your previously submitted details are already filled in — you only need to fix the entries listed above.
        If the button doesn't work, copy this URL into your browser:
      </p>
      <p style="word-break:break-all; font-size:13px;">
        <a href="${uploadLink}" style="color:#2563eb;">${uploadLink}</a>
      </p>`;
}

module.exports = { renderIssueList, renderCorrectionCta };
