import { AIProviderConfig } from "./base";
import { OpenAICompatibleProvider } from "./openai-compatible";

export class OpenAIProvider extends OpenAICompatibleProvider {
    constructor(config: AIProviderConfig) {
        super(config, "openai");
    }

    protected estimateCost(promptTokens: number, completionTokens: number): number {
        // Pricing per 1M tokens (as of Jan 2025)
        const pricing: Record<string, { input: number; output: number }> = {
            "gpt-4o": { input: 5.0, output: 15.0 }, // $5 input, $15 output
            "gpt-4o-mini": { input: 0.15, output: 0.6 }, // $0.15 input, $0.6 output
            "gpt-4-turbo": { input: 10.0, output: 30.0 },
            "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
        };

        // Default to gpt-4o-mini pricing if unknown
        const modelPrice = pricing[this.config.model] || pricing["gpt-4o-mini"];

        const inputCost = (promptTokens / 1_000_000) * modelPrice.input;
        const outputCost = (completionTokens / 1_000_000) * modelPrice.output;

        return inputCost + outputCost;
    }
}
