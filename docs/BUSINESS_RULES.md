# Business rules

This document separates confirmed facts from assumptions. Do not implement unconfirmed values.

## Confirmed facts

- TASHIRA processes UAE visa applications.
- Production application data and documents contain sensitive customer PII.
- Stripe is used for online payment.
- MySQL hosted on the production server is the intended production database.
- The production server filesystem is the intended document store.

## Requires business confirmation

### Visa prices

Confirm products, durations, currencies, effective dates, rounding, and change approval.

### Government fees

Confirm fee components, authorities, applicant differences, change frequency, and presentation.

### Service fees

Confirm fixed/percentage fees, processing tiers, disclosures, and refundability.

### VAT treatment

Confirm taxable supplies, rate, place of supply, exemptions, zero rating, inclusive/exclusive presentation, and rounding with qualified finance/legal review.

### Exchange rate

Confirm source, base/quote currencies, update cadence, locking point, markup, precision, and fallback.

### Applicant categories

Confirm single/family/group rules, GCC/residency categories, sponsors, companions, ages, and required documents.

### Refund policy

Confirm eligibility, deadlines, partial refunds, government/service-fee treatment, chargebacks, approval roles, and customer notices.

### Status workflow

Confirm allowed states, transitions, responsible roles, notifications, terminal states, and reopening rules.

### Invoice numbering

Confirm legal format, uniqueness, sequences, credit notes, cancellations, fiscal boundaries, and retention.

### Supplier costing

Confirm supplier assignment, currency, VAT, cost approval, invoice matching, payment status, and profit reporting.
