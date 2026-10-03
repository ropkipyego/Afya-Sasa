import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.AGENT_PORT || 7845);
const DEVICE_KEY = process.env.BIOMETRIC_DEVICE_KEY || '';
const DEVICE_SECRET = process.env.BIOMETRIC_DEVICE_SECRET || '';
const API = (process.env.AFYASASA_API || 'http://127.0.0.1:8080/api/v1').replace(/\/$/, '');
const BRIDGE = process.env.DP_SDK_BRIDGE || '';

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(body));
}

function hmac(nonce, capturedAt) {
  const secretHash = createHash('sha256').update(DEVICE_SECRET).digest('hex');
  return createHash('sha256').update(`${secretHash}:${nonce}:${capturedAt}`).digest('hex');
}

async function runBridge(operation, finger) {
  if (!BRIDGE) {
    return {
      result: 'device_error',
      readerState: 'SDK_UNAVAILABLE',
      lastError: 'SDK_UNAVAILABLE: install the HID DigitalPersona SDK and set DP_SDK_BRIDGE',
    };
  }
  return new Promise((resolve) => {
    const args = [operation];
    if (finger) args.push(`--finger=${finger}`);
    const child = spawn(BRIDGE, args, { timeout: 25_000 });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      resolve({
        result: 'device_error',
        readerState: 'ERROR',
        lastError: error.message,
      });
    });
    child.on('close', (code) => {
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch {
        resolve({
          result: code === 0 ? 'cancelled' : 'device_error',
          readerState: 'ERROR',
          lastError: stderr.trim() || 'DigitalPersona bridge returned a non-JSON payload',
        });
      }
    });
  });
}

async function deviceState() {
  if (!BRIDGE) {
    return {
      sdk: 'SDK_UNAVAILABLE',
      readerPresent: false,
      lastError: 'SDK_UNAVAILABLE: HID DigitalPersona SDK is not installed on this workstation.',
    };
  }
  const probe = await runBridge('status');
  const text = `${probe.readerState || ''} ${probe.lastError || ''} ${probe.sdk || ''}`.toUpperCase();
  if (text.includes('SDK_UNAVAILABLE')) {
    return { sdk: 'SDK_UNAVAILABLE', readerPresent: false, lastError: probe.lastError || text };
  }
  if (text.includes('DEVICE_DISCONNECTED') || probe.readerPresent === false) {
    return {
      sdk: 'DEVICE_DISCONNECTED',
      readerPresent: false,
      lastError: probe.lastError || 'DEVICE_DISCONNECTED',
    };
  }
  if (probe.result === 'device_error') {
    return { sdk: 'ERROR', readerPresent: false, lastError: probe.lastError || 'DEVICE_ERROR' };
  }
  if (probe.readerState === 'DEVICE_READY' || probe.sdk === 'DEVICE_READY' || probe.readerPresent === true) {
    return { sdk: 'DEVICE_READY', readerPresent: true, lastError: null };
  }
  return {
    sdk: 'ERROR',
    readerPresent: false,
    lastError: probe.lastError || 'Official SDK did not confirm DEVICE_READY',
  };
}

async function heartbeat(state) {
  if (!DEVICE_KEY || !DEVICE_SECRET) return;
  await fetch(`${API}/biometrics/devices/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceKey: DEVICE_KEY,
      deviceSecret: DEVICE_SECRET,
      agentVersion: '1.1.0-dp4500',
      status: state.sdk === 'DEVICE_READY' ? 'online' : 'offline',
      readerState: state.sdk,
      lastError: state.lastError || undefined,
    }),
  }).catch(() => undefined);
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    json(response, 204, {});
    return;
  }
  const url = new URL(request.url || '/', `http://127.0.0.1:${PORT}`);
  if (request.method === 'GET' && url.pathname === '/health') {
    const state = await deviceState();
    json(response, 200, {
      status: 'ok',
      agent: 'ok',
      deviceKey: DEVICE_KEY || null,
      sdkBridge: Boolean(BRIDGE),
      sdk: state.sdk,
      readerPresent: state.readerPresent,
      lastError: state.lastError,
    });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/device') {
    const state = await deviceState();
    json(response, 200, {
      provider: 'digitalpersona_4500',
      deviceKey: DEVICE_KEY || null,
      sdk: state.sdk,
      readerPresent: state.readerPresent,
      lastError: state.lastError,
    });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/cancel') {
    json(response, 200, { result: 'cancelled' });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/capture') {
    const operation = url.searchParams.get('operation') || 'verify';
    const finger = url.searchParams.get('finger') || undefined;
    const state = await deviceState();
    if (state.sdk !== 'DEVICE_READY') {
      json(response, 503, {
        deviceKey: DEVICE_KEY,
        operation,
        result: 'device_error',
        readerState: state.sdk,
        lastError: state.lastError,
        capturedAt: new Date().toISOString(),
        nonce: randomUUID(),
      });
      return;
    }
    const capturedAt = new Date().toISOString();
    const nonce = randomUUID();
    const sdk = await runBridge(operation, finger);
    if (sdk.result === 'enrolled' || sdk.result === 'verified') {
      if (!sdk.externalSubjectId && !(sdk.candidates || []).length) {
        json(response, 503, {
          deviceKey: DEVICE_KEY,
          operation,
          result: 'device_error',
          readerState: 'ERROR',
          lastError: 'Official SDK did not return a capture subject. No match was invented.',
          capturedAt,
          nonce,
        });
        return;
      }
    }
    json(response, sdk.result === 'device_error' ? 503 : 200, {
      deviceKey: DEVICE_KEY,
      operation,
      result: sdk.result,
      externalSubjectId: sdk.externalSubjectId,
      externalReference: sdk.externalReference,
      confidence: sdk.confidence,
      qualityLabel: sdk.qualityLabel,
      qualityScore: sdk.qualityScore,
      fingerPosition: finger || sdk.fingerPosition,
      candidates: sdk.candidates,
      capturedAt,
      nonce,
      deviceHmac: DEVICE_SECRET ? hmac(nonce, capturedAt) : undefined,
      readerState: sdk.readerState || 'DEVICE_READY',
      lastError: sdk.lastError,
    });
    return;
  }
  json(response, 404, { error: 'not_found' });
});

server.listen(PORT, '127.0.0.1', async () => {
  const state = await deviceState();
  void heartbeat(state);
  setInterval(async () => {
    void heartbeat(await deviceState());
  }, 60_000);
});
