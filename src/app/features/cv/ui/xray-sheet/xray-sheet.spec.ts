import { TestBed } from '@angular/core/testing';

import { XraySheet } from './xray-sheet';

describe('XraySheet', () => {
  let sheet: XraySheet;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [XraySheet] }).compileComponents();
    sheet = TestBed.createComponent(XraySheet).componentInstance;
  });

  it('snaps to each end and back to the middle', () => {
    sheet.reveal('machine');
    expect(sheet.split()).toBe(0);

    sheet.reveal('page');
    expect(sheet.split()).toBe(100);

    sheet.reveal('even');
    expect(sheet.split()).toBeGreaterThan(0);
    expect(sheet.split()).toBeLessThan(100);
  });

  it('moves with the arrow keys and stays within bounds', () => {
    sheet.split.set(50);
    sheet.nudge(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(sheet.split()).toBe(52);

    sheet.nudge(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true }));
    expect(sheet.split()).toBe(42);

    sheet.nudge(new KeyboardEvent('keydown', { key: 'End' }));
    expect(sheet.split()).toBe(100);

    sheet.nudge(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(sheet.split()).toBe(0);
  });

  it('ignores keys that are not a nudge', () => {
    sheet.split.set(30);
    sheet.nudge(new KeyboardEvent('keydown', { key: 'a' }));
    expect(sheet.split()).toBe(30);
  });
});
