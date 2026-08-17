import { parseCv } from './parse-cv';

const CV = `Ada Lovelace
Senior Software Engineer | Java, Spring Boot, AWS
London, United Kingdom | +44 20 7946 0958 | ada@example.com
linkedin.com/in/adalovelace | github.com/adalovelace

SUMMARY
Senior Software Engineer with 9 years building distributed systems.
Owns services end to end.

TECHNICAL SKILLS
Languages: Java, Kotlin, SQL
Cloud: AWS, Kubernetes, Terraform

PROFESSIONAL EXPERIENCE
Analytical Engines Ltd | Senior Engineer      Mar 2022 - Present
Billing platform used by 400 merchants.
• Built the settlement service handling 40k transfers a day.
• Cut p95 latency from 900ms to 120ms.
Technologies: Java 21, Kafka, PostgreSQL

Difference Machines | Engineer      Jun 2018 - Feb 2022
• Added single sign-on across 3 applications.

EDUCATION
B.Sc. Mathematics - University of London 2014 - 2018

CERTIFICATIONS
AWS Certified Solutions Architect, 2023

LANGUAGES
English - Native | French - B2
`;

describe('parseCv', () => {
  const { cv, found } = parseCv(CV);

  it('splits the name into first and last', () => {
    expect(cv.firstName).toBe('Ada');
    expect(cv.lastName).toBe('Lovelace');
  });

  it('picks up contact details', () => {
    expect(cv.email).toBe('ada@example.com');
    expect(cv.phone).toContain('+44 20 7946 0958');
    expect(cv.location).toBe('London, United Kingdom');
  });

  it('takes the headline from the line under the name', () => {
    expect(cv.headline).toBe('Senior Software Engineer | Java, Spring Boot, AWS');
  });

  it('collects links without swallowing the email', () => {
    expect(cv.links).toContain('linkedin.com/in/adalovelace');
    expect(cv.links.some((l) => l.includes('@'))).toBe(false);
  });

  it('joins the summary into one paragraph', () => {
    expect(cv.summary).toContain('9 years building distributed systems');
    expect(cv.summary).toContain('Owns services end to end');
  });

  it('splits skills on the label colon', () => {
    const languages = cv.skills.find((s) => s.label === 'Languages');
    expect(languages?.items).toBe('Java, Kotlin, SQL');
    expect(cv.skills.length).toBe(2);
  });

  it('finds both roles by their date ranges', () => {
    expect(cv.roles.length).toBe(2);
    expect(cv.roles[0].company).toBe('Analytical Engines Ltd');
    expect(cv.roles[0].title).toBe('Senior Engineer');
    expect(cv.roles[0].dates).toBe('Mar 2022 - Present');
  });

  it('attaches bullets to the role above them', () => {
    expect(cv.roles[0].bullets.length).toBe(2);
    expect(cv.roles[0].bullets[0]).toContain('40k transfers a day');
    expect(cv.roles[1].bullets[0]).toContain('single sign-on');
  });

  it('reads the blurb and the technologies line', () => {
    expect(cv.roles[0].blurb).toBe('Billing platform used by 400 merchants.');
    expect(cv.roles[0].tech).toBe('Java 21, Kafka, PostgreSQL');
  });

  it('reads education, certifications and languages', () => {
    expect(cv.education[0].dates).toBe('2014 - 2018');
    expect(cv.certifications[0]).toContain('AWS Certified');
    expect(cv.languages).toContain('English - Native');
  });

  it('reports what it recognised', () => {
    expect(found.find((f) => f.section === 'experience')?.count).toBe(2);
    expect(found.find((f) => f.section === 'skills')?.count).toBe(2);
  });

  it('survives a file with no recognisable structure', () => {
    const result = parseCv('just some words\nand another line');
    expect(result.cv.roles.length).toBe(1);
    expect(result.found.every((f) => f.count === 0 || f.section === 'education')).toBe(true);
  });

  it('reads a role whose company, location and dates sit on separate lines', () => {
    const twoLine = parseCv(`Ada Lovelace
ada@example.com

PROFESSIONAL EXPERIENCE
Grid Dynamics
Yerevan, Armenia
Senior Software Engineer
Dec 2023 - Present
• Built the thing that does the work.

Enke Systems
Remote
Java Software Engineer
Apr 2021 - Sep 2022
• Shipped another thing.
`);
    expect(twoLine.cv.roles[0].company).toBe('Grid Dynamics');
    expect(twoLine.cv.roles[0].title).toBe('Senior Software Engineer');
    expect(twoLine.cv.roles[0].place).toBe('Yerevan, Armenia');
    expect(twoLine.cv.roles[0].bullets.length).toBe(1);
    expect(twoLine.cv.roles[1].company).toBe('Enke Systems');
    expect(twoLine.cv.roles[1].place).toBe('Remote');
  });

  it('splits a two-column header on the gap the extractor preserves', () => {
    // PDF extraction keeps a wide column gap as a double space; collapsing it
    // welds the company onto the location.
    const columns = parseCv(`Ada Lovelace
ada@example.com

EXPERIENCE
Grid Dynamics  Yerevan, Armenia
Senior Software Engineer  Dec 2023 - Present
• Built the thing.

Teletronics  Dubai, UAE
Full Stack Engineer  Mar 2025 - Sep 2025
• Built another thing.
`);
    expect(columns.cv.roles[0].company).toBe('Grid Dynamics');
    expect(columns.cv.roles[0].title).toBe('Senior Software Engineer');
    expect(columns.cv.roles[0].place).toBe('Yerevan, Armenia');
    expect(columns.cv.roles[1].company).toBe('Teletronics');
    expect(columns.cv.roles[1].place).toBe('Dubai, UAE');
  });

  it('reports low confidence for a file that is not a CV', () => {
    const notACv = parseCv('Developing an Academic Curriculum Vitae\nA CV is a document that ...');
    expect(notACv.confidence).toBeLessThan(3);
  });

  it('reports high confidence for a real one', () => {
    expect(parseCv(CV).confidence).toBeGreaterThanOrEqual(4);
  });

  it('does not mistake a sentence starting with a heading word for a heading', () => {
    const result = parseCv(
      'Ada Lovelace\nEngineer\nExperience building distributed systems across many teams and years.',
    );
    expect(result.cv.roles.filter((r) => r.company).length).toBe(0);
  });
});

describe('parseCv on a tab-separated header', () => {
  it('splits a Word tab stop the same way as a PDF column gap', () => {
    // Word writes <w:tab/>, which the extractor turns into a double space.
    const { cv } = parseCv(`Ada Lovelace
ada@example.com

EXPERIENCE
Mercury Development, LLC  Yerevan, Armenia (Remote)
Senior Frontend Developer  Oct 2022 - Present
• Shipped the thing.
`);
    expect(cv.roles[0].company).toBe('Mercury Development, LLC');
    expect(cv.roles[0].title).toBe('Senior Frontend Developer');
    expect(cv.roles[0].place).toBe('Yerevan, Armenia (Remote)');
  });
});
