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

export abstract class AIProvider {
    protected config: AIProviderConfig;

    constructor(config: AIProviderConfig) {
        this.config = config;
    }

    abstract extract(text: string, prompt: string, jsonSchema?: any): Promise<ExtractionResult>;

    abstract getProviderName(): string;

    // Helper to validate config
    validateConfig(): boolean {
        if (!this.config.apiKey) {
            throw new Error(`API key is missing for provider ${this.getProviderName()}`);
        }
        return true;
    }
}
