import { TestBed } from '@angular/core/testing';

import { CvForm } from './cv-form';
import { CvStore } from '../../state/cv-store';
import { emptyCv, emptyRole, emptySkill } from '../../models/cv.model';

describe('CvForm section state', () => {
  let form: CvForm;
  let store: CvStore;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [CvForm] }).compileComponents();
    form = TestBed.createComponent(CvForm).componentInstance;
    store = TestBed.inject(CvStore);
  });

  const section = (id: string) => form.sections().find((s) => s.id === id)!;

  it('marks everything empty on a blank CV', () => {
    store.reset();
    expect(section('contact').fill).toBe('empty');
    expect(section('experience').fill).toBe('empty');
    expect(form.doneCount()).toBe(0);
  });

  it('grades contact from partial to done as fields land', () => {
    store.cv.set({ ...emptyCv(), firstName: 'Ada' });
    expect(section('contact').fill).toBe('partial');

    store.cv.set({
      ...emptyCv(),
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      headline: 'Engineer',
      location: 'London',
    });
    expect(section('contact').fill).toBe('done');
  });

  it('treats a role with too few bullets as partial', () => {
    store.cv.set({
      ...emptyCv(),
      roles: [{ ...emptyRole(), company: 'Acme', bullets: ['One'] }],
    });
    expect(section('experience').fill).toBe('partial');

    store.cv.set({
      ...emptyCv(),
      roles: [{ ...emptyRole(), company: 'Acme', bullets: ['One', 'Two'] }],
    });
    expect(section('experience').fill).toBe('done');
  });

  it('counts only required sections towards progress', () => {
    const optional = form.sections().filter((s) => s.optional).map((s) => s.id);
    expect(optional).toEqual(['projects', 'layout']);
    expect(form.requiredCount()).toBe(5);
  });

  it('opens one section at a time and can close the open one', () => {
    form.open('skills');
    expect(form.isOpen('skills')).toBe(true);
    expect(form.isOpen('contact')).toBe(false);

    form.toggle('skills');
    expect(form.isOpen('skills')).toBe(false);
  });

  it('reports skill groups that actually carry items', () => {
    store.cv.set({
      ...emptyCv(),
      skills: [{ ...emptySkill(), label: 'Languages', items: 'Java' }, emptySkill()],
    });
    expect(section('skills').count).toBe('1 group');
  });
});
