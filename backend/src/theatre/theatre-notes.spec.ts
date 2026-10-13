const API_NOTE_TYPES = [
  'pre_op_assessment',
  'consent',
  'checklist',
  'intraoperative',
  'operation',
  'findings',
  'post_op',
  'recovery',
];

describe('theatre note types', () => {
  it('rejects the former UI aliases that failed validation', () => {
    expect(API_NOTE_TYPES).not.toContain('pre_op');
    expect(API_NOTE_TYPES).not.toContain('intra_op');
    expect(API_NOTE_TYPES).toContain('operation');
    expect(API_NOTE_TYPES).toContain('recovery');
  });
});
