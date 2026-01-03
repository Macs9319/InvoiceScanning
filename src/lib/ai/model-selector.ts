import { prisma } from "@/lib/db/prisma";
import { AIProvider } from "./providers/base";
import { AIProviderFactory } from "./providers/factory";

export interface ModelSelection {
    provider: string;
    model: string;
    apiKey?: string;
    temperature: number;
    maxTokens?: number;
}

export class ModelSelector {
    /**
     * Get the effective AI model configuration for a user and vendor
     */
    static async getEffectiveConfig(userId: string, vendorId?: string | null): Promise<ModelSelection> {
        // 1. Try to find vendor-specific override
        if (vendorId) {
            // @ts-ignore: Prisma client casing mismatch
            const modelDelegate = prisma.aIModelConfig || prisma.aiModelConfig;
            if (modelDelegate) {
                const vendorConfig = await modelDelegate.findUnique({
                    where: {
                        userId_vendorId: {
                            userId,
                            vendorId,
                        },
                    },
                });

                if (vendorConfig && vendorConfig.isActive) {
                    return {
                        provider: vendorConfig.provider,
                        model: vendorConfig.model,
                        apiKey: vendorConfig.apiKey || undefined,
                        temperature: vendorConfig.temperature,
                        maxTokens: vendorConfig.maxTokens || undefined,
                    };
                }
            }
        }

        // 2. Try to find user-specific default
        // @ts-ignore: Prisma client casing mismatch
        const modelDelegate = prisma.aIModelConfig || prisma.aiModelConfig;
        if (modelDelegate) {
            const userConfig = await modelDelegate.findFirst({
                where: {
                    userId,
                    vendorId: null, // System default for this user
                },
            });

            if (userConfig && userConfig.isActive) {
                return {
                    provider: userConfig.provider,
                    model: userConfig.model,
                    apiKey: userConfig.apiKey || undefined,
                    temperature: userConfig.temperature,
                    maxTokens: userConfig.maxTokens || undefined,
                };
            }
        }

        // 3. Fallback to system default (OpenAI GPT-4o-mini)
        return {
            provider: "openai",
            model: "gpt-4o-mini",
            temperature: 0.1,
        };
    }

    /**
     * Get an instantiated provider based on effective config
     */
    static async getProvider(userId: string, vendorId?: string | null): Promise<AIProvider> {
        const config = await this.getEffectiveConfig(userId, vendorId);

        // Resolve API key
        let apiKey = config.apiKey;
        if (!apiKey) {
            if (config.provider === "openai") {
                apiKey = process.env.OPENAI_API_KEY;
            } else if (config.provider === "anthropic") {
                apiKey = process.env.ANTHROPIC_API_KEY;
            } else if (config.provider === "google") {
                apiKey = process.env.GOOGLE_AI_API_KEY;
            }
        }

        if (!apiKey) {
            throw new Error(`No API key found for provider ${config.provider}`);
        }

        return AIProviderFactory.createProvider(config.provider, {
            apiKey,
            model: config.model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
        });
    }
}
