import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ChecksPanel } from './features/cv/ui/checks-panel/checks-panel';
import { CvForm } from './features/cv/ui/cv-form/cv-form';
import { XraySheet } from './features/cv/ui/xray-sheet/xray-sheet';
import { CvStore } from './features/cv/state/cv-store';
import { DocxExport } from './features/cv/export/docx-export';
import { PdfExport } from './features/cv/export/pdf-export';
import { saveBlob } from './features/cv/export/download';
import { Theme } from './features/theme/theme';
import { ExtractText } from './features/cv/import/extract-text';
import { parseCv } from './features/cv/import/parse-cv';

@Component({
  selector: 'app-root',
  imports: [ChecksPanel, CvForm, XraySheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private store = inject(CvStore);
  private pdf = inject(PdfExport);
  private docx = inject(DocxExport);
  readonly theme = inject(Theme);
  private extract = inject(ExtractText);

  readonly cv = this.store.cv;
  readonly status = signal('');
  readonly busy = signal(false);
  readonly menuOpen = signal(false);

  readonly pages = computed(() => {
    try {
      return this.pdf.pageCount(this.cv());
    } catch {
      return 1;
    }
  });

  private flash(message: string) {
    this.status.set(message);
    setTimeout(() => this.status.set(''), 3200);
  }

  toggleMenu() {
    this.menuOpen.update((v) => !v);
  }

  // Close only when focus really leaves the menu, not when it moves between
  // the items inside it.
  closeMenu(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.menuOpen.set(false);
  }

  downloadPdf() {
    this.busy.set(true);
    try {
      this.pdf.download(this.cv());
      this.flash('PDF downloaded.');
    } catch {
      this.flash('Could not build the PDF.');
    } finally {
      this.busy.set(false);
    }
  }

  async downloadDocx() {
    this.busy.set(true);
    try {
      await this.docx.download(this.cv());
      this.flash('DOCX downloaded.');
    } catch {
      this.flash('Could not build the DOCX.');
    } finally {
      this.busy.set(false);
    }
  }

  loadSample() {
    this.store.loadSample();
    this.menuOpen.set(false);
    this.flash('Sample loaded.');
  }

  clear() {
    this.menuOpen.set(false);
    if (confirm('Clear everything and start from scratch? This cannot be undone.')) {
      this.store.reset();
      this.flash('Cleared.');
    }
  }

  saveJson() {
    saveBlob(new Blob([this.store.exportJson()], { type: 'application/json' }), 'cv-data.json');
    this.menuOpen.set(false);
    this.flash('Saved as cv-data.json.');
  }

  // Reads an existing CV and fills the form from it. Heuristic by nature, so
  // the result is reported honestly and left in the form for review.
  async importCv(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.menuOpen.set(false);
    this.busy.set(true);
    try {
      const text = await this.extract.fromFile(file);
      if (text.trim().length < 40) {
        this.flash('Almost no text came out of that file — it may be a scan or an image.');
        return;
      }

      const { cv, found, confidence } = parseCv(text);
      this.store.cv.set(cv);

      const summary = found
        .filter((f) => f.count > 0)
        .map((f) => `${f.count} ${f.section}`)
        .join(', ');

      if (confidence < 3) {
        this.flash(
          'That file did not look much like a CV, so the fields are a rough guess. Check every one.',
        );
      } else {
        this.flash(`Imported ${summary}. Check every field before you send it.`);
      }
    } catch (error) {
      this.flash(error instanceof Error ? error.message : 'Could not read that file.');
    } finally {
      this.busy.set(false);
      input.value = '';
    }
  }

  loadJson(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.menuOpen.set(false);
    void file.text().then((text) => {
      this.flash(this.store.importJson(text) ? 'Data loaded.' : 'That file is not valid CV data.');
      input.value = '';
    });
  }
}
