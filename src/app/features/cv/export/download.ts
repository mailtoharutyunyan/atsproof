import { toAscii } from '../domain/cv-layout';

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// e.g. Jordan-Avery-Senior-Software-Engineer-CV.pdf
export function cvFilename(name: string, headline: string, extension: string): string {
  const slug = (s: string) =>
    toAscii(s)
      .replace(/[^A-Za-z0-9 ]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-');
  const role = slug(headline.split('|')[0] ?? '');
  return [slug(name) || 'CV', role, 'CV'].filter(Boolean).join('-') + '.' + extension;
}
