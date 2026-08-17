import { Injectable, computed, inject } from '@angular/core';

import { CvStore } from '../state/cv-store';
import { fullName } from '../models/cv.model';
import { Block, toAscii } from './cv-layout';

// The machine's-eye view: the text an ATS pulls out, plus what's worth fixing
// before sending. A CV can look immaculate and still extract as garbage --
// bullets severed from their job, contact details trapped in a header.

export type Severity = 'error' | 'warning' | 'ok';

export interface Finding {
  severity: Severity;
  title: string;
  detail: string;
}

@Injectable({ providedIn: 'root' })
export class AtsCheck {
  private store = inject(CvStore);

  // In the order a parser reads it, which is document order.
  readonly plainText = computed(() =>
    this.store
      .blocks()
      .map((b) => this.blockText(b))
      .filter((line) => line.length)
      .join('\n'),
  );

  readonly findings = computed<Finding[]>(() => {
    const cv = this.store.cv();
    const out: Finding[] = [];
    const text = this.plainText();

    if (!fullName(cv))
      out.push({
        severity: 'error',
        title: 'No name',
        detail: 'The parser has nothing to file this CV under.',
      });

    if (!cv.email.trim())
      out.push({
        severity: 'error',
        title: 'No email address',
        detail: 'Most systems reject a record they cannot contact.',
      });
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cv.email.trim()))
      out.push({
        severity: 'warning',
        title: 'Email looks malformed',
        detail: `"${cv.email.trim()}" does not parse as an address.`,
      });

    if (!cv.phone.trim())
      out.push({
        severity: 'warning',
        title: 'No phone number',
        detail: 'Recruiters often call before they email.',
      });

    const headline = cv.headline.trim();
    if (!headline)
      out.push({
        severity: 'warning',
        title: 'No headline',
        detail: 'A target job title near the top drives the first keyword match.',
      });

    const roles = cv.roles.filter((r) => r.company.trim() || r.title.trim());
    if (!roles.length)
      out.push({
        severity: 'error',
        title: 'No experience listed',
        detail: 'Experience is the section every system weights most heavily.',
      });

    for (const role of roles) {
      const label = role.company.trim() || role.title.trim() || 'a role';
      const ownBullets = role.bullets.filter((b) => b.trim()).length;
      const engagements = role.engagements.filter((e) => e.client.trim());
      const nested = engagements.reduce(
        (n, e) => n + e.bullets.filter((b) => b.trim()).length,
        0,
      );
      if (!ownBullets && !nested)
        out.push({
          severity: 'warning',
          title: `${label} has no bullets`,
          detail: 'A role with dates but no described work contributes almost no keywords.',
        });
      if (!role.dates.trim())
        out.push({
          severity: 'warning',
          title: `${label} has no dates`,
          detail: 'Systems compute years of experience from date ranges.',
        });
    }

    // Compare printable characters only: the joiner newlines are outside the
    // printable ASCII range and would otherwise report themselves as damage.
    const stripped = [
      ...new Set(this.rawSource(cv).split('').filter((c) => !/\s/.test(c) && toAscii(c) !== c)),
    ];
    if (stripped.length)
      out.push({
        severity: 'warning',
        title: 'Characters older parsers mangle',
        detail: `Replaced on export: ${stripped.slice(0, 12).join(' ')}`,
      });

    const numbers = /\b\d+(\.\d+)?\s*(%|x\b|k\b|m\b)|\b\d{2,}\b/i;
    const bulletText = roles
      .flatMap((r) => [...r.bullets, ...r.engagements.flatMap((e) => e.bullets)])
      .filter((b) => b.trim());
    if (bulletText.length && !bulletText.some((b) => numbers.test(b)))
      out.push({
        severity: 'warning',
        title: 'No numbers in any bullet',
        detail: 'Scale, latency, team size, volume. Use real figures only.',
      });

    if (!cv.skills.some((s) => s.items.trim()))
      out.push({
        severity: 'warning',
        title: 'No skills listed',
        detail: 'The skills block is where keyword matching pays off most.',
      });

    if (text.length < 400)
      out.push({
        severity: 'warning',
        title: 'Very little text',
        detail: 'Thin CVs rank poorly against a job description.',
      });

    if (!out.length)
      out.push({
        severity: 'ok',
        title: 'Nothing blocking',
        detail: 'Structure, contact details and keywords all extract cleanly.',
      });

    return out;
  });

  readonly errorCount = computed(
    () => this.findings().filter((f) => f.severity === 'error').length,
  );
  readonly warningCount = computed(
    () => this.findings().filter((f) => f.severity === 'warning').length,
  );

  private blockText(b: Block): string {
    const left = b.runs.map((r) => r.text).join('');
    const right = (b.right ?? []).map((r) => r.text).join('');
    if (b.type === 'bullet') return left.trim() ? `- ${left.trim()}` : '';
    return [left.trim(), right.trim()].filter(Boolean).join('   ');
  }

  // Everything the user typed, before the ASCII pass runs over it.
  private rawSource(cv = this.store.cv()): string {
    return [
      cv.firstName,
      cv.lastName,
      cv.headline,
      cv.location,
      cv.phone,
      cv.email,
      cv.summary,
      cv.languages,
      ...cv.links,
      ...cv.certifications,
      ...cv.skills.flatMap((s) => [s.label, s.items]),
      ...cv.projects.flatMap((p) => [p.name, p.description]),
      ...cv.education.flatMap((e) => [e.school, e.place, e.degree, e.dates]),
      ...cv.roles.flatMap((r) => [
        r.company,
        r.title,
        r.place,
        r.dates,
        r.note,
        r.blurb,
        r.tech,
        ...r.bullets,
        ...r.engagements.flatMap((e) => [
          e.client,
          e.title,
          e.dates,
          e.blurb,
          e.tech,
          ...e.bullets,
        ]),
      ]),
    ].join('\n');
  }
}
