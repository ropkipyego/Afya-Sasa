import { labLayoutStatus } from './lab-report-layouts';

describe('lab report layouts', () => {
  it('groups CBC and UEC without inventing reference intervals', () => {
    const cbc = labLayoutStatus('CBC');
    expect(cbc.found).toBe(true);
    expect(JSON.stringify(cbc)).not.toMatch(/interval|normal range/i);
    expect(labLayoutStatus('UEC').parameters.some((row) => row.code === 'K')).toBe(true);
  });
});
