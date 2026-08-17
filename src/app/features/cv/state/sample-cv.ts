import { CvModel, nextId } from '../models/cv.model';

// Loads on first visit. Placeholder names throughout — nobody real — but the
// shape is the lesson: bullets lead with a verb and carry a number, and one
// employer can hold several client engagements.
export const sampleCv = (): CvModel => ({
  firstName: 'Firstname',
  lastName: 'Lastname',
  headline: 'Job Title | Skill One, Skill Two, Skill Three',
  location: 'City, Country',
  phone: '+00 000 000 000',
  email: 'firstname.lastname@example.com',
  links: ['linkedin.com/in/username', 'github.com/username'],
  summary:
    'Job Title with 8 years building the kind of system this sentence should name, for ' +
    'clients in two or three industries worth naming. One sentence on what you own end to ' +
    'end. One sentence on what you are known for, such as leading a team of five.',
  skills: [
    { id: nextId('skill'), label: 'Languages', items: 'Language A, Language B, Language C' },
    { id: nextId('skill'), label: 'Frameworks', items: 'Framework A, Framework B' },
    { id: nextId('skill'), label: 'Data', items: 'Database A, Database B, Cache A' },
    { id: nextId('skill'), label: 'Cloud & DevOps', items: 'Cloud A, Container A, CI Tool A' },
    { id: nextId('skill'), label: 'Testing', items: 'Test Tool A, Test Tool B' },
  ],
  roles: [
    {
      id: nextId('role'),
      company: 'Company One',
      title: 'Senior Job Title',
      place: 'City, Country',
      dates: 'Mar 2022 - Present',
      note: 'Consultancy; embedded in the client engagements below.',
      blurb: '',
      bullets: [],
      tech: '',
      engagements: [
        {
          id: nextId('eng'),
          client: 'Client One',
          title: 'Senior Job Title',
          dates: 'Jan 2024 - Present',
          blurb: 'One line saying what the product is and who uses it.',
          bullets: [
            'Built the component that does the main thing, handling 40k events a day.',
            'Introduced the approach that replaced the old one, cutting a nightly batch to a live stream.',
            'Led the migration from one store to another across 12 services.',
          ],
          tech: 'Language A, Framework A, Database A, Cloud A',
        },
        {
          id: nextId('eng'),
          client: 'Client Two',
          title: 'Job Title',
          dates: 'Mar 2022 - Dec 2023',
          blurb: 'One line saying what this product is and the scale it runs at.',
          bullets: [
            'Shipped the API behind two separate front ends.',
            'Cut page latency from 900ms to 120ms at p95 by fixing indexes and adding a cache.',
          ],
          tech: 'Language A, Framework A, Database A',
        },
      ],
    },
    {
      id: nextId('role'),
      company: 'Company Two',
      title: 'Job Title',
      place: 'Remote',
      dates: 'Jun 2018 - Feb 2022',
      note: '',
      blurb: 'One line saying what the product is and who uses it.',
      bullets: [
        'Built the scheduling engine covering recurring slots, cancellations and waitlists.',
        'Added single sign-on across 3 internal applications.',
        'Mentored 2 junior engineers through pair programming and code review.',
      ],
      tech: 'Language A, Framework B, Database B',
      engagements: [],
    },
  ],
  projects: [
    {
      id: nextId('proj'),
      name: 'project-name',
      description: 'One line on what it does and why anyone would use it.',
    },
  ],
  education: [
    {
      id: nextId('edu'),
      school: 'University Name',
      place: 'City, Country',
      degree: 'B.Sc. Subject Name',
      dates: '2014 - 2018',
    },
  ],
  certifications: ['Certification Name - Issuing Body, 2023'],
  languages: 'Language One - Fluent (C1) | Language Two - B2',
  fontSize: 10.5,
  margin: 0.6,
  spacing: 1,
});
