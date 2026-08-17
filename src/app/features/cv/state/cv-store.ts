import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { CvModel, emptyCv, nextId } from '../models/cv.model';
import { buildLayout } from '../domain/cv-layout';
import { sampleCv } from './sample-cv';

const STORAGE_KEY = 'ats-cv-builder:v1';

// Everything stays in the browser. No backend, nothing sent anywhere; drafts
// go to localStorage so a refresh doesn't lose work.
@Injectable({ providedIn: 'root' })
export class CvStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly cv = signal<CvModel>(this.restore());
  readonly blocks = computed(() => buildLayout(this.cv()));

  constructor() {
    effect(() => {
      const value = this.cv();
      if (!this.isBrowser) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        // Private browsing or a full quota. Losing autosave is not fatal.
      }
    });
  }

  private restore(): CvModel {
    if (!this.isBrowser) return sampleCv();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return this.hydrate(JSON.parse(raw));
    } catch {
      // Corrupt draft: fall back to the sample rather than failing to boot.
    }
    return sampleCv();
  }

  // Older drafts and hand-edited JSON arrive without ids, which would leave
  // the lists sharing a track key. Backfill whatever is missing.
  private hydrate(raw: Partial<CvModel> & { name?: string }): CvModel {
    const cv: CvModel = { ...emptyCv(), ...raw };

    // Drafts saved when the form had a single "Full name" field.
    if (raw.name && !raw.firstName && !raw.lastName) {
      const parts = raw.name.trim().split(/\s+/);
      cv.firstName = parts.shift() ?? '';
      cv.lastName = parts.join(' ');
    }
    delete (cv as { name?: string }).name;
    cv.skills = (cv.skills ?? []).map((s) => ({ ...s, id: s.id || nextId('skill') }));
    cv.projects = (cv.projects ?? []).map((p) => ({ ...p, id: p.id || nextId('proj') }));
    cv.education = (cv.education ?? []).map((e) => ({ ...e, id: e.id || nextId('edu') }));
    cv.roles = (cv.roles ?? []).map((r) => ({
      ...r,
      id: r.id || nextId('role'),
      bullets: r.bullets ?? [],
      engagements: (r.engagements ?? []).map((e) => ({
        ...e,
        id: e.id || nextId('eng'),
        bullets: e.bullets ?? [],
      })),
    }));
    return cv;
  }

  update(patch: Partial<CvModel>) {
    this.cv.update((cv) => ({ ...cv, ...patch }));
  }

  // Mutate a clone; the stored value stays immutable.
  mutate(fn: (draft: CvModel) => void) {
    this.cv.update((cv) => {
      const draft: CvModel = structuredClone(cv);
      fn(draft);
      return draft;
    });
  }

  reset() {
    this.cv.set(emptyCv());
  }

  loadSample() {
    this.cv.set(sampleCv());
  }

  exportJson(): string {
    return JSON.stringify(this.cv(), null, 2);
  }

  importJson(text: string): boolean {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') return false;
      this.cv.set(this.hydrate(parsed as Partial<CvModel>));
      return true;
    } catch {
      return false;
    }
  }
}
