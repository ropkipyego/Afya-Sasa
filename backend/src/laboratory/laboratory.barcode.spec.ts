import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LaboratoryService } from './laboratory.service';

describe('LaboratoryService specimen barcode', () => {
  function service() {
    const instance = Object.create(LaboratoryService.prototype) as LaboratoryService;
    Object.assign(instance, {
      samples: {
        findOne: jest.fn().mockResolvedValue({
          id: 's1',
          barcode: 'JH-SMP-1',
          type: 'blood',
          collectedAt: new Date(),
          receivedAt: null,
          condition: null,
          request: {
            id: 'r1',
            requestNo: 'JH-LAB-1',
            status: 'sample_collected',
            patient: { id: 'p1', patientNo: 'JH-1', firstName: 'Ann', lastName: 'A' },
          },
        }),
      },
    });
    return instance;
  }

  it('resolves a specimen barcode without changing patient', async () => {
    const lab = service();
    const scan = await lab.findSampleByBarcode('JH-SMP-1');
    expect(scan.identity).toBe('specimen');
    expect(scan.patientId).toBe('p1');
  });

  it('rejects a barcode that belongs to another request', async () => {
    const lab = service();
    await expect(
      lab.scanSample({ barcode: 'JH-SMP-1', expectedRequestId: 'other' }, { user: { sub: 'u1' } } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown barcode', async () => {
    const lab = service();
    Object.assign(lab, { samples: { findOne: jest.fn().mockResolvedValue(null) } });
    await expect(lab.findSampleByBarcode('missing')).rejects.toThrow(NotFoundException);
  });
});
