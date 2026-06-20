# AfyaSasa Integrations

## SMS

Set `SMS_PROVIDER` to one of:

- `stub` - local development; no external SMS is sent.
- `africas_talking` - sends through Africa's Talking.
- `twilio` - sends through Twilio.

### Africa's Talking

```env
SMS_PROVIDER=africas_talking
SMS_SENDER_NAME=AfyaSasa
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
