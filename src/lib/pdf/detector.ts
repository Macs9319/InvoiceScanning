/**
 * Scanned Document Detection Utility
 *
 * Analyzes PDF text extraction results to determine if a document
 * is likely a scanned/image-based PDF that would benefit from Vision API processing.
 */

export interface ScannedDocumentDetectionResult {
  isScanned: boolean;
  confidence: number; // 0-1, how confident we are in the detection
  textDensity: number; // characters per page
  reasons: string[]; // Why we think it's scanned (or not)
}

/**
 * Heuristics for detecting scanned documents
 */
const DETECTION_THRESHOLDS = {
  // Very low text density suggests scanned document
  MIN_TEXT_DENSITY: 100, // chars per page

  // Optimal text density for normal PDFs
  NORMAL_TEXT_DENSITY: 500, // chars per page

  // Maximum confidence threshold
  HIGH_CONFIDENCE: 0.9,
  MEDIUM_CONFIDENCE: 0.7,
  LOW_CONFIDENCE: 0.5,
} as const;

/**
 * Calculate text density (characters per page)
 */
export function calculateTextDensity(text: string, pageCount: number = 1): number {
  if (!text || pageCount <= 0) return 0;

  // Remove excessive whitespace for more accurate count
  const cleanedText = text.trim().replace(/\s+/g, ' ');
  return cleanedText.length / pageCount;
}

/**
 * Detect if a PDF is likely a scanned document
 *
 * @param text - Extracted text from PDF
 * @param pageCount - Number of pages in PDF (default: 1)
 * @returns Detection result with confidence and reasons
 */
export function detectScannedDocument(
  text: string,
  pageCount: number = 1
): ScannedDocumentDetectionResult {
  const reasons: string[] = [];
  let confidence = 0;

  // Calculate text density
  const textDensity = calculateTextDensity(text, pageCount);

  // Heuristic 1: Very low or no text
  if (!text || text.trim().length === 0) {
    reasons.push('No extractable text found');
    confidence = DETECTION_THRESHOLDS.HIGH_CONFIDENCE;
    return {
      isScanned: true,
      confidence,
      textDensity,
      reasons,
    };
  }

  // Heuristic 2: Extremely low text density
  if (textDensity < DETECTION_THRESHOLDS.MIN_TEXT_DENSITY) {
    reasons.push(`Very low text density (${Math.round(textDensity)} chars/page)`);
    confidence += 0.5;
  }

  // Heuristic 3: Check for common OCR artifacts/errors
  const ocrArtifacts = [
    /[Il1]{3,}/, // Multiple consecutive I, l, 1 (common OCR confusion)
    /[O0]{3,}/, // Multiple consecutive O, 0
    /[^\x00-\x7F]{10,}/, // Lots of non-ASCII characters (poor OCR)
  ];

  const hasOcrArtifacts = ocrArtifacts.some(pattern => pattern.test(text));
  if (hasOcrArtifacts) {
    reasons.push('Contains OCR artifacts or errors');
    confidence += 0.2;
  }

  // Heuristic 4: Very short text for multi-page document
  if (pageCount > 1 && textDensity < DETECTION_THRESHOLDS.MIN_TEXT_DENSITY / 2) {
    reasons.push(`Multi-page document with minimal text (${pageCount} pages)`);
    confidence += 0.3;
  }

  // Heuristic 5: Check for meaningful words vs gibberish
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const shortWords = words.filter(w => w.length <= 2).length;
  const shortWordRatio = words.length > 0 ? shortWords / words.length : 0;

  if (shortWordRatio > 0.7 && words.length > 10) {
    reasons.push('High ratio of gibberish or fragmented text');
    confidence += 0.2;
  }

  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);

  // Determine if scanned based on confidence
  const isScanned = confidence >= DETECTION_THRESHOLDS.LOW_CONFIDENCE;

  if (!isScanned) {
    reasons.push(`Normal text density (${Math.round(textDensity)} chars/page)`);
  }

  return {
    isScanned,
    confidence,
    textDensity,
    reasons,
  };
}

/**
 * Get a human-readable detection summary
 */
export function getDetectionSummary(result: ScannedDocumentDetectionResult): string {
  if (result.isScanned) {
    const confidenceLevel =
      result.confidence >= DETECTION_THRESHOLDS.HIGH_CONFIDENCE ? 'high' :
      result.confidence >= DETECTION_THRESHOLDS.MEDIUM_CONFIDENCE ? 'medium' : 'low';

    return `Scanned document detected (${confidenceLevel} confidence): ${result.reasons.join(', ')}`;
  }

  return `Normal text-based PDF (${Math.round(result.textDensity)} chars/page)`;
}
