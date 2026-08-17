import { TestBed } from '@angular/core/testing';

import { AtsCheck } from './ats-check';
import { CvStore } from '../state/cv-store';
import { emptyCv, emptyRole } from '../models/cv.model';

describe('AtsCheck', () => {
  let ats: AtsCheck;
  let store: CvStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(CvStore);
    ats = TestBed.inject(AtsCheck);
  });

  it('reports missing name and email as errors', () => {
    store.reset();
    const titles = ats.findings().map((f) => f.title);
    expect(titles).toContain('No name');
    expect(titles).toContain('No email address');
    expect(ats.errorCount()).toBeGreaterThan(0);
  });

  it('does not mistake line breaks for unparseable characters', () => {
    store.cv.set({ ...emptyCv(), firstName: 'Ada', email: 'ada@example.com', summary: 'Line one' });
    expect(ats.findings().map((f) => f.title)).not.toContain('Characters older parsers mangle');
  });

  it('flags smart punctuation that will be rewritten on export', () => {
    store.cv.set({ ...emptyCv(), firstName: 'Ada', summary: 'Built “fast” systems' });
    expect(ats.findings().map((f) => f.title)).toContain('Characters older parsers mangle');
  });

  it('flags a role that has dates but no bullets', () => {
    store.cv.set({
      ...emptyCv(),
      firstName: 'Ada',
      email: 'ada@example.com',
      roles: [{ ...emptyRole(), company: 'Acme', dates: '2020 - 2021', bullets: [] }],
    });
    expect(ats.findings().some((f) => f.title.includes('Acme') && f.title.includes('no bullets')))
      .toBe(true);
  });

  it('notices when no bullet contains a number', () => {
    store.cv.set({
      ...emptyCv(),
      firstName: 'Ada',
      email: 'ada@example.com',
      roles: [{ ...emptyRole(), company: 'Acme', dates: '2020', bullets: ['Built things well'] }],
    });
    expect(ats.findings().map((f) => f.title)).toContain('No numbers in any bullet');
  });

  it('extracts text in reading order, bullets marked', () => {
    store.cv.set({
      ...emptyCv(),
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      roles: [{ ...emptyRole(), company: 'Acme', dates: '2020', bullets: ['Shipped 3 services'] }],
    });
    const text = ats.plainText();
    expect(text.indexOf('Ada Lovelace')).toBeLessThan(text.indexOf('Acme'));
    expect(text).toContain('- Shipped 3 services');
  });
});
