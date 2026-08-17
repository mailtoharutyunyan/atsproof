import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { AtsCheck } from '../../domain/ats-check';
import { CvStore } from '../../state/cv-store';
import { CvPreview } from '../cv-preview/cv-preview';

// Two renderings of the same page, stacked and clipped against each other:
// the typeset sheet on the left of the handle, the text an ATS actually
// extracts on the right. Dragging between them is the whole argument for this
// tool, so it gets to be the thing you touch rather than a tab you might miss.
const PAGE_WIDTH_PX = 8.5 * 96; // the sheet at 100%
const PAGE_HEIGHT_PX = 11 * 96;
const GUTTER_X = 128; // stage padding, both sides
const GUTTER_Y = 112; // stage padding plus room for the floating dock
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.6;

@Component({
  selector: 'xray-sheet',
  imports: [CvPreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './xray-sheet.html',
  styleUrl: './xray-sheet.scss',
})
export class XraySheet {
  private store = inject(CvStore);
  private ats = inject(AtsCheck);

  /** Where the reveal sits, 0 (all machine) to 100 (all page). */
  readonly split = signal(58);
  readonly zoom = signal(1);
  readonly dragging = signal(false);

  private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly stageSize = signal({ width: 0, height: 0 });
  // Once someone moves the slider, stop second-guessing them on resize.
  private readonly manualZoom = signal(false);

  constructor() {
    effect((onCleanup) => {
      const host = this.stageRef()?.nativeElement;
      if (!host || typeof ResizeObserver === 'undefined') return;

      const observer = new ResizeObserver(([entry]) =>
        this.stageSize.set({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        }),
      );
      observer.observe(host);
      onCleanup(() => observer.disconnect());
    });

    // Fit a whole page into the stage, the way any document viewer does.
    // Fitting width alone looks impressive and then makes you scroll for the
    // bottom half of your own CV.
    effect(() => {
      if (this.manualZoom()) return;
      const fit = this.fitFor(this.stageSize());
      if (fit) this.zoom.set(fit);
    });
  }

  readonly plainText = this.ats.plainText;
  readonly pad = computed(() => `${this.store.cv().margin}in 0.75in`);

  private track: HTMLElement | null = null;

  start(event: PointerEvent) {
    this.track = (event.currentTarget as HTMLElement).parentElement;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.dragging.set(true);
    event.preventDefault();
  }

  move(event: PointerEvent) {
    if (!this.dragging() || !this.track) return;
    const box = this.track.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    this.split.set(Math.min(100, Math.max(0, ratio * 100)));
  }

  end(event: PointerEvent) {
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.dragging.set(false);
  }

  nudge(event: KeyboardEvent) {
    const step = event.shiftKey ? 10 : 2;
    const moves: Record<string, number> = {
      ArrowLeft: -step,
      ArrowRight: step,
      Home: -100,
      End: 100,
    };
    const delta = moves[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    this.split.update((v) => Math.min(100, Math.max(0, v + delta)));
  }

  setZoom(value: string) {
    this.manualZoom.set(true);
    this.zoom.set(+value);
  }

  fitToStage() {
    this.manualZoom.set(false);
    const fit = this.fitFor(this.stageSize());
    if (fit) this.zoom.set(fit);
  }

  private fitFor({ width, height }: { width: number; height: number }): number | null {
    if (!width || !height) return null;
    const scale = Math.min(
      (width - GUTTER_X) / PAGE_WIDTH_PX,
      (height - GUTTER_Y) / PAGE_HEIGHT_PX,
    );
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(scale.toFixed(2))));
  }

  reveal(target: 'page' | 'machine' | 'even') {
    this.split.set(target === 'page' ? 100 : target === 'machine' ? 0 : 58);
  }
}
