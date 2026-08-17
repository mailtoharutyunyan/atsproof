import { CvModel, Role, fullName } from '../models/cv.model';

// The preview and both exporters render from the list this produces, so the
// screen can't drift from the download. A flat sequence of text blocks, no
// tables and no columns, is also what survives an ATS intact.

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type BlockType = 'name' | 'tagline' | 'center' | 'heading' | 'para' | 'bullet' | 'split';

export interface Block {
  type: BlockType;
  runs: Run[];
  right?: Run[]; // 'split' blocks only
  spaceBefore: number; // points, before the spacing multiplier
  // Blocks sharing a group id stay on one page. This is what stops a job being
  // torn in half at a page break.
  group?: number;
}

const t = (text: string, bold = false, italic = false): Run => ({ text, bold, italic });

// Older parsers choke on typographic punctuation, and a few drop anything
// outside printable ASCII entirely. Rather than delete those characters --
// which turns "Müller" into "Mller" -- fold them to their closest ASCII form.
const LIGATURES: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  Æ: 'AE',
  œ: 'oe',
  Œ: 'OE',
  ø: 'o',
  Ø: 'O',
  đ: 'd',
  Đ: 'D',
  ð: 'd',
  Ð: 'D',
  þ: 'th',
  Þ: 'Th',
  ł: 'l',
  Ł: 'L',
  ı: 'i',
};

export function toAscii(s: string): string {
  return (s ?? '')
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u2007\u202F\u2009]/g, ' ')
    .replace(/[\u2022\u25CF\u25AA\u2023\u2043]/g, '-')
    .replace(/[\u00DF\u00E6\u00C6\u0153\u0152\u00F8\u00D8\u0111\u0110\u00F0\u00D0\u00FE\u00DE\u0142\u0141\u0131]/g,
      (c) => LIGATURES[c] ?? c)
    // Decompose accents, then drop the combining marks: é -> e, ü -> u.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

const clean = (s: string) => toAscii(s ?? '').trim();
const has = (s: string) => clean(s).length > 0;

export function buildLayout(cv: CvModel): Block[] {
  const blocks: Block[] = [];
  let group = 0;

  const push = (b: Block) => {
    blocks.push(b);
    return b;
  };

  // ------------------------------------------------------------------ header
  const name = clean(fullName(cv));
  if (name) push({ type: 'name', runs: [t(name, true)], spaceBefore: 0 });
  if (has(cv.headline))
    push({ type: 'tagline', runs: [t(clean(cv.headline), true)], spaceBefore: 1 });

  const contact = [cv.location, cv.phone, cv.email].map(clean).filter(Boolean).join(' | ');
  if (contact) push({ type: 'center', runs: [t(contact)], spaceBefore: 2 });

  const links = (cv.links ?? []).map(clean).filter(Boolean).join(' | ');
  if (links) push({ type: 'center', runs: [t(links)], spaceBefore: 0 });

  // ----------------------------------------------------------------- summary
  if (has(cv.summary)) {
    push({ type: 'heading', runs: [t('SUMMARY', true)], spaceBefore: 8 });
    push({ type: 'para', runs: [t(clean(cv.summary))], spaceBefore: 0 });
  }

  // ------------------------------------------------------------------ skills
  const skills = (cv.skills ?? []).filter((s) => has(s.label) || has(s.items));
  if (skills.length) {
    push({ type: 'heading', runs: [t('TECHNICAL SKILLS', true)], spaceBefore: 8 });
    for (const s of skills) {
      const runs: Run[] = [];
      if (has(s.label)) runs.push(t(clean(s.label) + ': ', true));
      runs.push(t(clean(s.items)));
      push({ type: 'bullet', runs, spaceBefore: 0 });
    }
  }

  // -------------------------------------------------------------- experience
  const roles = (cv.roles ?? []).filter((r) => has(r.company) || has(r.title));
  if (roles.length) {
    push({ type: 'heading', runs: [t('PROFESSIONAL EXPERIENCE', true)], spaceBefore: 8 });
    for (const role of roles) emitRole(role);
  }

  function emitRole(role: Role) {
    const engagements = (role.engagements ?? []).filter((e) => has(e.client));
    const g = ++group;

    // The company header binds to whatever follows it.
    push({
      type: 'split',
      runs: [t(clean(role.company), true)],
      right: [t(clean(role.place), true)],
      spaceBefore: 6,
      group: g,
    });
    push({
      type: 'split',
      runs: [t(clean(role.title), true, true)],
      right: [t(clean(role.dates), true, true)],
      spaceBefore: 0,
      group: g,
    });
    if (has(role.note)) push({ type: 'para', runs: [t(clean(role.note))], spaceBefore: 0, group: g });

    emitBody(role.blurb, role.bullets, role.tech, g);

    // Each engagement is its own keep-together group so a long consultancy
    // block can still break between clients, just never mid-client.
    for (const e of engagements) {
      const eg = ++group;
      const head: Run[] = [t('Client: ', true), t(clean(e.client), true)];
      if (has(e.title)) head.push(t(' - ' + clean(e.title)));
      push({
        type: 'split',
        runs: head,
        right: [t(clean(e.dates), false, true)],
        spaceBefore: 4,
        group: eg,
      });
      emitBody(e.blurb, e.bullets, e.tech, eg);
    }
  }

  function emitBody(blurb: string, bullets: string[], tech: string, g: number) {
    if (has(blurb)) push({ type: 'para', runs: [t(clean(blurb))], spaceBefore: 0, group: g });
    for (const b of (bullets ?? []).filter(has))
      push({ type: 'bullet', runs: [t(clean(b))], spaceBefore: 0, group: g });
    if (has(tech))
      push({
        type: 'para',
        runs: [t('Technologies: ', true), t(clean(tech))],
        spaceBefore: 1,
        group: g,
      });
  }

  // ---------------------------------------------------------------- projects
  const projects = (cv.projects ?? []).filter((p) => has(p.name) || has(p.description));
  if (projects.length) {
    push({ type: 'heading', runs: [t('PROJECTS', true)], spaceBefore: 8 });
    for (const p of projects) {
      const runs: Run[] = [];
      if (has(p.name)) runs.push(t(clean(p.name), true));
      if (has(p.description)) runs.push(t((has(p.name) ? ' - ' : '') + clean(p.description)));
      push({ type: 'bullet', runs, spaceBefore: 0 });
    }
  }

  // --------------------------------------------------------------- education
  const education = (cv.education ?? []).filter((e) => has(e.school) || has(e.degree));
  if (education.length) {
    push({ type: 'heading', runs: [t('EDUCATION', true)], spaceBefore: 8 });
    for (const e of education) {
      const g = ++group;
      push({
        type: 'split',
        runs: [t(clean(e.school), true)],
        right: [t(clean(e.place), true)],
        spaceBefore: 2,
        group: g,
      });
      push({
        type: 'split',
        runs: [t(clean(e.degree))],
        right: [t(clean(e.dates), false, true)],
        spaceBefore: 0,
        group: g,
      });
    }
  }

  // ---------------------------------------------------------- certifications
  const certs = (cv.certifications ?? []).map(clean).filter(Boolean);
  if (certs.length) {
    push({ type: 'heading', runs: [t('CERTIFICATIONS', true)], spaceBefore: 8 });
    for (const c of certs) push({ type: 'bullet', runs: [t(c)], spaceBefore: 0 });
  }

  // --------------------------------------------------------------- languages
  if (has(cv.languages)) {
    push({ type: 'heading', runs: [t('LANGUAGES', true)], spaceBefore: 8 });
    push({ type: 'para', runs: [t(clean(cv.languages))], spaceBefore: 0 });
  }

  return blocks;
}
