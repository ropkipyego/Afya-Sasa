import { displayAppointmentReason, formatWebsiteReason, isWebsiteBooking } from './website-booking';

describe('website appointment channel', () => {
  it('marks a public booking without a second table', () => {
    expect(isWebsiteBooking(formatWebsiteReason('Follow-up for hypertension'))).toBe(true);
    expect(displayAppointmentReason(formatWebsiteReason('Follow-up for hypertension'))).toBe(
      'Follow-up for hypertension',
    );
  });

  it('does not treat a desk booking as a website booking', () => {
    expect(isWebsiteBooking('Review in medical clinic')).toBe(false);
    expect(displayAppointmentReason('Review in medical clinic')).toBe('Review in medical clinic');
  });
});
