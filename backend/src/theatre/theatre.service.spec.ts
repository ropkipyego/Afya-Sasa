import { TheatreService } from './theatre.service';

describe('TheatreService.updateBookingStatus', () => {
  it('frees the theatre when the last active booking completes', async () => {
    const service = Object.create(TheatreService.prototype) as TheatreService;
    const theatresUpdate = jest.fn();
    Object.assign(service, {
      bookings: {
        findOne: jest.fn().mockResolvedValue({
          id: 'bk-1',
          theatre: { id: 'th-1' },
        }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findOneOrFail: jest.fn().mockResolvedValue({ id: 'bk-1', status: 'completed' }),
      },
      theatres: { update: theatresUpdate },
      operationalCharges: {
        getCatalogue: jest.fn().mockResolvedValue({ items: [] }),
        upsertServiceCharge: jest.fn(),
      },
    });

    await service.updateBookingStatus(
      'bk-1',
      { status: 'completed' } as never,
      { user: { sub: 'u1' } } as never,
    );

    expect(theatresUpdate).toHaveBeenCalledWith('th-1', { status: 'available' });
  });

  it('keeps the theatre in use when another case is still scheduled', async () => {
    const service = Object.create(TheatreService.prototype) as TheatreService;
    const theatresUpdate = jest.fn();
    Object.assign(service, {
      bookings: {
        findOne: jest.fn().mockResolvedValue({
          id: 'bk-1',
          theatre: { id: 'th-1' },
        }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
        findOneOrFail: jest.fn().mockResolvedValue({ id: 'bk-1', status: 'completed' }),
      },
      theatres: { update: theatresUpdate },
      operationalCharges: {
        getCatalogue: jest.fn().mockResolvedValue({ items: [] }),
        upsertServiceCharge: jest.fn(),
      },
    });

    await service.updateBookingStatus(
      'bk-1',
      { status: 'completed' } as never,
      { user: { sub: 'u1' } } as never,
    );

    expect(theatresUpdate).not.toHaveBeenCalled();
  });
});
