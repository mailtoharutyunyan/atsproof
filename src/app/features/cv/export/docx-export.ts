import { Injectable } from '@angular/core';

import { CvModel, fullName } from '../models/cv.model';
import { Run, buildLayout, toAscii } from '../domain/cv-layout';
import { cvFilename, saveBlob } from './download';

// Same layout blocks as the PDF. Worth shipping both: some systems parse Word
// more reliably, and a few portals accept nothing else.
//
// docx loads on first use, not at startup. It's large and most visitors are
// still typing when the page loads.

const TWIP_PER_PT = 20;
const HALF_PT = 2; // docx font sizes are in half-points

@Injectable({ providedIn: 'root' })
export class DocxExport {
  private async build(cv: CvModel) {
    const {
      AlignmentType,
      BorderStyle,
      Document,
      Paragraph,
      TabStopPosition,
      TabStopType,
      TextRun,
    } = await import('docx');

    const base = cv.fontSize;
    const blocks = buildLayout(cv);
    const paragraphs: InstanceType<typeof Paragraph>[] = [];

    const runs = (list: Run[], size: number) =>
      list.map(
        (r) =>
          new TextRun({
            text: r.text,
            bold: r.bold,
            italics: r.italic,
            font: 'Times New Roman',
            size: Math.round(size * HALF_PT),
          }),
      );

    // Chain keep-with-next across each group so a job stays whole, mirroring
    // the page-break rule the PDF exporter applies.
    const lastOfGroup = new Map<number, number>();
    blocks.forEach((b, i) => {
      if (b.group !== undefined) lastOfGroup.set(b.group, i);
    });

    blocks.forEach((b, i) => {
      const size = b.type === 'name' ? base + 4.5 : b.type === 'heading' ? base + 0.5 : base;
      const spacing = { before: Math.round(b.spaceBefore * cv.spacing * TWIP_PER_PT), after: 0 };
      const keepNext = b.group !== undefined && lastOfGroup.get(b.group) !== i;

      if (b.type === 'name' || b.type === 'tagline' || b.type === 'center') {
        paragraphs.push(
          new Paragraph({ alignment: AlignmentType.CENTER, spacing, children: runs(b.runs, size) }),
        );
        return;
      }

      if (b.type === 'heading') {
        paragraphs.push(
          new Paragraph({
            spacing: { ...spacing, after: 3 * TWIP_PER_PT },
            keepNext: true,
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: '000000' } },
            children: runs(b.runs, size),
          }),
        );
        return;
      }

      if (b.type === 'split') {
        paragraphs.push(
          new Paragraph({
            spacing,
            keepNext,
            keepLines: true,
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              ...runs(b.runs, size),
              new TextRun({ text: '\t', font: 'Times New Roman', size: size * HALF_PT }),
              ...runs(b.right ?? [], size),
            ],
          }),
        );
        return;
      }

      paragraphs.push(
        new Paragraph({
          spacing,
          keepNext,
          keepLines: true,
          bullet: b.type === 'bullet' ? { level: 0 } : undefined,
          children: runs(b.runs, size),
        }),
      );
    });

    const margin = Math.round(cv.margin * 1440);
    return new Document({
      title: `${toAscii(fullName(cv))} - CV`,
      creator: toAscii(fullName(cv)),
      description: toAscii(cv.headline),
      keywords: cv.skills.map((s) => toAscii(s.items)).join(', '),
      styles: {
        default: {
          document: {
            run: { font: 'Times New Roman', size: base * HALF_PT, color: '000000' },
            paragraph: { spacing: { line: 240, before: 0, after: 0 } },
          },
        },
      },
      sections: [
        {
          properties: { page: { margin: { top: margin, bottom: margin, left: 1080, right: 1080 } } },
          children: paragraphs,
        },
      ],
    });
  }

  async download(cv: CvModel) {
    const { Packer } = await import('docx');
    const blob = await Packer.toBlob(await this.build(cv));
    saveBlob(blob, cvFilename(fullName(cv), cv.headline, 'docx'));
  }
}
