export interface AIProviderConfig {
    apiKey?: string;
    baseURL?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
}

export interface ExtractionResult {
    data: any;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cost?: number; // Estimated cost in USD
    };
}

export interface VisionExtractionOptions {
    fileBuffer?: Buffer; // PDF file buffer
    images?: string[]; // Base64 encoded images (alternative to fileBuffer)
    text?: string; // Optional accompanying text
    pageCount?: number; // Number of pages in document
}

export abstract class AIProvider {
    protected config: AIProviderConfig;

    constructor(config: AIProviderConfig) {
        this.config = config;
    }

    abstract extract(text: string, prompt: string, jsonSchema?: any): Promise<ExtractionResult>;

    abstract getProviderName(): string;

    // Vision API extraction (optional - not all providers support it)
    async extractWithVision(
        prompt: string,
        options: VisionExtractionOptions,
        jsonSchema?: any
    ): Promise<ExtractionResult> {
        throw new Error(`Vision extraction not implemented for provider ${this.getProviderName()}`);
    }

    // Check if provider supports Vision API
    supportsVision(): boolean {
        return false;
    }

    // Native PDF extraction (optional - not all providers support it)
    async extractFromPDF(
        pdfBuffer: Buffer,
        prompt: string,
        jsonSchema?: any
    ): Promise<ExtractionResult> {
        throw new Error(`Native PDF extraction not implemented for provider ${this.getProviderName()}`);
    }

    // Check if provider supports native PDF processing
    supportsNativePDF(): boolean {
        return false;
    }

    // Helper to validate config
    validateConfig(): boolean {
        if (!this.config.apiKey) {
            throw new Error(`API key is missing for provider ${this.getProviderName()}`);
        }
        return true;
    }
}
