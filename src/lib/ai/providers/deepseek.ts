import { AIProviderConfig } from "./base";
import { OpenAICompatibleProvider } from "./openai-compatible";

export class DeepSeekProvider extends OpenAICompatibleProvider {
    constructor(config: AIProviderConfig) {
        super({
            ...config,
            baseURL: config.baseURL || "https://api.deepseek.com",
        }, "deepseek");
    }

    protected estimateCost(promptTokens: number, completionTokens: number): number {
        // DeepSeek Pricing (approximate)
        // coder: $0.14 input, $0.28 output (cached $0.014)
        // chat: $0.14 input, $0.28 output
        const inputPrice = 0.14;
        const outputPrice = 0.28;

        return (promptTokens / 1_000_000) * inputPrice + (completionTokens / 1_000_000) * outputPrice;
    }
}
