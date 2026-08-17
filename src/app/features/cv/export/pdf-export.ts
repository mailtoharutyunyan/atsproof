import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';

import { CvModel, fullName } from '../models/cv.model';
import { Block, Run, buildLayout, toAscii } from '../domain/cv-layout';
import { cvFilename, saveBlob } from './download';

// Draws with jsPDF's built-in Times face: real selectable text, no embedded
// font payload. Worth being strict about, since a PDF rendered to canvas
// extracts as nothing at all.

const PAGE_W = 8.5;
const PAGE_H = 11;
const SIDE_MARGIN = 0.75;
const BULLET_INDENT = 0.45;
const BULLET_HANG = 0.25;
const PT = 1 / 72;

interface Line {
  runs: Run[];
  indent: number;
  right?: Run[]; // right-aligned, same baseline
  align: 'left' | 'center';
  size: number;
  height: number;
  spaceBefore: number;
  group?: number;
  bulletGlyph?: boolean;
  block: number; // index of the layout block this line came from
}

@Injectable({ providedIn: 'root' })
export class PdfExport {
  private setFont(doc: jsPDF, run: Run, size: number) {
    const style = run.bold && run.italic ? 'bolditalic' : run.bold ? 'bold' : run.italic ? 'italic' : 'normal';
    doc.setFont('times', style);
    doc.setFontSize(size);
  }

  private runsWidth(doc: jsPDF, runs: Run[], size: number): number {
    return runs.reduce((w, r) => {
      this.setFont(doc, r, size);
      return w + doc.getTextWidth(r.text);
    }, 0);
  }

  // Greedy wrap. Runs carry their own styling, so widths are measured per run.
  private wrap(doc: jsPDF, runs: Run[], size: number, maxWidth: number): Run[][] {
    const lines: Run[][] = [];
    let current: Run[] = [];
    let width = 0;

    for (const run of runs) {
      this.setFont(doc, run, size);
      const spaceW = doc.getTextWidth(' ');
      const words = run.text.split(/\s+/).filter((w) => w.length);

      for (const word of words) {
        const wordW = doc.getTextWidth(word);
        const needsSpace = current.length > 0;
        const advance = wordW + (needsSpace ? spaceW : 0);

        if (width + advance > maxWidth && current.length) {
          lines.push(current);
          current = [];
          width = 0;
        }

        const last = current[current.length - 1];
        if (last && !!last.bold === !!run.bold && !!last.italic === !!run.italic) {
          last.text += ' ' + word;
        } else {
          // The separating space belongs to the end of the previous run: each
          // run is drawn as its own text op, and a leading space would be
          // trimmed, welding "Technologies:" onto "Java".
          if (last) last.text += ' ';
          current.push({ text: word, bold: run.bold, italic: run.italic });
        }
        width += advance;
      }
    }
    if (current.length) lines.push(current);
    return lines.length ? lines : [[{ text: '' }]];
  }

  
  private layoutLines(doc: jsPDF, cv: CvModel): Line[] {
    const blocks = buildLayout(cv);
    const base = cv.fontSize;
    const contentW = PAGE_W - SIDE_MARGIN * 2;
    const out: Line[] = [];

    blocks.forEach((b, blockIndex) => {
      const size = this.sizeFor(b, base);
      const lead = size * 1.16 * PT;
      const space = b.spaceBefore * cv.spacing * PT;

      if (b.type === 'split') {
        const rightW = this.runsWidth(doc, b.right ?? [], size);
        const leftMax = contentW - rightW - 0.12;
        const wrapped = this.wrap(doc, b.runs, size, leftMax);
        wrapped.forEach((runs, i) => {
          out.push({
            runs,
            right: i === 0 ? b.right : undefined,
            indent: 0,
            align: 'left',
            size,
            height: lead,
            spaceBefore: i === 0 ? space : 0,
            group: b.group,
            block: blockIndex,
          });
        });
        return;
      }

      const isBullet = b.type === 'bullet';
      const indent = isBullet ? BULLET_INDENT : 0;
      const align = b.type === 'name' || b.type === 'tagline' || b.type === 'center' ? 'center' : 'left';
      const wrapped = this.wrap(doc, b.runs, size, contentW - indent);

      wrapped.forEach((runs, i) => {
        out.push({
          runs,
          indent,
          align,
          size,
          height: lead,
          spaceBefore: i === 0 ? space : 0,
          group: b.group,
          bulletGlyph: isBullet && i === 0,
          block: blockIndex,
        });
      });

      // A heading owns a rule under it; reserve the gap here.
      if (b.type === 'heading') out[out.length - 1].height += 3 * PT;
    });

    return out;
  }

  private sizeFor(b: Block, base: number): number {
    if (b.type === 'name') return base + 4.5;
    if (b.type === 'heading') return base + 0.5;
    return base;
  }

  // Lines sharing a group id move as a unit, so a job never splits across
  // pages. A plain "break when it overflows" loop can't express that.
  private paginate(lines: Line[], usableH: number): Line[][] {
    const pages: Line[][] = [];
    let page: Line[] = [];
    let y = 0;

    const chunkHeight = (chunk: Line[], atTop: boolean) =>
      chunk.reduce((h, l, i) => h + l.height + (atTop && i === 0 ? 0 : l.spaceBefore), 0);

    for (let i = 0; i < lines.length; ) {
      // Collect the next atomic unit: a whole group, or a single line.
      let end = i + 1;
      if (lines[i].group !== undefined) {
        while (end < lines.length && lines[end].group === lines[i].group) end++;
      }
      const chunk = lines.slice(i, end);
      const needed = chunkHeight(chunk, page.length === 0);

      if (page.length && y + needed > usableH) {
        pages.push(page);
        page = [];
        y = 0;
      }
      chunk.forEach((l, k) => {
        page.push(l);
        y += l.height + (page.length === 1 && k === 0 ? 0 : l.spaceBefore);
      });
      i = end;
    }
    if (page.length) pages.push(page);
    // A document with nothing in it is still one blank page, not zero.
    return pages.length ? pages : [[]];
  }

  private drawRuns(doc: jsPDF, runs: Run[], x: number, y: number, size: number) {
    let cursor = x;
    for (const r of runs) {
      this.setFont(doc, r, size);
      doc.text(r.text, cursor, y);
      cursor += doc.getTextWidth(r.text);
    }
  }

  build(cv: CvModel): jsPDF {
    const doc = new jsPDF({ unit: 'in', format: 'letter', compress: true });
    doc.setProperties({
      title: `${toAscii(fullName(cv))} - CV`,
      author: toAscii(fullName(cv)),
      subject: toAscii(cv.headline),
      keywords: (cv.skills ?? []).map((s) => toAscii(s.items)).join(', '),
    });

    const lines = this.layoutLines(doc, cv);
    const usableH = PAGE_H - cv.margin * 2;
    const pages = this.paginate(lines, usableH);

    pages.forEach((page, pageIndex) => {
      if (pageIndex > 0) doc.addPage();
      let y = cv.margin;

      page.forEach((line, i) => {
        y += i === 0 ? 0 : line.spaceBefore;
        y += line.size * PT; // advance to the baseline

        const x = SIDE_MARGIN + line.indent;
        if (line.align === 'center') {
          const w = this.runsWidth(doc, line.runs, line.size);
          this.drawRuns(doc, line.runs, (PAGE_W - w) / 2, y, line.size);
        } else {
          if (line.bulletGlyph) {
            doc.setFont('times', 'normal');
            doc.setFontSize(line.size);
            doc.text('•', x - BULLET_HANG, y);
          }
          this.drawRuns(doc, line.runs, x, y, line.size);

          if (line.right?.length) {
            const w = this.runsWidth(doc, line.right, line.size);
            this.drawRuns(doc, line.right, PAGE_W - SIDE_MARGIN - w, y, line.size);
          }
        }

        // Section headings get a hairline rule across the content width.
        if (line.size > cv.fontSize && line.size < cv.fontSize + 2 && !line.right) {
          const ruleY = y + 2.2 * PT;
          doc.setLineWidth(0.008);
          doc.line(SIDE_MARGIN, ruleY, PAGE_W - SIDE_MARGIN, ruleY);
        }

        y += (line.height - line.size * PT);
      });
    });

    return doc;
  }

  download(cv: CvModel) {
    saveBlob(this.build(cv).output('blob'), cvFilename(fullName(cv), cv.headline, 'pdf'));
  }

  // Index of the first layout block on each page. The preview uses this to
  // break the document in the same places the PDF does, so what you see on
  // screen is where the page actually ends.
  pageStarts(cv: CvModel): number[] {
    const doc = new jsPDF({ unit: 'in', format: 'letter' });
    const pages = this.paginate(this.layoutLines(doc, cv), PAGE_H - cv.margin * 2);
    return pages.map((page) => page[0]?.block ?? 0);
  }

  pageCount(cv: CvModel): number {
    const doc = new jsPDF({ unit: 'in', format: 'letter' });
    const lines = this.layoutLines(doc, cv);
    return this.paginate(lines, PAGE_H - cv.margin * 2).length;
  }
}
