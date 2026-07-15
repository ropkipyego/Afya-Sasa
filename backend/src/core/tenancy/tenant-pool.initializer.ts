import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getTenantSchema } from './tenant-context.storage';

const SAFE_SCHEMA = /^[a-z][a-z0-9_]*$/i;

type QueryableClient = {
  query: (...args: unknown[]) => Promise<unknown>;
  __afyaTenantQueryPatched?: boolean;
};

type PgPool = {
  on(event: 'connect', listener: (client: QueryableClient) => void): void;
};

function installTenantRouting(client: QueryableClient): void {
  if (client.__afyaTenantQueryPatched) return;
  client.__afyaTenantQueryPatched = true;

  const originalQuery = client.query.bind(client);
  let activeSchema: string | null = null;

  client.query = (...args: unknown[]) => {
    const schema = getTenantSchema();
    if (!SAFE_SCHEMA.test(schema)) {
      return originalQuery(...args);
    }

    const run = () => originalQuery(...args);
    if (activeSchema === schema) {
      return run();
    }

    return originalQuery(`SET search_path TO "${schema}", public`).then(() => {
      activeSchema = schema;
      return run();
    });
  };
}

@Injectable()
export class TenantPoolInitializer implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenantPoolInitializer.name);

  constructor(private readonly dataSource: DataSource) {}

  onApplicationBootstrap(): void {
    const pool = (this.dataSource.driver as { master?: PgPool }).master;

    if (!pool?.on) {
      this.logger.warn('Postgres pool not found — tenant search_path routing skipped');
      return;
    }

    pool.on('connect', (client) => {
      installTenantRouting(client);
    });

    this.logger.log('Tenant-aware Postgres pool routing installed');
  }
}
