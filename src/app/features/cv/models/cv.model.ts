// Kept flat and text-only on purpose. Every field ends up as plain paragraph
// text in the export, which is the only shape parsers reliably handle.

export interface Identified {
  readonly id: string;
}

let seq = 0;
export const nextId = (prefix: string): string => `${prefix}-${++seq}`;

export interface Engagement extends Identified {
  client: string;
  title: string;
  dates: string; // free text, e.g. "Oct 2025 - May 2026"
  blurb: string;
  bullets: string[];
  tech: string;
}

export interface Role extends Identified {
  company: string;
  title: string;
  place: string;
  dates: string;
  note: string;
  blurb: string;
  bullets: string[];
  tech: string;
  // For consultancies: several clients under one employer, so the company name
  // is listed once instead of repeating per project.
  engagements: Engagement[];
}

export interface SkillGroup extends Identified {
  label: string;
  items: string;
}

export interface Education extends Identified {
  school: string;
  place: string;
  degree: string;
  dates: string;
}

export interface Project extends Identified {
  name: string;
  description: string;
}

export interface CvModel {
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  phone: string;
  email: string;
  links: string[];
  summary: string;
  skills: SkillGroup[];
  roles: Role[];
  projects: Project[];
  education: Education[];
  certifications: string[];
  languages: string;
  fontSize: number; // points; 9.5-11 is the usable range
  margin: number; // inches, top and bottom
  spacing: number; // whitespace multiplier, lower packs more per page
}

export const emptySkill = (): SkillGroup => ({ id: nextId('skill'), label: '', items: '' });

export const emptyEducation = (): Education => ({
  id: nextId('edu'),
  school: '',
  place: '',
  degree: '',
  dates: '',
});

export const emptyProject = (): Project => ({ id: nextId('proj'), name: '', description: '' });

export const emptyEngagement = (): Engagement => ({
  id: nextId('eng'),
  client: '',
  title: '',
  dates: '',
  blurb: '',
  bullets: [''],
  tech: '',
});

export const emptyRole = (): Role => ({
  id: nextId('role'),
  company: '',
  title: '',
  place: '',
  dates: '',
  note: '',
  blurb: '',
  bullets: [''],
  tech: '',
  engagements: [],
});

export const emptyCv = (): CvModel => ({
  firstName: '',
  lastName: '',
  headline: '',
  location: '',
  phone: '',
  email: '',
  links: [''],
  summary: '',
  skills: [emptySkill()],
  roles: [emptyRole()],
  projects: [],
  education: [emptyEducation()],
  certifications: [],
  languages: '',
  fontSize: 10.5,
  margin: 0.6,
  spacing: 1,
});

export const fullName = (cv: Pick<CvModel, 'firstName' | 'lastName'>): string =>
  [cv.firstName, cv.lastName].map((s) => s.trim()).filter(Boolean).join(' ');
