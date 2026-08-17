import { PdfExport } from './pdf-export';
import { sampleCv } from '../state/sample-cv';
import { emptyCv, emptyRole } from '../models/cv.model';

describe('PdfExport', () => {
  const pdf = new PdfExport();

  it('produces a PDF for the sample CV', () => {
    const bytes = pdf.build(sampleCv()).output('arraybuffer');
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it('reports a page count of at least one even when empty', () => {
    expect(pdf.pageCount(emptyCv())).toBeGreaterThanOrEqual(1);
  });

  it('grows to more pages as content grows', () => {
    const cv = emptyCv();
    cv.firstName = 'Ada';
    cv.lastName = 'Lovelace';
    const short = pdf.pageCount(cv);

    cv.roles = Array.from({ length: 14 }, (_, i) => ({
      ...emptyRole(),
      company: `Company ${i}`,
      title: 'Engineer',
      dates: '2020 - 2021',
      bullets: Array.from({ length: 6 }, (_, b) => `Delivered work item number ${b} for the team.`),
    }));

    expect(pdf.pageCount(cv)).toBeGreaterThan(short);
  });

  it('never splits a role across a page boundary', () => {
    // Fill most of a page, then add a role too tall for the remaining space.
    const cv = emptyCv();
    cv.firstName = 'Ada';
    cv.lastName = 'Lovelace';
    cv.summary = 'x '.repeat(400);
    cv.roles = [
      {
        ...emptyRole(),
        company: 'Tail Co',
        title: 'Engineer',
        dates: '2020',
        bullets: Array.from({ length: 12 }, (_, i) => `Bullet number ${i} describing the work.`),
      },
    ];

    const doc = pdf.build(cv);
    const pages: string[] = [];
    for (let i = 1; i <= doc.getNumberOfPages(); i++) {
      doc.setPage(i);
      pages.push(JSON.stringify(doc.internal.pages[i]));
    }

    // The company header must land on the same page as its first bullet.
    const headerPage = pages.findIndex((p) => p.includes('Tail Co'));
    const bulletPage = pages.findIndex((p) => p.includes('Bullet number 0'));
    expect(headerPage).toBe(bulletPage);
  });
});
