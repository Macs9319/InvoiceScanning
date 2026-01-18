import OpenAI from "openai";
import { AIProvider, AIProviderConfig, ExtractionResult, VisionExtractionOptions } from "./base";

export class OpenAICompatibleProvider extends AIProvider {
    protected client: OpenAI;
    protected providerName: string = "openai-compatible";

    constructor(config: AIProviderConfig, providerName: string = "openai-compatible") {
        super(config);
        this.providerName = providerName;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
        });
    }

    getProviderName(): string {
        return this.providerName;
    }

    async extract(text: string, prompt: string, jsonSchema?: any): Promise<ExtractionResult> {
        this.validateConfig();

        const response = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                {
                    role: "system",
                    content: prompt,
                },
                {
                    role: "user",
                    content: `Extract data from this invoice/receipt:\n\n${text}`,
                },
            ],
            response_format: { type: "json_object" },
            temperature: this.config.temperature || 0.1,
            max_tokens: this.config.maxTokens,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error(`No response content from ${this.providerName}`);
        }

        const data = JSON.parse(content);
        const usage = response.usage;

        return {
            data,
            usage: {
                promptTokens: usage?.prompt_tokens || 0,
                completionTokens: usage?.completion_tokens || 0,
                totalTokens: usage?.total_tokens || 0,
                cost: this.estimateCost(usage?.prompt_tokens || 0, usage?.completion_tokens || 0),
            },
        };
    }

    protected estimateCost(promptTokens: number, completionTokens: number): number {
        // Default implementation returns 0 or needs specific provider logic overrides
        return 0;
    }

    // Override to support Vision API
    supportsVision(): boolean {
        // Only models with 'vision' or 'gpt-4o' support Vision
        const visionModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4-vision'];
        return visionModels.some(model => this.config.model.includes(model));
    }

    // Vision API extraction implementation
    async extractWithVision(
        prompt: string,
        options: VisionExtractionOptions,
        jsonSchema?: any
    ): Promise<ExtractionResult> {
        this.validateConfig();

        if (!this.supportsVision()) {
            throw new Error(`Model ${this.config.model} does not support Vision API`);
        }

        // Build the message content with images
        const imageContent: Array<any> = [];

        // Add images if provided
        if (options.images && options.images.length > 0) {
            for (const imageData of options.images) {
                // Ensure image is in proper data URL format
                const imageUrl = imageData.startsWith('data:')
                    ? imageData
                    : `data:image/jpeg;base64,${imageData}`;

                imageContent.push({
                    type: "image_url",
                    image_url: {
                        url: imageUrl,
                        detail: "high" // Use high detail for better extraction
                    }
                });
            }
        }

        // If no images but fileBuffer provided, we need to convert PDF to images first
        // For MVP, we'll require pre-converted images
        if (imageContent.length === 0 && options.fileBuffer) {
            // Future: Implement PDF to image conversion here
            // For now, require images to be provided
            throw new Error(
                'PDF to image conversion required. Please convert PDF to images first using an external service (Cloudinary, PDF.co) or provide images directly.'
            );
        }

        if (imageContent.length === 0) {
            throw new Error('No images provided for Vision extraction. Please provide base64-encoded images.');
        }

        // Add text prompt
        const userMessage: any = {
            role: "user",
            content: [
                {
                    type: "text",
                    text: options.text
                        ? `Extract data from this invoice/receipt. Additional context:\n\n${options.text}`
                        : "Extract data from this invoice/receipt image."
                },
                ...imageContent
            ]
        };

        // Call Vision API
        const response = await this.client.chat.completions.create({
            model: this.config.model,
            messages: [
                {
                    role: "system",
                    content: prompt,
                },
                userMessage
            ],
            response_format: { type: "json_object" },
            temperature: this.config.temperature || 0.1,
            max_tokens: this.config.maxTokens || 2000, // Vision often needs more tokens
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error(`No response content from Vision API (${this.providerName})`);
        }

        const data = JSON.parse(content);
        const usage = response.usage;

        return {
            data,
            usage: {
                promptTokens: usage?.prompt_tokens || 0,
                completionTokens: usage?.completion_tokens || 0,
                totalTokens: usage?.total_tokens || 0,
                cost: this.estimateVisionCost(
                    usage?.prompt_tokens || 0,
                    usage?.completion_tokens || 0,
                    options.images?.length || 0
                ),
            },
        };
    }

    protected estimateVisionCost(
        promptTokens: number,
        completionTokens: number,
        imageCount: number
    ): number {
        // GPT-4o Vision pricing (approximate)
        // Input: $0.00765 per image (high detail)
        // Output: $0.03 per 1k tokens
        const imageCost = imageCount * 0.00765;
        const outputCost = (completionTokens / 1000) * 0.03;
        return imageCost + outputCost;
    }
}
