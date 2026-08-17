import { CvModel, emptyCv, emptyRole, emptySkill, nextId } from '../models/cv.model';

// Best-effort structure recovery from an existing CV.
//
// There is no standard for CV layout, so this is heuristics: match the section
// headings people actually use, then read each block by shape. It gets most of
// a conventional CV right and will get an unusual one partly wrong, which is
// why the result lands in the form for review rather than straight in a file.

const SECTION_PATTERNS: { key: Section; test: RegExp }[] = [
  { key: 'summary', test: /^(profile|summary|professional summary|about|objective)\b/i },
  { key: 'skills', test: /^(technical skills?|skills?|core competenc|technolog|expertise)\b/i },
  {
    key: 'experience',
    test: /^(experience|work experience|professional experience|employment|career)\b/i,
  },
  { key: 'projects', test: /^(projects?|open[- ]source|side projects?)\b/i },
  { key: 'education', test: /^(education|qualification|academic)\b/i },
  { key: 'certifications', test: /^(certifications?|certificates?|licen[cs]es?|courses?)\b/i },
  { key: 'languages', test: /^(languages?)\b/i },
  { key: 'references', test: /^(references?)\b/i },
];

type Section =
  | 'header'
  | 'summary'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'education'
  | 'certifications'
  | 'languages'
  | 'references';

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s()./-]{7,}\d)/;
const URL_LIKE = /\b((https?:\/\/)?(www\.)?[\w-]+\.(com|io|dev|net|org|me|co|ai|gitlab|github)[^\s|,]*)/i;
const DATE_RANGE =
  /((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4}|present|current)\s*[-–—to]+\s*((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4}|present|current)/i;
const BULLET = /^[\s]*[•·▪‣⁃*\-–—]\s+/;
const TECH_LINE = /^(technolog\w*|tech stack|stack|tools?)\s*[:.]/i;
// "Mercury Development, LLC" has the shape of a location but is a company.
const COMPANY_SUFFIX = /\b(llc|inc|ltd|limited|gmbh|cjsc|ojsc|jsc|plc|llp|ag|nv|bv|sa|srl|co)\.?$/i;
// "Berlin, Germany", "Remote", "Remote, United States", "Zurich (Hybrid)".
const LOCATION_LIKE =
  /^(remote|hybrid|on[- ]?site|[A-Za-zÀ-ÿ'.-]+(?:\s[A-Za-zÀ-ÿ'.-]+)?,\s*[A-Za-zÀ-ÿ'.-]+(?:\s[A-Za-zÀ-ÿ'.-]+){0,2})(\s*\([^)]*\))?$/i;

export interface ParseResult {
  cv: CvModel;
  /** What was recognised, for an honest report back to the user. */
  found: { section: string; count: number }[];
  /**
   * 0-5. Low means the file probably was not a CV, or was laid out in a way
   * these heuristics could not follow. Worth saying so rather than presenting
   * a confidently wrong form.
   */
  confidence: number;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function sectionFor(line: string): Section | null {
  // "Languages: Java, Kotlin" is a skills row, not a Languages heading.
  const colon = line.indexOf(':');
  if (colon > -1 && line.slice(colon + 1).trim().length > 2) return null;

  const bare = clean(line).replace(/[:•|]+$/, '');
  // A heading is short and usually set apart; a sentence that starts with
  // "Experience building X" is not a heading.
  if (bare.length > 42 || bare.split(' ').length > 5) return null;
  return SECTION_PATTERNS.find((p) => p.test.test(bare))?.key ?? null;
}

export function parseCv(text: string): ParseResult {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/ /g, ' ').trimEnd())
    .filter((l) => l.trim().length);

  const blocks = new Map<Section, string[]>();
  let current: Section = 'header';

  for (const line of lines) {
    const next = sectionFor(line);
    if (next) {
      current = next;
      continue;
    }
    (blocks.get(current) ?? blocks.set(current, []).get(current)!).push(line);
  }

  const cv = emptyCv();
  const header = blocks.get('header') ?? [];

  // ------------------------------------------------------------------ header
  const contactLine = header.find((l) => EMAIL.test(l) || PHONE.test(l));
  cv.email = contactLine?.match(EMAIL)?.[0] ?? header.join(' ').match(EMAIL)?.[0] ?? '';

  const phoneMatch = (contactLine ?? header.join(' ')).match(PHONE);
  cv.phone = phoneMatch ? clean(phoneMatch[0]) : '';

  // The name is normally the first line, and rarely contains punctuation.
  const nameLine = header.find(
    (l) => !EMAIL.test(l) && !PHONE.test(l) && clean(l).split(' ').length <= 5 && !/[@|]/.test(l),
  );
  if (nameLine) {
    const parts = clean(nameLine).split(' ');
    cv.firstName = parts.shift() ?? '';
    cv.lastName = parts.join(' ');
  }

  // The headline is the line after the name that reads like a job title.
  const nameIndex = nameLine ? header.indexOf(nameLine) : -1;
  const headline = header
    .slice(nameIndex + 1)
    .find((l) => !EMAIL.test(l) && !PHONE.test(l) && !URL_LIKE.test(l) && clean(l).length > 8);
  cv.headline = headline ? clean(headline) : '';

  cv.links = header
    .flatMap((l) => l.split(/[|,]/))
    .map(clean)
    .filter((l) => URL_LIKE.test(l) && !EMAIL.test(l))
    .map((l) => l.match(URL_LIKE)?.[0] ?? l)
    .slice(0, 4);

  // Location: a "City, Country" fragment on the contact line.
  const locationBit = (contactLine ?? '')
    .split('|')
    .map((p) => clean(p).replace(/\s*\([^)]*\)\s*$/, ''))
    .find((p) => /^[A-Za-zÀ-ÿ' .-]{2,},\s*[A-Za-zÀ-ÿ' .-]{2,}$/.test(p) && !EMAIL.test(p));
  cv.location = locationBit ?? '';

  // ----------------------------------------------------------------- summary
  cv.summary = clean((blocks.get('summary') ?? []).join(' '));

  // ------------------------------------------------------------------ skills
  const skillLines = (blocks.get('skills') ?? []).map((l) => l.replace(BULLET, ''));
  cv.skills = skillLines
    .map((line) => {
      const split = line.match(/^([^:]{2,40}):\s*(.+)$/);
      return split
        ? { ...emptySkill(), label: clean(split[1]), items: clean(split[2]) }
        : { ...emptySkill(), label: '', items: clean(line) };
    })
    .filter((s) => s.items.length > 1);
  if (!cv.skills.length) cv.skills = [emptySkill()];

  // -------------------------------------------------------------- experience
  cv.roles = parseRoles(blocks.get('experience') ?? []);
  if (!cv.roles.length) cv.roles = [emptyRole()];

  // ---------------------------------------------------------------- projects
  cv.projects = (blocks.get('projects') ?? [])
    .map((l) => l.replace(BULLET, ''))
    .map((line) => {
      const split = line.match(/^(.{2,40}?)\s*[-–—:]\s*(.+)$/);
      return {
        id: nextId('proj'),
        name: split ? clean(split[1]) : '',
        description: split ? clean(split[2]) : clean(line),
      };
    })
    .filter((p) => p.description.length > 2);

  // --------------------------------------------------------------- education
  const eduLines = (blocks.get('education') ?? []).map((l) => l.replace(BULLET, ''));
  cv.education = eduLines
    .filter((l) => clean(l).length > 4)
    .map((line) => {
      const dates = line.match(/(\d{4})\s*[-–—]\s*(\d{4}|present)/i)?.[0] ?? '';
      const rest = clean(line.replace(dates, '').replace(/[|,]\s*$/, ''));
      const split = rest.match(/^(.*?)\s*[-–—|,]\s*(.*)$/);
      return {
        id: nextId('edu'),
        school: split ? clean(split[2]) : rest,
        degree: split ? clean(split[1]) : '',
        place: '',
        dates: clean(dates),
      };
    })
    .slice(0, 4);
  if (!cv.education.length) cv.education = [{ ...emptyCv().education[0] }];

  cv.certifications = (blocks.get('certifications') ?? [])
    .map((l) => clean(l.replace(BULLET, '')))
    .filter((l) => l.length > 3);

  cv.languages = clean((blocks.get('languages') ?? []).join(' | '));

  const found = [
    ['summary', cv.summary ? 1 : 0],
    ['skills', cv.skills.filter((s) => s.items).length],
    ['experience', cv.roles.filter((r) => r.company || r.title).length],
    ['projects', cv.projects.length],
    ['education', cv.education.filter((e) => e.school || e.degree).length],
    ['certifications', cv.certifications.length],
  ] as const;

  const confidence =
    (cv.email ? 1 : 0) +
    (cv.firstName ? 1 : 0) +
    (cv.roles.some((r) => r.company) ? 1 : 0) +
    (cv.skills.some((s) => s.items) ? 1 : 0) +
    (cv.summary ? 1 : 0);

  return { cv, found: found.map(([section, count]) => ({ section, count })), confidence };
}

// Roles are anchored on date ranges. Plenty of CVs put the company on its own
// line above the dates, so once a date line is found the lines just above it
// are candidates for the company and title.
function parseRoles(lines: string[]): CvModel['roles'] {
  const isBullet = (l: string) => BULLET.test(l);
  const starts = lines
    .map((l, i) => (!isBullet(l) && DATE_RANGE.test(l) ? i : -1))
    .filter((i) => i >= 0);
  if (!starts.length) return [];

  const startSet = new Set(starts);
  const consumed = new Set<number>();
  const headers = new Map<number, string[]>();

  for (const i of starts) {
    const dates = lines[i].match(DATE_RANGE)![0];
    // Trim only: the wide gap between columns is the separator splitHeader
    // needs, and clean() would collapse it away.
    const leftover = lines[i].replace(dates, '').replace(/[|,–—-]\s*$/, '').trim();

    const isPlace = (bit: string) => LOCATION_LIKE.test(bit) && !COMPANY_SUFFIX.test(bit);

    // Collect each line's fields, walking upward, then read them top-down.
    const rows: string[][] = [];
    const leftoverBits = leftover ? splitHeader(leftover) : [];

    let j = i - 1;
    while (j >= 0 && !consumed.has(j) && !startSet.has(j)) {
      const prev = lines[j];
      if (isBullet(prev) || TECH_LINE.test(prev) || clean(prev).split(' ').length > 8) break;
      const bits = splitHeader(prev.trim());
      const named = bits.filter((b) => !isPlace(b)).length;
      rows.unshift(bits);
      consumed.add(j);
      j--;
      // Stop once the company and the title have both been found.
      if (named + leftoverBits.filter((b) => !isPlace(b)).length >= 2) break;
    }
    rows.push(leftoverBits);

    const parts: string[] = [];
    let place = '';
    for (const bits of rows) {
      if (!bits.length) continue;
      const last = bits[bits.length - 1];
      // The location trails the company on a header line, so prefer the last
      // field; anything before it names the company or the role.
      if (!place && isPlace(last) && (bits.length > 1 || parts.length)) {
        place = last;
        parts.push(...bits.slice(0, -1));
      } else {
        parts.push(...bits);
      }
    }

    headers.set(i, [...parts, place]);
  }

  return starts.map((start, k) => {
    const end = starts[k + 1] ?? lines.length;
    const parts = headers.get(start) ?? [];
    const role = {
      ...emptyRole(),
      bullets: [] as string[],
      dates: clean(lines[start].match(DATE_RANGE)![0]),
      company: parts[0] ?? '',
      title: parts[1] ?? '',
      place: parts[parts.length - 1] ?? '',
    };

    for (let i = start + 1; i < end; i++) {
      if (consumed.has(i)) continue; // belongs to the next role's header
      const line = lines[i];

      if (isBullet(line)) {
        role.bullets.push(clean(line.replace(BULLET, '')));
      } else if (TECH_LINE.test(line)) {
        role.tech = clean(line.replace(TECH_LINE, ''));
      } else if (!role.title && clean(line).split(' ').length <= 6) {
        role.title = clean(line);
      } else if (!role.blurb) {
        role.blurb = clean(line);
      } else {
        role.bullets.push(clean(line));
      }
    }

    return role;
  });
}

// Company, title and location are usually separated by a pipe, a dash, or the
// wide gap a two-column layout leaves behind.
function splitHeader(text: string): string[] {
  return text
    .split(/\s*[|–—]\s*|\s{2,}|\s+[-]\s+/)
    .map(clean)
    .filter((p) => p.length > 1);
}
