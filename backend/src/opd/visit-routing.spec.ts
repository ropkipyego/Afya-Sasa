import { destinationsForCheckIn, queueTypesForDestinations } from './visit-routing';

describe('diagnostic check-in routing', () => {
  it('sends laboratory-only visits to lab even if the client asked for the doctor queue', () => {
    expect(destinationsForCheckIn('laboratory_only', 'doctor')).toEqual(['laboratory']);
    expect(queueTypesForDestinations(['laboratory'])).toEqual(['LAB']);
  });

  it('sends radiology-only visits (including CT) to imaging', () => {
    expect(destinationsForCheckIn('radiology_only', 'doctor')).toEqual(['radiology']);
    expect(queueTypesForDestinations(['radiology'])).toEqual(['RAD']);
  });

  it('places combined diagnostic visits on both lab and imaging queues', () => {
    expect(destinationsForCheckIn('diagnostic')).toEqual(['laboratory', 'radiology']);
    expect(queueTypesForDestinations(['laboratory', 'radiology'])).toEqual(['LAB', 'RAD']);
  });

  it('keeps ordinary clinic visits on the doctor path', () => {
    expect(destinationsForCheckIn('new')).toEqual(['doctor']);
    expect(destinationsForCheckIn('follow_up', 'doctor')).toEqual(['doctor']);
  });
});
