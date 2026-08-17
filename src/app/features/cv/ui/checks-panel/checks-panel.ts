import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AtsCheck } from '../../domain/ats-check';

// Lives at the top of the rail rather than behind a tab: "is this good enough
// to send" is the question people actually arrive with.
@Component({
  selector: 'checks-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checks-panel.html',
  styleUrl: './checks-panel.scss',
})
export class ChecksPanel {
  private ats = inject(AtsCheck);

  readonly open = signal(false);
  readonly findings = this.ats.findings;
  readonly errors = this.ats.errorCount;
  readonly warnings = this.ats.warningCount;

  readonly clean = computed(() => this.errors() === 0 && this.warnings() === 0);

  readonly headline = computed(() => {
    const e = this.errors();
    const w = this.warnings();
    if (!e && !w) return 'Nothing blocking';
    const parts: string[] = [];
    if (e) parts.push(`${e} blocking`);
    if (w) parts.push(`${w} to look at`);
    return parts.join(', ');
  });

  toggle() {
    this.open.update((v) => !v);
  }
}
