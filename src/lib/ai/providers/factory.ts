import { AIProvider, AIProviderConfig } from "./base";
import { OpenAIProvider } from "./openai";
import { DeepSeekProvider } from "./deepseek";
import { OpenRouterProvider } from "./openrouter";
import { GeminiProvider } from "./gemini";

export class AIProviderFactory {
    static createProvider(
        providerType: string,
        config: AIProviderConfig
    ): AIProvider {
        switch (providerType) {
            case "openai":
                return new OpenAIProvider(config);
            case "deepseek":
                return new DeepSeekProvider(config);
            case "openrouter":
                return new OpenRouterProvider(config);
            case "gemini":
            case "google":
                return new GeminiProvider(config);
            default:
                throw new Error(`Unsupported provider type: ${providerType}`);
        }
    }
}
