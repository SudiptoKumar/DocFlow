/**
 * Offline OCR Extractor - Uses tesseract.js to extract text from scanned PDFs
 */

export interface OcrProgress {
  page: number;
  totalPages: number;
  status: string;
}

export async function extractTextFromScannedPdf(
  file: File,
  onProgress?: (progress: OcrProgress) => void
): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  // Dynamically import tesseract
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');

  const pages: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.({ page: i, totalPages, status: `Processing page ${i} of ${totalPages}...` });

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // High res for better OCR

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    // Convert canvas to blob for Tesseract
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });

    const { data } = await worker.recognize(blob);
    if (data.text.trim()) {
      pages.push(data.text.trim());
    }

    // Cleanup
    canvas.remove();
  }

  await worker.terminate();

  return pages.join('\n\n---\n\n');
}
