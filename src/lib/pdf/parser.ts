import { PdfReader } from "pdfreader";

export interface PDFParseResult {
  text: string;
  numPages: number;
  info: any;
  success: boolean;
  error?: string;
}

export async function parsePDF(fileBuffer: Buffer): Promise<PDFParseResult> {
  return new Promise((resolve) => {
    const textByPage: { [page: number]: string[] } = {};
    let maxPage = 0;

    new PdfReader({}).parseBuffer(fileBuffer, (err: any, item: any) => {
      if (err) {
        console.error("Error parsing PDF:", err);
        resolve({
          text: "",
          numPages: 0,
          info: {},
          success: false,
          error: err.message || "Unknown error parsing PDF",
        });
        return;
      }

      if (!item) {
        // End of file
        const pages = Object.keys(textByPage)
          .sort((a, b) => parseInt(a) - parseInt(b))
          .map(pageNum => textByPage[parseInt(pageNum)].join(' '));

        resolve({
          text: pages.join('\n\n'),
          numPages: maxPage + 1,
          info: {},
          success: true,
        });
        return;
      }

      if (item.page !== undefined) {
        maxPage = Math.max(maxPage, item.page);
      }

      if (item.text) {
        const page = item.page || 0;
        if (!textByPage[page]) {
          textByPage[page] = [];
        }
        textByPage[page].push(item.text);
      }
    });
  });
}

export function validatePDFFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (file.type !== "application/pdf") {
    return {
      valid: false,
      error: "File must be a PDF",
    };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "File size must be less than 10MB",
    };
  }

  return { valid: true };
}

export async function extractTextFromPDF(fileBuffer: Buffer): Promise<string> {
  const result = await parsePDF(fileBuffer);

  if (!result.success) {
    throw new Error(result.error || "Failed to parse PDF");
  }

  return result.text;
}
