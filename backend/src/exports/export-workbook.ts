import PizZip from 'pizzip';

export type ExportColumn = { key: string; header: string; kind?: 'text' | 'number' | 'date' };

export function escapeCsv(value: unknown): string {
  if (value == null) return '';
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(columns: ExportColumn[], rows: Array<Record<string, unknown>>): Buffer {
  const header = columns.map((col) => escapeCsv(col.header)).join(',');
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key];
        if (col.kind === 'number' && value != null && value !== '') return escapeCsv(Number(value));
        return escapeCsv(value);
      })
      .join(','),
  );
  return Buffer.from(`\uFEFF${[header, ...lines].join('\r\n')}`, 'utf8');
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellXml(value: unknown, kind: ExportColumn['kind'], ref: string): string {
  if (value == null || value === '') return `<c r="${ref}"/>`;
  if (kind === 'number' && Number.isFinite(Number(value))) {
    return `<c r="${ref}" t="n"><v>${Number(value)}</v></c>`;
  }
  const text =
    value instanceof Date
      ? value.toISOString()
      : String(value);
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
}

function columnLetter(index: number): string {
  let n = index;
  let letters = '';
  while (n >= 0) {
    letters = String.fromCharCode((n % 26) + 65) + letters;
    n = Math.floor(n / 26) - 1;
  }
  return letters;
}

export function toXlsx(columns: ExportColumn[], rows: Array<Record<string, unknown>>, sheetName = 'Export'): Buffer {
  const sheetRows = [
    `<row r="1">${columns
      .map((col, index) => cellXml(col.header, 'text', `${columnLetter(index)}1`))
      .join('')}</row>`,
    ...rows.map((row, rowIndex) => {
      const r = rowIndex + 2;
      return `<row r="${r}">${columns
        .map((col, index) => cellXml(row[col.key], col.kind, `${columnLetter(index)}${r}`))
        .join('')}</row>`;
    }),
  ].join('');

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );
  zip.file('xl/workbook.xml', workbook);
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
  );
  zip.file('xl/worksheets/sheet1.xml', sheet);
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}
