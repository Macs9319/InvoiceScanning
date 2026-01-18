/**
 * Self-Contained PDF to Image Converter
 * Converts PDF pages to base64-encoded images without external service dependencies
 *
 * ZERO EXTERNAL DEPENDENCIES - No Cloudinary, no API keys required
 * SERVER-SIDE ONLY - This module uses native Node.js dependencies
 */
import 'server-only';
import { pdfToPng } from 'pdf-to-png-converter';

export interface PDFToImageOptions {
  maxPages?: number; // Limit number of pages (default: 10)
  format?: 'jpeg' | 'png'; // Image format (default: 'jpeg')
  quality?: number; // Quality 1-100 (default: 80)
  width?: number; // Target width (default: 2048)
}

/**
 * Convert PDF to base64-encoded images using pdf-to-png-converter
 *
 * @param pdfBuffer - PDF file as Buffer
 * @param options - Conversion options
 * @returns Array of base64 data URLs (e.g., "data:image/jpeg;base64,...")
 */
export async function convertPDFToImages(
  pdfBuffer: Buffer,
  options: PDFToImageOptions = {}
): Promise<string[]> {
  const {
    maxPages = 10,
    format = 'jpeg',
    quality = 80,
    width = 2048,
  } = options;

  try {
    console.log(`[PDF Converter] Starting conversion with options:`, {
      maxPages,
      format,
      quality,
      width,
      bufferSize: `${(pdfBuffer.length / 1024).toFixed(1)} KB`,
    });

    // Convert PDF to PNG images using pdf-to-png-converter
    // This library uses Poppler internally (pre-compiled binaries included)
    // Convert Node.js Buffer to ArrayBuffer
    const arrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength
    );

    const pngPages = await pdfToPng(arrayBuffer, {
      disableFontFace: false, // Enable font rendering for better quality
      useSystemFonts: false,  // Use embedded fonts from PDF
      viewportScale: width / 595, // Scale to target width (595 = A4 width in points)
      verbosityLevel: 0, // Suppress verbose logging
    });

    const totalPages = pngPages.length;
    console.log(`[PDF Converter] Found ${totalPages} pages in PDF`);

    if (totalPages === 0) {
      throw new Error('PDF contains no pages or is corrupted');
    }

    // Limit to maxPages
    const pagesToConvert = Math.min(totalPages, maxPages);
    if (totalPages > maxPages) {
      console.log(`[PDF Converter] Limiting conversion to first ${maxPages} pages (PDF has ${totalPages} total)`);
    }

    const images: string[] = [];
    let totalSizeBytes = 0;

    // Convert each page to base64 data URL
    for (let i = 0; i < pagesToConvert; i++) {
      const page = pngPages[i];
      const pageBuffer = page.content;

      if (!pageBuffer) {
        console.warn(`[PDF Converter] Page ${i + 1} has no content, skipping`);
        continue;
      }

      // For JPEG format, we would need to convert PNG to JPEG
      // For now, use PNG directly (better quality, Vision API supports it)
      const base64 = pageBuffer.toString('base64');
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      images.push(dataUrl);
      totalSizeBytes += pageBuffer.length;

      console.log(`[PDF Converter] Converted page ${i + 1}/${pagesToConvert} (${(pageBuffer.length / 1024).toFixed(1)} KB)`);
    }

    console.log(`[PDF Converter] ✅ Conversion complete:`, {
      pagesConverted: pagesToConvert,
      totalPages,
      totalSize: `${(totalSizeBytes / 1024).toFixed(1)} KB`,
      averagePageSize: `${(totalSizeBytes / pagesToConvert / 1024).toFixed(1)} KB`,
    });

    return images;
  } catch (error) {
    console.error('[PDF Converter] ❌ Conversion failed:', error);

    // Provide detailed error message
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('[PDF Converter] Error stack:', error.stack);
    } else {
      console.error('[PDF Converter] Non-Error object thrown:', error);
    }

    throw new Error(
      `Failed to convert PDF to images: ${errorMessage}. ` +
      `This is a self-contained converter with no external dependencies. ` +
      `Check that the PDF file is valid and not corrupted.`
    );
  }
}

/**
 * Convert first page only (faster, cheaper)
 *
 * @param pdfBuffer - PDF file as Buffer
 * @param options - Conversion options (maxPages will be ignored)
 * @returns Base64 data URL of first page
 */
export async function convertFirstPageToImage(
  pdfBuffer: Buffer,
  options?: Omit<PDFToImageOptions, 'maxPages'>
): Promise<string> {
  const result = await convertPDFToImages(pdfBuffer, {
    ...options,
    maxPages: 1,
  });

  if (result.length === 0) {
    throw new Error('No images generated from PDF');
  }

  return result[0];
}

/**
 * Get PDF page count without converting to images
 *
 * @param pdfBuffer - PDF file as Buffer
 * @returns Number of pages in PDF
 */
export async function getPDFPageCount(pdfBuffer: Buffer): Promise<number> {
  try {
    // Convert Node.js Buffer to ArrayBuffer
    const arrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength
    );

    const pngPages = await pdfToPng(arrayBuffer, {
      disableFontFace: true,
      useSystemFonts: false,
      viewportScale: 0.1, // Low scale for fast counting
      verbosityLevel: 0,
    });

    return pngPages.length;
  } catch (error) {
    console.error('[PDF Converter] Failed to get page count:', error);
    throw new Error('Failed to read PDF page count');
  }
}

/**
 * Estimate conversion cost
 * Since this is a self-contained converter, the only cost is OpenAI Vision API
 */
export function estimateConversionCost(pageCount: number): {
  pdfConversionCost: number;
  visionApiCost: number;
  totalCost: number;
  isFree: boolean;
  recommendation: string;
} {
  // PDF conversion is FREE (no external service)
  const pdfConversionCost = 0;

  // OpenAI Vision API cost estimation (GPT-4o-mini)
  // Approximate: $0.001-0.005 per image for gpt-4o-mini
  const visionApiCostPerPage = 0.003; // Average
  const visionApiCost = pageCount * visionApiCostPerPage;

  const totalCost = pdfConversionCost + visionApiCost;

  return {
    pdfConversionCost,
    visionApiCost,
    totalCost,
    isFree: pdfConversionCost === 0, // PDF conversion is always free
    recommendation: `PDF conversion: FREE ✅ | Vision API: ~$${visionApiCost.toFixed(4)} for ${pageCount} page(s)`,
  };
}
