import { DataSource } from 'typeorm';
import Redis from 'ioredis';

export type Probe = {
  status: 'Healthy' | 'Degraded' | 'Unavailable' | 'Not Configured' | 'Unknown'
  detail: string
  latencyMs?: number
  checkedAt: string
}

function stamp(partial: Omit<Probe, 'checkedAt'>): Probe {
  return { ...partial, checkedAt: new Date().toISOString() }
}

export async function probePostgres(dataSource: DataSource): Promise<Probe> {
  const started = Date.now()
  try {
    await dataSource.query('SELECT 1')
    const latencyMs = Date.now() - started
    return stamp({
      status: latencyMs > 500 ? 'Degraded' : 'Healthy',
      detail: 'PostgreSQL accepted SELECT 1',
      latencyMs,
    })
  } catch {
    return stamp({ status: 'Unavailable', detail: 'PostgreSQL query failed', latencyMs: Date.now() - started })
  }
}

export async function probeRedis(host?: string, port?: number): Promise<Probe> {
  if (!host) return stamp({ status: 'Not Configured', detail: 'REDIS_HOST is empty' })
  const started = Date.now()
  const redis = new Redis({ host, port: port ?? 6379, maxRetriesPerRequest: 1, connectTimeout: 1500, lazyConnect: true })
  try {
    await redis.connect()
    const pong = await redis.ping()
    const latencyMs = Date.now() - started
    await redis.quit().catch(() => undefined)
    return stamp({
      status: pong === 'PONG' ? 'Healthy' : 'Degraded',
      detail: 'Redis PING completed',
      latencyMs,
    })
  } catch {
    await redis.quit().catch(() => undefined)
    return stamp({ status: 'Unavailable', detail: 'Redis PING failed', latencyMs: Date.now() - started })
  }
}

export async function probeHttp(url: string | undefined, label: string): Promise<Probe> {
  if (!url) return stamp({ status: 'Not Configured', detail: `${label} endpoint is empty` })
  const started = Date.now()
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
    const latencyMs = Date.now() - started
    if (response.ok) {
      return stamp({ status: 'Healthy', detail: `${label} responded ${response.status}`, latencyMs })
    }
    return stamp({ status: 'Degraded', detail: `${label} responded ${response.status}`, latencyMs })
  } catch {
    return stamp({
      status: 'Unknown',
      detail: `${label} HEAD failed. Credential presence is not treated as connectivity.`,
      latencyMs: Date.now() - started,
    })
  }
}
