import { ForbiddenException } from '@nestjs/common';
import { InsuranceService } from './insurance.service';

function serviceWith(mocks: Record<string, unknown>) {
  const service = Object.create(InsuranceService.prototype) as InsuranceService;
  Object.assign(service, mocks);
  return service;
}

const payer = { id: 'payer-sha', type: 'sha' as const, name: 'SHA', active: true, notes: '' };

describe('insurance claim preparation', () => {
  it('rejects a charge that is already on another claim', async () => {
    const persist = jest.fn();
    const service = serviceWith({
      load: async () => ({
        payers: [payer],
        claims: [{ id: 'claim-1', chargeIds: ['chg-used'] }],
      }),
      persist,
      patients: { findOne: async () => ({ id: 'pat-1' }) },
      charges: { find: async () => [] },
    });
    await expect(
      service.prepareClaim(
        { patientId: 'pat-1', payerId: payer.id, chargeIds: ['chg-used'] },
        { user: { sub: 'officer-1' } } as never,
      ),
    ).rejects.toThrow(/already on another claim/);
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects cancelled charges', async () => {
    const persist = jest.fn();
    const service = serviceWith({
      load: async () => ({ payers: [payer], claims: [] }),
      persist,
      patients: { findOne: async () => ({ id: 'pat-1' }) },
      charges: {
        find: async () => [
          {
            id: 'chg-1',
            status: 'cancelled',
            amountOwed: '100',
            amountPaid: '0',
            patient: { id: 'pat-1' },
          },
        ],
      },
    });
    await expect(
      service.prepareClaim(
        { patientId: 'pat-1', payerId: payer.id, chargeIds: ['chg-1'] },
        { user: { sub: 'officer-1' } } as never,
      ),
    ).rejects.toThrow(/Cancelled charges/);
    expect(persist).not.toHaveBeenCalled();
  });

  it('saves a draft from existing patient charges without posting payment', async () => {
    const persist = jest.fn();
    const service = serviceWith({
      load: async () => ({ payers: [payer], claims: [] }),
      persist,
      patients: { findOne: async () => ({ id: 'pat-1' }) },
      charges: {
        find: async () => [
          {
            id: 'chg-1',
            status: 'owed',
            amountOwed: '100',
            amountPaid: '0',
            amountWaived: '0',
            patient: { id: 'pat-1' },
          },
        ],
      },
    });
    const claim = await service.prepareClaim(
      { patientId: 'pat-1', payerId: payer.id, chargeIds: ['chg-1'] },
      { user: { sub: 'officer-1' } } as never,
    );
    expect(claim.status).toBe('draft');
    expect(claim.chargeIds).toEqual(['chg-1']);
    expect(persist).toHaveBeenCalled();
    expect((service as unknown as { payments?: unknown }).payments).toBeUndefined();
  });
});

describe('insurance claim transitions', () => {
  function claimService(status: string, persist = jest.fn()) {
    const claim = {
      id: 'claim-1',
      status,
      chargeIds: ['chg-1'],
      totalCharge: 100,
      approvedAmount: 80,
      patientShare: 20,
      amountReceived: 0,
      externalReference: null,
      history: [],
    };
    const service = serviceWith({
      load: async () => ({ payers: [payer], claims: [claim] }),
      persist,
    });
    return { service, persist, claim };
  }

  it('lets an insurance officer with payments:read record a portal submission', async () => {
    const { service, persist } = claimService('prepared');
    const result = await service.transitionClaim(
      'claim-1',
      { status: 'submitted_manual', externalReference: 'SHA-99', reason: 'Entered on portal.sha.go.ke' },
      { user: { sub: 'officer-1', permissions: ['payments:read'] } } as never,
    );
    expect(result.status).toBe('submitted_manual');
    expect(result.history.at(-1)).toMatchObject({
      actor: 'officer-1',
      reason: 'Entered on portal.sha.go.ke',
      to: 'submitted_manual',
    });
    expect(persist).toHaveBeenCalled();
  });

  it('denies remittance recording without payments:manage', async () => {
    const { service, persist } = claimService('approved');
    await expect(
      service.transitionClaim(
        'claim-1',
        { status: 'settled', reason: 'EFT received' },
        { user: { sub: 'officer-1', permissions: ['payments:read'] } } as never,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(persist).not.toHaveBeenCalled();
  });

  it('records remittance status without creating a payment transaction', async () => {
    const { service, persist } = claimService('approved');
    const result = await service.transitionClaim(
      'claim-1',
      { status: 'settled', reason: 'EFT 80 recorded against existing charges' },
      { user: { sub: 'finance-1', permissions: ['payments:manage'] } } as never,
    );
    expect(result.status).toBe('settled');
    expect(result.cashEquivalent).toBe(true);
    expect(persist).toHaveBeenCalled();
    expect((service as unknown as { payments?: unknown }).payments).toBeUndefined();
  });

  it('requires a reason for material transitions and rejects a second remittance retry as invalid', async () => {
    const { service } = claimService('settled');
    await expect(
      service.transitionClaim(
        'claim-1',
        { status: 'settled', reason: 'retry' },
        { user: { sub: 'finance-1', permissions: ['payments:manage'] } } as never,
      ),
    ).rejects.toThrow(/cannot move from settled/);
  });

  it('requires a reason when cancelling', async () => {
    const { service, persist } = claimService('draft');
    await expect(
      service.transitionClaim(
        'claim-1',
        { status: 'cancelled' },
        { user: { sub: 'officer-1', permissions: ['payments:read'] } } as never,
      ),
    ).rejects.toThrow(/reason/);
    expect(persist).not.toHaveBeenCalled();
  });
});
