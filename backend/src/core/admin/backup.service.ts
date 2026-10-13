import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const BACKUP_DIR = resolve(process.cwd(), '../backups');
const ALT_BACKUP_DIR = resolve(process.cwd(), 'backups');

@Injectable()
export class BackupInventoryService {
  private readonly logger = new Logger(BackupInventoryService.name);

  scope() {
    return {
      components: [
        {
          id: 'postgres',
          required: true,
          includedByScript: 'ops/backup-postgres.sh',
          note: 'SQL dump of the configured database. Not a full-system backup by itself.',
        },
        {
          id: 'minio',
          required: true,
          includedByScript: null,
          note: 'Clinical files live in object storage. A database dump does not restore files.',
        },
        {
          id: 'redis',
          required: false,
          includedByScript: null,
          note: 'Sessions and queues are ephemeral. Restore does not recover live sessions.',
        },
        {
          id: 'application-config',
          required: true,
          includedByScript: null,
          note: 'Environment secrets must be restored from the deployment secret store, never from a downloadable manifest.',
        },
      ],
      fullSystemBackup: false,
      productionRestoreAllowedFromUi: false,
      scriptStillAvailable: ['ops/backup-postgres.sh', 'ops/restore-postgres.sh'],
    };
  }

  listArchives() {
    const dir = existsSync(BACKUP_DIR) ? BACKUP_DIR : existsSync(ALT_BACKUP_DIR) ? ALT_BACKUP_DIR : null;
    if (!dir) {
      return { directory: null, items: [] as Array<Record<string, unknown>> };
    }
    const items = readdirSync(dir)
      .filter((name) => name.endsWith('.sql') || name.endsWith('.sql.gz'))
      .map((name) => {
        const full = join(dir, name)
        const stat = statSync(full)
        return {
          filename: name,
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          checksum: null as string | null,
          verified: false,
          components: ['postgres'],
        }
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      .slice(0, 50)
    return { directory: dir, items }
  }

  fingerprintName(name: string) {
    return createHash('sha256').update(name).digest('hex').slice(0, 12)
  }

  assertRestoreBlocked() {
    this.logger.warn('UI restore refused — production restore is an authorised operational procedure')
    throw new ForbiddenException(
      'Restore from this screen is blocked. Use the isolated restore procedure. The live hospital database will not be overwritten.',
    )
  }
}
