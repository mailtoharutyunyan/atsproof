import { TestBed } from '@angular/core/testing';

import { CvStore } from './cv-store';
import { sampleCv } from './sample-cv';
import { emptyCv, emptyRole } from '../models/cv.model';

describe('CvStore', () => {
  let store: CvStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(CvStore);
  });

  it('round-trips a CV through save and load without losing anything', () => {
    store.cv.set(sampleCv());
    const saved = store.cv();
    const json = store.exportJson();

    store.reset();
    expect(store.cv().roles[0].company).toBe('');

    expect(store.importJson(json)).toBe(true);
    expect(store.cv()).toEqual(saved);
  });

  it('rejects a file that is not CV data, leaving the draft alone', () => {
    store.cv.set({ ...emptyCv(), firstName: 'Ada' });

    expect(store.importJson('not json at all')).toBe(false);
    expect(store.importJson('"a bare string"')).toBe(false);
    expect(store.cv().firstName).toBe('Ada');
  });

  it('splits an older single-field name on import', () => {
    expect(store.importJson(JSON.stringify({ name: 'Ada King Lovelace' }))).toBe(true);
    expect(store.cv().firstName).toBe('Ada');
    expect(store.cv().lastName).toBe('King Lovelace');
    expect((store.cv() as unknown as Record<string, unknown>)['name']).toBeUndefined();
  });

  it('gives ids to imported data that predates them', () => {
    const legacy = JSON.stringify({
      firstName: 'Ada',
      skills: [{ label: 'Languages', items: 'Java' }],
      roles: [{ company: 'Acme', bullets: ['Shipped it'], engagements: [{ client: 'Beta' }] }],
    });

    expect(store.importJson(legacy)).toBe(true);
    const cv = store.cv();
    expect(cv.skills[0].id).toBeTruthy();
    expect(cv.roles[0].id).toBeTruthy();
    expect(cv.roles[0].engagements[0].id).toBeTruthy();
    expect(cv.roles[0].engagements[0].bullets).toEqual([]);
  });

  it('persists edits so a reload keeps the draft', () => {
    store.cv.set({ ...emptyCv(), firstName: 'Ada', lastName: 'Lovelace' });
    TestBed.flushEffects?.();

    const stored = JSON.parse(localStorage.getItem('ats-cv-builder:v1') ?? '{}');
    expect(stored.firstName).toBe('Ada');
    expect(stored.lastName).toBe('Lovelace');
  });

  it('leaves the original untouched when a mutation is applied', () => {
    store.cv.set({ ...emptyCv(), roles: [{ ...emptyRole(), company: 'Before' }] });
    const before = store.cv();

    store.mutate((d) => (d.roles[0].company = 'After'));

    expect(before.roles[0].company).toBe('Before');
    expect(store.cv().roles[0].company).toBe('After');
  });
});
