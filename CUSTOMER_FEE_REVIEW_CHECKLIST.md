# Mandatory customer fee disclosure review

Owner decision, Launch Master 30 September 2026. Apply this gate to every change in copy, invoice/proforma generation, email templates, assistant responses, and admin fields that feed customer documents.

- Reject any field, interpolation, table, label or static sentence that publishes a specific government-fee amount. Do not approve a government-fee breakdown, even if the internal amount is accurate.
- Check EN and AR output, including generated PDF/text/HTML and template branches. “Government fees included” / “شامل الرسوم الحكومية” is permitted as a category with no government-fee figure attached.
- Trace any new invoice/proforma/email field back to its data source. A safe label does not make an interpolated government-cost value safe. Admin finance amounts remain internal and must not be mapped onto customer output.
- Preserve the Arabic refund wording “الرسوم الحكومية أو رسوم الموردين المتكبدة فعلياً”. No fixed deduction is implied; finance evidence must support actual incurred deductions per order.
- Keep the displayed selling total, Express surcharge and actual customer refund amount distinct from internal government/supplier cost records. This rule does not conceal the customer's total or refundable Express amount.
- VAT remains off. This checklist does not authorize a policy, tax or pricing change.

Evidence required in each affected review: output surface, language, fixture, rendered output checked, result, reviewer. If a surface cannot be rendered, record it as unverified; do not mark this gate passed from a source grep alone.

Launch Master implementation: no new numeric government-fee output fields were added. The visa comparison table reads only regular/Express selling prices; the Express guarantee reads the frozen refundable surcharge. The existing Arabic refund policy body is unchanged.
