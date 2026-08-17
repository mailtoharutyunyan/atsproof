import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CvStore } from '../../state/cv-store';
import {
  CvModel,
  Education,
  Engagement,
  Project,
  Role,
  SkillGroup,
  emptyEducation,
  emptyEngagement,
  emptyProject,
  emptyRole,
  emptySkill,
} from '../../models/cv.model';

const toLines = (v: string): string[] => v.split('\n').map((s) => s.trim()).filter(Boolean);

export type SectionId =
  | 'contact'
  | 'summary'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'education'
  | 'layout';

export type Fill = 'empty' | 'partial' | 'done';

export interface Section {
  id: SectionId;
  label: string;
  short: string;
  count: string;
  fill: Fill;
  optional?: boolean;
}

// Writes go through index paths, never object references. The store clones
// before applying a change, so a callback closing over an item from the
// previous render would mutate a stale copy and silently drop the edit.
@Component({
  selector: 'cv-form',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cv-form.html',
  styleUrl: './cv-form.scss',
})
export class CvForm {
  private store = inject(CvStore);
  readonly cv = this.store.cv;

  readonly openSection = signal<SectionId | ''>('contact');

  readonly linkText = computed(() => this.cv().links.join('\n'));
  readonly certText = computed(() => this.cv().certifications.join('\n'));

  readonly bulletCount = computed(() =>
    this.cv().roles.reduce(
      (n, r) => n + r.bullets.length + r.engagements.reduce((m, e) => m + e.bullets.length, 0),
      0,
    ),
  );

  // Each pip reports what its section will actually contribute, so the row
  // works as a to-do list rather than decoration.
  readonly sections = computed<Section[]>(() => {
    const cv = this.cv();
    const filled = (s: string) => s.trim().length > 0;

    const contact = [
      cv.firstName,
      cv.lastName,
      cv.email,
      cv.headline,
      cv.location,
      cv.phone,
    ].filter(filled).length;
    const skills = cv.skills.filter((s) => filled(s.items)).length;
    const roles = cv.roles.filter((r) => filled(r.company) || filled(r.title)).length;
    const bullets = this.bulletCount();
    const education = cv.education.filter((e) => filled(e.school) || filled(e.degree)).length;
    const summary = cv.summary.trim().length;

    const grade = (value: number, enough: number): Fill =>
      value === 0 ? 'empty' : value >= enough ? 'done' : 'partial';

    return [
      {
        id: 'contact',
        label: 'Contact',
        short: 'Contact',
        count: `${contact}/6`,
        fill: grade(contact, 5),
      },
      {
        id: 'summary',
        label: 'Summary',
        short: 'Summary',
        count: `${summary} chars`,
        fill: summary === 0 ? 'empty' : summary < 180 ? 'partial' : 'done',
      },
      {
        id: 'skills',
        label: 'Technical skills',
        short: 'Skills',
        count: `${skills} ${skills === 1 ? 'group' : 'groups'}`,
        fill: grade(skills, 3),
      },
      {
        id: 'experience',
        label: 'Experience',
        short: 'Work',
        count: `${roles} ${roles === 1 ? 'role' : 'roles'} · ${bullets} bullets`,
        fill: roles === 0 ? 'empty' : bullets < roles * 2 ? 'partial' : 'done',
      },
      {
        id: 'projects',
        label: 'Projects',
        short: 'Projects',
        count: `${cv.projects.length}`,
        fill: cv.projects.length ? 'done' : 'empty',
        optional: true,
      },
      {
        id: 'education',
        label: 'Education & certifications',
        short: 'Education',
        count: `${education} · ${cv.certifications.length}`,
        fill: grade(education, 1),
      },
      {
        id: 'layout',
        label: 'Layout',
        short: 'Layout',
        count: `${cv.fontSize}pt`,
        fill: 'done',
        optional: true,
      },
    ];
  });

  readonly doneCount = computed(
    () => this.sections().filter((s) => s.fill === 'done' && !s.optional).length,
  );
  readonly requiredCount = computed(() => this.sections().filter((s) => !s.optional).length);

  isOpen(id: SectionId): boolean {
    return this.openSection() === id;
  }

  // One section at a time: the rail is long enough without seven open at once.
  open(id: SectionId) {
    this.openSection.set(id);
  }

  toggle(id: SectionId) {
    this.openSection.update((current) => (current === id ? '' : id));
  }

  set<K extends keyof CvModel>(key: K, value: CvModel[K]) {
    this.store.update({ [key]: value } as Partial<CvModel>);
  }

  setLinks(v: string) {
    this.set('links', toLines(v));
  }

  setCerts(v: string) {
    this.set('certifications', toLines(v));
  }

  // ----------------------------------------------------------------- skills
  patchSkill(i: number, patch: Partial<SkillGroup>) {
    this.store.mutate((d) => Object.assign(d.skills[i], patch));
  }

  addSkill() {
    this.store.mutate((d) => d.skills.push(emptySkill()));
  }

  removeSkill(i: number) {
    this.store.mutate((d) => d.skills.splice(i, 1));
  }

  // ------------------------------------------------------------------ roles
  patchRole(i: number, patch: Partial<Role>) {
    this.store.mutate((d) => Object.assign(d.roles[i], patch));
  }

  setRoleBullets(i: number, v: string) {
    this.store.mutate((d) => (d.roles[i].bullets = toLines(v)));
  }

  addRole() {
    this.store.mutate((d) => d.roles.push(emptyRole()));
  }

  removeRole(i: number) {
    this.store.mutate((d) => d.roles.splice(i, 1));
  }

  moveRole(i: number, delta: number) {
    this.store.mutate((d) => {
      const j = i + delta;
      if (j < 0 || j >= d.roles.length) return;
      [d.roles[i], d.roles[j]] = [d.roles[j], d.roles[i]];
    });
  }

  // ------------------------------------------------------------ engagements
  patchEngagement(roleIndex: number, i: number, patch: Partial<Engagement>) {
    this.store.mutate((d) => Object.assign(d.roles[roleIndex].engagements[i], patch));
  }

  setEngagementBullets(roleIndex: number, i: number, v: string) {
    this.store.mutate((d) => (d.roles[roleIndex].engagements[i].bullets = toLines(v)));
  }

  addEngagement(roleIndex: number) {
    this.store.mutate((d) => d.roles[roleIndex].engagements.push(emptyEngagement()));
  }

  removeEngagement(roleIndex: number, i: number) {
    this.store.mutate((d) => d.roles[roleIndex].engagements.splice(i, 1));
  }

  // --------------------------------------------------------------- projects
  patchProject(i: number, patch: Partial<Project>) {
    this.store.mutate((d) => Object.assign(d.projects[i], patch));
  }

  addProject() {
    this.store.mutate((d) => d.projects.push(emptyProject()));
  }

  removeProject(i: number) {
    this.store.mutate((d) => d.projects.splice(i, 1));
  }

  // -------------------------------------------------------------- education
  patchEducation(i: number, patch: Partial<Education>) {
    this.store.mutate((d) => Object.assign(d.education[i], patch));
  }

  addEducation() {
    this.store.mutate((d) => d.education.push(emptyEducation()));
  }

  removeEducation(i: number) {
    this.store.mutate((d) => d.education.splice(i, 1));
  }
}
