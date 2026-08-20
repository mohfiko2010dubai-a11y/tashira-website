# TASHIRA Finance Cockpit Report

## Data sources

The cockpit uses paid application price snapshots, payment states, append-only refund/chargeback events, timeline abandonment events, applicants, and versioned finance settings. It does not accept totals calculated by the browser.

## Metrics

- Revenue, supplier cost, internal cost, gross profit, gross margin, and average order value.
- Payment successes, failures, and success rate.
- Refund requests and chargebacks.
- Checkout abandonment.
- Top visa types and applicant countries.
- Monthly paid-order revenue trend and a transparent average-month forecast.
- Configurable VAT registration threshold progress, remaining amount, warning levels, and estimated threshold date.

The VAT monitor is configurable operational monitoring. It does not encode UAE legal tests or determine VAT liability.

## Business Health Score

The score is a visible weighted sum: payment reliability (40), gross margin (30), chargeback exposure (20), and paid-order data availability (10). Every component and maximum is returned to the UI. It is not an AI decision and cannot change prices, VAT, refunds, or payments.

## AI CFO foundation

The typed cockpit response is the future read-only AI input boundary. It exposes aggregated metrics only. No AI mutation endpoint exists.
