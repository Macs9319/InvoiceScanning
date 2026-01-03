import OpenAI from "openai";
import { AIProvider, AIProviderConfig, ExtractionResult } from "./base";

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
}
