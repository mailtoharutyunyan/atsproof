import { TestBed } from '@angular/core/testing';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('renders the rail and the sheet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('cv-form')).toBeTruthy();
    expect(el.querySelector('checks-panel')).toBeTruthy();
    expect(el.querySelector('xray-sheet')).toBeTruthy();
    expect(el.querySelector('cv-preview')).toBeTruthy();
  });

  it('opens and closes the data menu', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.sheet-menu')).toBeNull();

    fixture.componentInstance.toggleMenu();
    await fixture.whenStable();
    expect(el.querySelector('.sheet-menu')).toBeTruthy();

    fixture.componentInstance.toggleMenu();
    await fixture.whenStable();
    expect(el.querySelector('.sheet-menu')).toBeNull();
  });

  it('always reports at least one page', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.componentInstance.pages()).toBeGreaterThanOrEqual(1);
  });
});
