# AfyaSasa Integrations

## SMS

Set `SMS_PROVIDER` to one of:

- `stub` — local development; no external SMS is sent (logs succeed).
- `celcom_africa` (alias `celcom`) — **Celcom Africa ISMS** (recommended for Kenya / Jalaram).
- `africas_talking` — Africa's Talking.
- `twilio` — Twilio.

Bulk send from Control Center → Notifications, or `POST /api/v1/notifications/sms/bulk`.

### Celcom Africa (recommended)

1. Log into [Celcom Africa ISMS](https://isms.celcomafrica.com) and copy **API key**, **Partner ID**, and approved **Sender ID / shortcode**.
2. Put them in `.env` and restart the API:

```env
SMS_PROVIDER=celcom_africa
SMS_SENDER_NAME=JALARAM
CELCOM_API_KEY=your-api-key
CELCOM_PARTNER_ID=your-partner-id
CELCOM_SHORTCODE=JALARAM
# Optional override:
# CELCOM_SMS_URL=https://isms.celcomafrica.com/api/services/sendsms/
```

API body (also used by the bulk UI):

```json
{
  "mobiles": ["0712345678", "254700000000"],
  "message": "Dear patient, your appointment is tomorrow at 9am. — Jalaram Hospital"
}
```

Numbers are normalized to `254…` before send. Multiple mobiles go in one Celcom request (comma-separated).

### Africa's Talking

```env
SMS_PROVIDER=africas_talking
SMS_SENDER_NAME=JALARAM
AFRICAS_TALKING_USERNAME=sandbox
AFRICAS_TALKING_API_KEY=...
```

### Twilio

```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+15551234567
```

## Object storage

The app supports MinIO locally and S3-compatible object storage in production.

```env
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=afyasasa
S3_SECRET_ACCESS_KEY=afyasasa123
S3_BUCKET=afyasasa-clinical-files
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

Signed URL endpoints:

- `POST /api/v1/storage/presign-upload`
- `POST /api/v1/storage/presign-download`

Clinical modules should store only the returned object key/path in their attachment tables.
