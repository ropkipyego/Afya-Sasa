import { buildStructuredLabReportHtml } from './lab-report.builder';

describe('structured laboratory report', () => {
  it('escapes HTML from patient and result text', () => {
    const html = buildStructuredLabReportHtml({
      requestNo: 'JH-LAB-<script>',
      status: 'verified',
      patient: { firstName: '<img>', lastName: 'X', patientNo: 'SYN-<b>' },
      items: [
        {
          orderableTest: { name: 'WBC <panel>' },
          results: [
            {
              id: '1',
              value: '<script>alert(1)</script>',
              flag: 'unassessed',
              referenceRange: 'Not established',
              resultComment: 'line1\nline2 & more',
              verifiedAt: new Date(),
            },
          ],
        },
      ],
    } as never);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img&gt;');
    expect(html).toContain('line1\nline2 &amp; more');
    expect(html).toContain('No reference interval');
    expect(html).toContain('stored values, not a live catalogue recalculation');
  });

  it('does not mix a second patient or request into the report', () => {
    const html = buildStructuredLabReportHtml({
      requestNo: 'SYN-ONLY',
      status: 'verified',
      patient: { firstName: 'Ada', lastName: 'One', patientNo: 'P-1' },
      items: [
        {
          test: { name: 'HB' },
          results: [{ id: 'r1', value: '13', flag: 'normal', verifiedAt: new Date() }],
        },
      ],
    } as never);
    expect(html).toContain('P-1');
    expect(html).toContain('SYN-ONLY');
    expect(html).not.toContain('P-2');
  });

  it('marks incomplete panels and distinguishes critical from unassessed', () => {
    const html = buildStructuredLabReportHtml({
      requestNo: 'SYN-PANEL',
      status: 'verified',
      patient: { firstName: 'Bea', lastName: 'Two', patientNo: 'P-2' },
      items: [
        {
          orderableTest: {
            name: 'CBC',
            isPanel: true,
            parameters: [
              { code: 'WBC', active: true },
              { code: 'HGB', active: true },
            ],
          },
          results: [
            {
              id: 'wbc',
              value: '2',
              flag: 'critically_low',
              parameter: { code: 'WBC' },
              verifiedAt: new Date(),
            },
          ],
        },
      ],
    } as never);
    expect(html).toContain('Incomplete panel');
    expect(html).toContain('missing HGB');
    expect(html).toContain('Critical low');
    expect(html).toContain('flag-critical');
  });

  it('shows cancelled status and amendment pending on the current row', () => {
    const html = buildStructuredLabReportHtml({
      requestNo: 'SYN-CXL',
      status: 'cancelled',
      cancelledReason: 'duplicate order',
      items: [
        {
          test: { name: 'HB' },
          results: [
            { id: 'old', value: '10', flag: 'low', verifiedAt: new Date() },
            {
              id: 'new',
              value: '12',
              flag: 'normal',
              supersedesId: 'old',
              amendmentReason: 'clerical',
              verifiedAt: null,
            },
          ],
        },
      ],
    } as never);
    expect(html).toContain('Cancelled');
    expect(html).toContain('duplicate order');
    expect(html).toContain('12');
    expect(html).toContain('Amendment pending verification');
    expect(html).not.toContain('>10<');
  });

  it('prints the Jalaram official card chrome without copying another patient', () => {
    const html = buildStructuredLabReportHtml({
      requestNo: 'SYN-CRP',
      status: 'verified',
      patient: { firstName: 'Ada', lastName: 'One', patientNo: 'P-1' },
      items: [
        {
          orderableTest: { name: 'CRP', code: 'CRP' },
          results: [
            {
              id: 'c1',
              value: '4.2',
              unit: 'mg/L',
              flag: 'normal',
              referenceRange: '<10',
              parameter: { code: 'CRP', name: 'CRP' },
              verifiedAt: new Date(),
            },
          ],
        },
      ],
    } as never);
    expect(html).toContain('Caring Hearts Healing Hands');
    expect(html).toContain('PATIENT NAME');
    expect(html).toContain('REFERRING CLINICIAN');
    expect(html).toContain('FLAG KEY');
    expect(html).toContain('Cardiovascular relative-risk bands');
    expect(html).not.toContain('PARMINDER');
    expect(html).not.toContain('19.6');
  });
});
