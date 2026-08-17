import { Injectable } from '@angular/core';

// Pulls plain text out of an uploaded CV. Deliberately the same view a parser
// gets: if a file extracts badly here, that is the finding, not a bug to work
// around.
@Injectable({ providedIn: 'root' })
export class ExtractText {
  async fromFile(file: File): Promise<string> {
    const name = file.name.toLowerCase();

    if (name.endsWith('.pdf')) return this.fromPdf(file);
    if (name.endsWith('.docx')) return this.fromDocx(file);
    if (name.endsWith('.txt') || name.endsWith('.md')) return file.text();

    throw new Error('Upload a PDF, DOCX, or TXT file.');
  }

  private async fromPdf(file: File): Promise<string> {
    const pdfjs = await import('pdfjs-dist');
    // The worker ships alongside the library; point at it explicitly so the
    // build can fingerprint it rather than fetching from a CDN.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url,
    ).toString();

    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();

      // Rebuild lines from item positions: pdf text comes out as fragments and
      // joining them blindly welds separate lines together.
      const rows = new Map<number, { x: number; width: number; text: string }[]>();
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
        (rows.get(key) ?? rows.set(key, []).get(key)!).push({
          x: item.transform[4],
          width: 'width' in item ? (item.width as number) : 0,
          text: item.str,
        });
      }

      const lines = [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, parts]) => {
          const sorted = parts.sort((a, b) => a.x - b.x);
          return sorted
            .map((part, i) => {
              if (i === 0) return part.text;
              const previous = sorted[i - 1];
              // A wide jump means a separate column — keep it as a double
              // space so "Company        Location" stays two fields.
              const gap = part.x - (previous.x + previous.width);
              return (gap > 12 ? '  ' : ' ') + part.text;
            })
            .join('')
            .replace(/[ \t]{3,}/g, '  ')
            .trim();
        })
        .filter(Boolean);

      pages.push(lines.join('\n'));
    }

    await doc.cleanup();
    return pages.join('\n');
  }

  private async fromDocx(file: File): Promise<string> {
    const { unzipSync, strFromU8 } = await import('fflate');
    const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const entry = zip['word/document.xml'];
    if (!entry) throw new Error('That DOCX has no readable document part.');

    return strFromU8(entry)
      .replace(/<w:tab[^>]*\/>/g, ' ')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }
}
