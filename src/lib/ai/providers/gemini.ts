import { AIProvider, AIProviderConfig, ExtractionResult } from "./base";

export class GeminiProvider extends AIProvider {
    private apiKey: string;
    private baseURL: string = "https://generativelanguage.googleapis.com/v1beta";

    constructor(config: AIProviderConfig) {
        super(config);
        this.apiKey = config.apiKey || process.env.GOOGLE_AI_API_KEY || "";
        if (config.baseURL) {
            this.baseURL = config.baseURL;
        }
    }

    // Get the full model name with proper formatting
    private getModelName(): string {
        // If model already has 'models/' prefix, use it as-is
        if (this.config.model.startsWith('models/')) {
            return this.config.model;
        }
        // Otherwise, add the prefix
        return `models/${this.config.model}`;
    }

    getProviderName(): string {
        return "gemini";
    }

    // Text extraction (standard approach)
    async extract(text: string, prompt: string, jsonSchema?: any): Promise<ExtractionResult> {
        this.validateConfig();

        const modelName = this.getModelName();
        const response = await fetch(`${this.baseURL}/${modelName}:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: `${prompt}\n\nExtract data from this invoice/receipt:\n\n${text}` }
                    ]
                }],
                generationConfig: {
                    response_mime_type: 'application/json',
                    temperature: this.config.temperature || 0.1,
                    maxOutputTokens: this.config.maxTokens || 2048,
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (!result.candidates || result.candidates.length === 0) {
            throw new Error('No response from Gemini API');
        }

        const content = result.candidates[0]?.content?.parts?.[0]?.text;
        if (!content) {
            throw new Error('No content in Gemini API response');
        }

        const data = JSON.parse(content);

        // Extract usage metadata
        const usage = result.usageMetadata || {};
        const promptTokens = usage.promptTokenCount || 0;
        const completionTokens = usage.candidatesTokenCount || 0;
        const totalTokens = usage.totalTokenCount || 0;

        return {
            data,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens,
                cost: this.estimateCost(promptTokens, completionTokens),
            },
        };
    }

    // Native PDF extraction (Gemini's killer feature!)
    async extractFromPDF(
        pdfBuffer: Buffer,
        prompt: string,
        jsonSchema?: any
    ): Promise<ExtractionResult> {
        this.validateConfig();

        // Convert PDF to base64
        const base64PDF = pdfBuffer.toString('base64');

        const modelName = this.getModelName();
        const response = await fetch(`${this.baseURL}/${modelName}:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: 'application/pdf',
                                data: base64PDF
                            }
                        }
                    ]
                }],
                generationConfig: {
                    response_mime_type: 'application/json',
                    temperature: this.config.temperature || 0.1,
                    maxOutputTokens: this.config.maxTokens || 2048,
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini PDF API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (!result.candidates || result.candidates.length === 0) {
            throw new Error('No response from Gemini PDF API');
        }

        const content = result.candidates[0]?.content?.parts?.[0]?.text;
        if (!content) {
            throw new Error('No content in Gemini PDF API response');
        }

        const data = JSON.parse(content);

        // Extract usage metadata
        const usage = result.usageMetadata || {};
        const promptTokens = usage.promptTokenCount || 0;
        const completionTokens = usage.candidatesTokenCount || 0;
        const totalTokens = usage.totalTokenCount || 0;

        return {
            data,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens,
                cost: this.estimateCost(promptTokens, completionTokens),
            },
        };
    }

    // Gemini supports native PDF processing
    supportsNativePDF(): boolean {
        return true;
    }

    // Gemini pricing (as of 2025-2026)
    private estimateCost(promptTokens: number, completionTokens: number): number {
        let inputCostPer1M = 0.075;  // Gemini 1.5 Flash default
        let outputCostPer1M = 0.3;

        // Adjust pricing based on model
        if (this.config.model.includes('gemini-2.5-flash')) {
            inputCostPer1M = 0.15;
            outputCostPer1M = 0.6;
        } else if (this.config.model.includes('gemini-3-flash') || this.config.model.includes('gemini-exp')) {
            inputCostPer1M = 0.5;
            outputCostPer1M = 3.0;
        } else if (this.config.model.includes('gemini-1.5-pro')) {
            inputCostPer1M = 1.25;
            outputCostPer1M = 5.0;
        }

        const inputCost = (promptTokens / 1_000_000) * inputCostPer1M;
        const outputCost = (completionTokens / 1_000_000) * outputCostPer1M;

        return inputCost + outputCost;
    }
}
