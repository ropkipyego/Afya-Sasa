import { ForbiddenException } from '@nestjs/common';
import {
  assertBloodBankIssueReady,
  assertBloodBankRequestTransition,
  assertCanIssueBlood,
} from './blood-bank-policy';
import { primaryUnitBucket, summariseBloodUnits } from './blood-bank-stock';

describe('blood bank request gates', () => {
  it('blocks skipping grouping and crossmatch', () => {
    expect(() => assertBloodBankRequestTransition('requested', 'issued')).toThrow(/Cannot move/);
    expect(() => assertBloodBankRequestTransition('issued', 'requested')).toThrow(/Cannot move/);
  });

  it('requires recorded grouping and crossmatch before issue', () => {
    expect(() => assertBloodBankIssueReady({ groupingResult: 'O+', crossmatchResult: '' })).toThrow(
      /Issue is blocked/,
    );
    expect(() =>
      assertBloodBankIssueReady({ groupingResult: 'O+', crossmatchResult: 'compatible' }),
    ).not.toThrow();
  });

  it('denies issue without lab_results:verify', () => {
    expect(() => assertCanIssueBlood(['lab_results:enter'])).toThrow(ForbiddenException);
    expect(() => assertCanIssueBlood(['lab_results:verify'])).not.toThrow();
  });
});

describe('blood unit stock buckets', () => {
  const now = new Date('2026-10-20T12:00:00.000Z');

  it('excludes unscreened, quarantined, reserved, issued and expired units from available stock', () => {
    const summary = summariseBloodUnits(
      [
        {
          unitNo: 'A',
          bloodGroup: 'O+',
          status: 'available',
          screeningStatus: 'released',
          expiresAt: '2026-12-01',
          updatedAt: '2026-10-19T10:00:00.000Z',
        },
        {
          unitNo: 'B',
          bloodGroup: 'O+',
          status: 'available',
          screeningStatus: 'awaiting_screening',
          expiresAt: '2026-12-01',
        },
        {
          unitNo: 'C',
          bloodGroup: 'A+',
          status: 'reserved',
          screeningStatus: 'released',
          expiresAt: '2026-12-01',
          reservedRequestId: 'req-1',
        },
        {
          unitNo: 'D',
          bloodGroup: 'B+',
          status: 'issued',
          screeningStatus: 'released',
          expiresAt: '2026-12-01',
          issuedAt: '2026-10-18T08:00:00.000Z',
        },
        {
          unitNo: 'E',
          bloodGroup: 'O-',
          status: 'available',
          screeningStatus: 'released',
          expiresAt: '2026-10-01',
        },
      ],
      { start: new Date('2026-10-01T00:00:00.000Z'), end: new Date('2026-10-31T23:59:59.000Z') },
      now,
    );
    expect(summary.availableForIssue).toBe(1);
    expect(summary.reserved).toBe(1);
    expect(summary.expired).toBe(1);
    expect(summary.quarantinedOrAwaitingScreening).toBe(1);
    expect(summary.issuedInPeriod).toBe(1);
    expect(summary.physicalOnHand).toBe(4);
    expect(summary.byGroup['O+']).toBe(2);
    expect(summary.lastStockUpdate).toBe('2026-10-19T10:00:00.000Z');
  });

  it('does not count an issued unit as on the shelf', () => {
    expect(
      primaryUnitBucket(
        {
          unitNo: 'X',
          bloodGroup: 'O+',
          status: 'issued',
          screeningStatus: 'released',
          expiresAt: '2026-12-01',
        },
        now,
      ),
    ).toBe('issued');
  });
});
