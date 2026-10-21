import { packReferringDetails, referringFacilityLabel, unpackReferringDetails } from './referral-details';

describe('referring facility and doctor details', () => {
  it('stores facility, doctor name, phone and registration number together', () => {
    const packed = packReferringDetails({
      facility: 'Kitale County Hospital',
      doctorName: 'Jane Wanjiku',
      doctorPhone: '0712345678',
      doctorNumber: 'KMPDC/12345',
    })
    expect(unpackReferringDetails(packed)).toEqual({
      facility: 'Kitale County Hospital',
      doctorName: 'Jane Wanjiku',
      doctorPhone: '0712345678',
      doctorNumber: 'KMPDC/12345',
    })
  })

  it('still reads a plain facility name from older visits', () => {
    expect(unpackReferringDetails('Webuye Hospital').facility).toBe('Webuye Hospital')
    expect(referringFacilityLabel('Webuye Hospital')).toBe('Webuye Hospital')
  })
})
