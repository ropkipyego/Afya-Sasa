-- Planned only. Do not apply to production from this programme.
-- Unique checkout / receipt correlation for M-Pesa rows that still carry
-- CheckoutRequestID on external_reference after the callback hardening.
-- Enable only after a read-only duplicate audit of demo.payment_transactions.

-- SELECT external_reference, count(*) FROM demo.payment_transactions
-- WHERE deleted_at IS NULL AND external_reference IS NOT NULL
-- GROUP BY 1 HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_external_reference
  ON demo.payment_transactions (external_reference)
  WHERE deleted_at IS NULL
    AND external_reference IS NOT NULL
    AND status IN ('initiated', 'pending', 'completed');
