# Central email configuration (Jalaram Hospital)

Approved sender: `noreply@jalaram.co.ke`. SMTP secrets stay in the server environment. Production delivery remains disabled until ICT verifies staging.

## Environment variables

| Variable | Meaning |
| --- | --- |
| `EMAIL_DELIVERY_ENABLED` | Deployment kill-switch. Default `false`. Control Center cannot turn this on by itself. |
| `SMTP_HOST` | Outgoing server. Jalaram mailbox: `mail.jalaram.co.ke`. |
| `SMTP_PORT` | `465` (recommended implicit TLS) or `587` (STARTTLS). |
| `SMTP_TLS_MODE` | `implicit` or `starttls`. Certificate verification is always on. |
| `SMTP_USER` | SMTP auth username (`noreply@jalaram.co.ke`). Never returned by APIs. |
| `SMTP_PASSWORD` | SMTP auth password. Deployment secret only. Never Git, UI, logs, or API. |
| `SMTP_FROM` | Must be `noreply@jalaram.co.ke`. |
| `SMTP_FROM_NAME` | Display name. Default `Jalaram Hospital`. |
| `SMTP_CONNECTION_TIMEOUT_MS` | Connect/greeting/socket timeout. Default 10000. |
| `SMTP_MAX_ATTEMPTS` | Retries after SMTP failure, before acceptance only. Max 5. |
| `EMAIL_PUBLIC_ORIGIN` / `APP_PUBLIC_URL` | Trusted origin for reset and report links. Never taken from `Host`. |
| `EMAIL_RECIPIENT_ALLOWLIST` | Approved recipients. Empty is **not** safe. |
| `EMAIL_ALLOW_UNRESTRICTED_RECIPIENTS` | Must be explicit `true` to send without an allowlist. Default `false`. |
| `EMAIL_POLICY_AUTH` / `_ACCOUNT` / `_OPERATIONAL` / `_REPORTS` | Category switches. Default true, still gated by delivery flags. |
| `EMAIL_GOVERNMENT_NOTIFY_ALLOWLIST` | Extra allowlist for government *notifications* (not submissions). |

## Control Center

Section **Email configuration** (`settings:manage`):

- SMTP status without credentials
- Operator delivery toggle (second gate after the env kill-switch)
- Category policies
- Recipient allowlist (persisted in tenant `clinical_catalog.emailOperations`, not as SMTP secrets)
- Verify connection and allowlisted test send
- Last verify / last test / recent attempts

Password-reset, password-changed, queued operational email, and authorised report notices all use `MailService`.

## Staging checklist

1. Keep `EMAIL_DELIVERY_ENABLED=false` until ready.
2. Set `SMTP_PASSWORD` only on the staging host, not in Git.
3. Set `EMAIL_RECIPIENT_ALLOWLIST` to named ICT mailboxes.
4. Set `EMAIL_PUBLIC_ORIGIN` to the https staging URL.
5. In Control Center, save the allowlist, leave operator delivery off, run **Verify SMTP connection**.
6. Enable `EMAIL_DELIVERY_ENABLED=true` on staging only, toggle operator delivery, send one allowlisted test.
7. Treat SMTP acceptance as acceptance, not mailbox delivery.

IMAP/CalDAV ports (993/2080) are for mail clients, not AfyaSasa. Confirmed mailbox: `noreply@jalaram.co.ke` / `mail.jalaram.co.ke` SMTP 465 SSL/TLS. Do not enable `EMAIL_DELIVERY_ENABLED` or store `SMTP_PASSWORD` in Git until ICT verifies staging.
