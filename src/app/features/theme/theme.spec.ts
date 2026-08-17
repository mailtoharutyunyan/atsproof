import { TestBed } from '@angular/core/testing';

import { Theme } from './theme';

describe('Theme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
    TestBed.configureTestingModule({});
  });

  it('starts light when nothing has been chosen', () => {
    const theme = TestBed.inject(Theme);
    expect(theme.choice()).toBe('light');
    expect(theme.resolved()).toBe('light');
  });

  it('restores a previous choice ahead of the default', () => {
    localStorage.setItem('atsproof:theme', 'dark');
    const theme = TestBed.inject(Theme);
    expect(theme.resolved()).toBe('dark');
  });

  it('toggles to the opposite of whatever is showing, and remembers it', () => {
    const theme = TestBed.inject(Theme);
    const before = theme.resolved();

    theme.toggle();
    TestBed.tick();

    expect(theme.resolved()).not.toBe(before);
    expect(theme.choice()).not.toBe('system');
    expect(localStorage.getItem('atsproof:theme')).toBe(theme.resolved());
  });

  it('writes the theme onto the document so CSS can react', () => {
    const theme = TestBed.inject(Theme);
    theme.choice.set('light');
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('light');

    theme.choice.set('dark');
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
