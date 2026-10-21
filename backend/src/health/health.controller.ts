import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../core/auth/auth.decorators';

export const READY_TIMEOUT_MS = 1500;

export async function databaseIsReachable(
  dataSource: Pick<DataSource, 'query'>,
  timeoutMs = READY_TIMEOUT_MS,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      dataSource.query('SELECT 1'),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('ready-timeout')), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Public()
@Controller()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get('health')
  check() {
    return { status: 'ok', service: 'afyasasa-backend' };
  }

  @Get('ready')
  async ready(@Res() response: Response) {
    const ok = await databaseIsReachable(this.dataSource);
    return response.status(ok ? 200 : 503).json({
      status: ok ? 'ready' : 'not_ready',
      service: 'afyasasa-backend',
    });
  }
}
