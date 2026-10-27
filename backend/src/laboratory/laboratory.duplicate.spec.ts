import { BadRequestException } from '@nestjs/common';
import { LaboratoryService } from './laboratory.service';

describe('LaboratoryService duplicate open orders', () => {
  it('blocks a second FBC while the first is still processing', async () => {
    const lab = Object.create(LaboratoryService.prototype) as LaboratoryService;
    Object.assign(lab, {
      items: {
        find: jest.fn().mockResolvedValue([
          {
            test: { id: 't-fbc', name: 'FBC' },
            panel: null,
            orderableTest: null,
            request: { requestNo: 'LAB-1', status: 'processing' },
          },
        ]),
      },
    });

    await expect(
      (
        lab as unknown as {
          assertNoOpenDuplicateOnEncounter: (
            encounterId: string,
            itemRows: Array<{ test: { id: string; name: string } | null; panel: null; orderableTest: null }>,
          ) => Promise<void>;
        }
      ).assertNoOpenDuplicateOnEncounter('enc-1', [
        { test: { id: 't-fbc', name: 'FBC' }, panel: null, orderableTest: null },
      ]),
    ).rejects.toThrow(BadRequestException);
    await expect(
      (
        lab as unknown as {
          assertNoOpenDuplicateOnEncounter: (
            encounterId: string,
            itemRows: Array<{ test: { id: string; name: string } | null; panel: null; orderableTest: null }>,
          ) => Promise<void>;
        }
      ).assertNoOpenDuplicateOnEncounter('enc-1', [
        { test: { id: 't-fbc', name: 'FBC' }, panel: null, orderableTest: null },
      ]),
    ).rejects.toThrow(/LAB-1/);
  });

  it('allows a different test on the same visit', async () => {
    const lab = Object.create(LaboratoryService.prototype) as LaboratoryService;
    Object.assign(lab, {
      items: {
        find: jest.fn().mockResolvedValue([
          {
            test: { id: 't-fbc', name: 'FBC' },
            panel: null,
            orderableTest: null,
            request: { requestNo: 'LAB-1', status: 'requested' },
          },
        ]),
      },
    });

    await expect(
      (
        lab as unknown as {
          assertNoOpenDuplicateOnEncounter: (
            encounterId: string,
            itemRows: Array<{ test: { id: string; name: string } | null; panel: null; orderableTest: null }>,
          ) => Promise<void>;
        }
      ).assertNoOpenDuplicateOnEncounter('enc-1', [
        { test: { id: 't-uec', name: 'UEC' }, panel: null, orderableTest: null },
      ]),
    ).resolves.toBeUndefined();
  });
});
