# Jalaram biometric agent — HID DigitalPersona 4500

This workstation agent is a hardware bridge only.

It does **not** create patients, encounters, charges, or payments.

```text
DigitalPersona 4500
        ↓
HID DigitalPersona Workstation / Biometric SDK
        ↓
this agent (localhost)
        ↓
AfyaSasa /api/v1/biometrics
```

## Official SDK

Install the HID DigitalPersona driver and application SDK for the workstation OS from HID. Do not use Windows Hello as the AfyaSasa integration layer.

This repository does not vendor HID SDK binaries and does not invent USB capture protocol.

Set `DP_SDK_BRIDGE` to a hospital-installed helper that speaks the official SDK. Until that helper is present, capture endpoints return `SDK_UNAVAILABLE` and AfyaSasa keeps the manual patient search fallback.

## Configure

```bash
export AFYASASA_API=http://127.0.0.1:8080/api/v1
export BIOMETRIC_DEVICE_KEY=desk-reception-1
export BIOMETRIC_DEVICE_SECRET=   # issued once by POST /biometrics/devices
export AGENT_PORT=7845
```

Run:

```bash
node server.mjs
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /health | Agent process plus honest SDK/reader state |
| GET | /device | `SDK_UNAVAILABLE`, `DEVICE_DISCONNECTED`, or `DEVICE_READY` from the official HID bridge — never invented |
| POST | /capture | Enrollment / verification / identification capture |
| POST | /cancel | Cancel an in-progress capture |

The browser calls this agent on localhost. The agent returns `deviceKey`, `nonce`, `capturedAt`, and `deviceHmac`. It never returns the device secret.
