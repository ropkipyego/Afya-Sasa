import { ForbiddenException } from '@nestjs/common';
import { ExportsService } from './exports.service';

describe('ExportsService authorization', () => {
  const service = Object.create(ExportsService.prototype) as ExportsService;

  it('lists only datasets the caller may export', () => {
    expect(service.listAuthorized(['encounters:read', 'lab_requests:read'])).toEqual([
      { dataset: 'opd', permission: 'encounters:read' },
      { dataset: 'laboratory', permission: 'lab_requests:read' },
    ]);
    expect(service.listAuthorized(['reports:read'])).toEqual([]);
  });

  it('denies a dataset without the matching departmental permission', () => {
    expect(() => service.assertDatasetAccess('finance', ['reports:read'])).toThrow(ForbiddenException);
    expect(() => service.assertDatasetAccess('opd', ['encounters:read'])).not.toThrow();
  });
});
