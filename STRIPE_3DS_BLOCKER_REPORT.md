# Stripe TEST 3DS staging blocker

Date: 2026-08-13  
Branch: `devops/deployment-safety`  
Application: `TSH-372754`  
Amount: USD 185.00

## Finding

The staging Stripe account is an AE TEST account whose account API reports
`charges_enabled: false` and the `card_payments` capability as `inactive`.
Stripe Elements rejects the official authentication-required test card before
confirmation, so the existing PaymentIntent remains `requires_payment_method`
with no `last_payment_error` and no payment attempt.

The following alternatives were excluded with redacted/PAN-free checks:

- The staging publishable and secret keys belong to the same Stripe account.
- The PaymentIntent is TEST mode, USD 185.00, and allows `card` (and `link`).
- CardElement has no brand allowlist or custom card-number validation.
- `hidePostalCode: true` remains configured, so no fake postal code is required.
- The PaymentIntent/PaymentMethod flow supports 3DS: Stripe's predefined
  authentication-required TEST PaymentMethod returned `authentication_required`.
- No application or Stripe error log contains the application reference or card
  credentials. Application telemetry records only a normalized Stripe error code.

## Resolution boundary

No application-code workaround can activate an inactive Stripe account
capability. The Stripe account owner must complete/resolve Stripe's card-payment
capability requirements in the Stripe Dashboard or with Stripe Support. After
Stripe reports card payments active, staging must be retested with Stripe's
documented authentication-required TEST PaymentMethod and the owner must complete the interactive browser
challenge. Interactive 3DS completion is not claimed by this report.

Production was not accessed or changed. Staging was not deployed because no
safe repository fix can resolve an account capability restriction.
