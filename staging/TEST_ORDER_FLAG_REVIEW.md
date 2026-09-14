# Proposed staging test-order flags — owner review required

No records have been flagged or deleted. Each proposed reference is exact; no name, email or creation-date pattern is used. This list does not authorize changes to any other order.

| ID | Reference | Payment state | USD | Basis |
| --- | --- | --- | ---: | --- |
| 149 | TSH-MTYYW9IT-7747FD | pending | 185.00 | Owner explicitly identified this exact reference as a test application in the payment-audit request. |
| 189 | TSH-PRICE-1789361792834 | pending | 580.00 | Exact synthetic fixture created by the approved price-remediation UAT. |
| 190 | TSH-PRICE-1789361860057 | paid | 580.00 | Exact synthetic price and webhook-remediation fixture; Stripe TEST payment verified. |
| 191 | TSH-MU0RV6AZ-19BED7 | pending | 555.00 | Exact synthetic family fixture in payment-price-uat.json. |
| 192 | TSH-CONSENT-1789363934289 | pending | 185.00 | Exact synthetic fixture in payment-consent-uat.json. |
| 193 | TSH-46427A48FE574D329126F49C2B7C8CBF | paid | 185.00 | Exact synthetic interrupted-confirmation fixture in payment-refresh-uat.json. |
| 194 | TSH-F9AAD6EDBCEF4E50B369EE693F201AB2 | paid | 185.00 | Exact synthetic declined-card and closed-browser fixture in payment-creation-uat.json. |

Requested action after owner approval: set is_test=true for the approved rows only, preserve all records/files and audit history, then verify they disappear from financial totals and default lists while remaining accessible with Show test orders.

Approval status: PENDING. Applied flags: 0.