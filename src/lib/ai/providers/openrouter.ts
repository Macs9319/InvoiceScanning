import { AIProviderConfig } from "./base";
import { OpenAICompatibleProvider } from "./openai-compatible";

export class OpenRouterProvider extends OpenAICompatibleProvider {
    constructor(config: AIProviderConfig) {
        super({
            ...config,
            baseURL: config.baseURL || "https://openrouter.ai/api/v1",
        }, "openrouter");
    }

    protected estimateCost(promptTokens: number, completionTokens: number): number {
        // OpenRouter aggregates many models with different pricing.
        // It's hard to estimate locally without specific model metadata.
        // For now returning 0 or we could try to emulate based on common model substrings.
        return 0;
    }
}
