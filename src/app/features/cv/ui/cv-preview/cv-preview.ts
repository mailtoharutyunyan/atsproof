import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { Block } from '../../domain/cv-layout';
import { CvStore } from '../../state/cv-store';
import { PdfExport } from '../../export/pdf-export';

// Same blocks, point sizes and margins as the exporters, and split into pages
// by the exporter's own paginator — so the breaks shown here are the breaks you
// get in the file.
@Component({
  selector: 'cv-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cv-preview.html',
  styleUrl: './cv-preview.scss',
})
export class CvPreview {
  private store = inject(CvStore);
  private pdf = inject(PdfExport);

  readonly pad = computed(() => `${this.store.cv().margin}in 0.75in`);

  readonly pages = computed<Block[][]>(() => {
    const blocks = this.store.blocks();
    if (!blocks.length) return [[]];

    let starts: number[];
    try {
      starts = this.pdf.pageStarts(this.store.cv());
    } catch {
      return [blocks];
    }
    if (starts.length < 2) return [blocks];

    return starts.map((start, i) => blocks.slice(start, starts[i + 1] ?? blocks.length));
  });

  size(b: Block): number {
    const base = this.store.cv().fontSize;
    if (b.type === 'name') return base + 4.5;
    if (b.type === 'heading') return base + 0.5;
    return base;
  }

  // The first block on a page sits flush against the top margin; its leading
  // whitespace belongs to the previous page.
  gap(b: Block, firstOnPage: boolean): number {
    return firstOnPage ? 0 : b.spaceBefore * this.store.cv().spacing;
  }
}
