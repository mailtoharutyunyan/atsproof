import { buildLayout, toAscii } from './cv-layout';
import { emptyCv, emptyEngagement, emptyRole } from '../models/cv.model';

describe('toAscii', () => {
  it('replaces punctuation that older parsers mangle', () => {
    expect(toAscii('“quoted” — it’s a dash…')).toBe('"quoted" - it\'s a dash...');
  });

  it('leaves plain ASCII untouched', () => {
    const plain = 'Java 17, Spring Boot 3 / 4 (Web) - REST & gRPC';
    expect(toAscii(plain)).toBe(plain);
  });

  it('folds accents to their base letter instead of deleting them', () => {
    expect(toAscii('Ana Müller-Sørensen')).toBe('Ana Muller-Sorensen');
    expect(toAscii('José Škoda')).toBe('Jose Skoda');
    expect(toAscii('Straße')).toBe('Strasse');
    expect(toAscii('Łukasz')).toBe('Lukasz');
  });

  it('drops characters with no ASCII equivalent at all', () => {
    expect(toAscii('Emoji 🎯 here')).toBe('Emoji  here');
  });
});

describe('buildLayout', () => {
  it('omits sections that have no content', () => {
    const blocks = buildLayout(emptyCv());
    expect(blocks.map((b) => b.runs.map((r) => r.text).join(''))).not.toContain('SUMMARY');
  });

  it('keeps a role and its bullets in one group so it cannot split a page', () => {
    const cv = emptyCv();
    cv.roles = [{ ...emptyRole(), company: 'Acme', bullets: ['One', 'Two'], tech: 'Java' }];

    const groups = buildLayout(cv)
      .filter((b) => b.group !== undefined)
      .map((b) => b.group);

    expect(new Set(groups).size).toBe(1);
    expect(groups.length).toBe(5); // company, title, two bullets, tech
  });

  it('gives each client engagement its own group', () => {
    const cv = emptyCv();
    cv.roles = [
      {
        ...emptyRole(),
        company: 'Consultancy',
        engagements: [
          { ...emptyEngagement(), client: 'Alpha', bullets: ['a'] },
          { ...emptyEngagement(), client: 'Beta', bullets: ['b'] },
        ],
      },
    ];

    const groups = new Set(
      buildLayout(cv)
        .filter((b) => b.group !== undefined)
        .map((b) => b.group),
    );
    expect(groups.size).toBe(3); // the employer header plus one per client
  });

  it('emits contact details as a single joined line', () => {
    const cv = emptyCv();
    cv.firstName = 'Ada';
    cv.lastName = 'Lovelace';
    cv.location = 'London';
    cv.phone = '+44 1';
    cv.email = 'ada@example.com';

    const centre = buildLayout(cv).find((b) => b.type === 'center');
    expect(centre?.runs[0].text).toBe('London | +44 1 | ada@example.com');
  });

  it('normalises smart punctuation on the way into the document', () => {
    const cv = emptyCv();
    cv.summary = 'Built “fast” systems';
    const summary = buildLayout(cv).find((b) => b.type === 'para');
    expect(summary?.runs[0].text).toBe('Built "fast" systems');
  });
});
