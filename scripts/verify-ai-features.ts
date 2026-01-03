
import { PrismaClient } from "@prisma/client";
import { ModelSelector } from "@/lib/ai/model-selector";
import { AIProviderFactory } from "@/lib/ai/providers/factory";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting verification...");

    // 1. Verify ModelSelector can access Prisma
    try {
        const user = await prisma.user.findFirst();
        if (!user) {
            console.log("No users found, creating dummy user for test");
        }
        const userId = user?.id || "dummy_user";

        console.log(`Testing with userId: ${userId}`);

        // Check if we can access the model
        // @ts-ignore
        if (!prisma.aiModelConfig && !prisma.aIModelConfig && !prisma.AIModelConfig) {
            console.error("❌ AIModelConfig model not found on prisma client!");
            return;
        }

        // Determine correct key
        // @ts-ignore
        const modelDelegate = prisma.aIModelConfig || prisma.aiModelConfig || prisma.AIModelConfig;

        // 2. Test configuration saving (mocking API behavior by writing to DB directly)
        // We test SYSTEM DEFAULT for user (vendorId: null)
        const upsertArgs = {
            where: {
                userId_vendorId: {
                    userId,
                    vendorId: null, // this might fail if type definitions expect string
                }
            },
            update: {
                provider: "openai",
                model: "gpt-4o-test",
                temperature: 0.5,
                isActive: true,
            },
            create: {
                userId,
                vendorId: null,
                provider: "openai",
                model: "gpt-4o-test",
                temperature: 0.5,
                isActive: true,
            }
        };

        // Prisma sometimes complains about null in composite unique in 'where' clause if not defined carefully.
        // If this fails, we will try findFirst then update/create manually (which is what API does).

        try {
            // @ts-ignore
            await modelDelegate.upsert(upsertArgs);
            console.log("Created test config in DB (via upsert)");
        } catch (upsertError) {
            console.warn("Upsert failed (expected if composite key null issue), trying manual find/update:", upsertError.message);

            // Manual fallback
            const existing = await modelDelegate.findFirst({
                where: { userId, vendorId: null }
            });

            if (existing) {
                await modelDelegate.update({
                    where: { id: existing.id },
                    data: {
                        provider: "openai",
                        model: "gpt-4o-test",
                        temperature: 0.5,
                        isActive: true,
                    }
                });
                console.log("Updated test config in DB (via update)");
            } else {
                await modelDelegate.create({
                    data: {
                        userId,
                        vendorId: null,
                        provider: "openai",
                        model: "gpt-4o-test",
                        temperature: 0.5,
                        isActive: true,
                    }
                });
                console.log("Created test config in DB (via create)");
            }
        }

        // 3. Test ModelSelector resolution
        try {
            const config = await ModelSelector.getEffectiveConfig(userId, null);
            console.log("Effective config resolved:", config);

            if (config.model === "gpt-4o-test" && config.provider === "openai") {
                console.log("✅ Configuration persistence verified");
            } else {
                console.error("❌ Configuration mismatch. Expected gpt-4o-test, got:", config.model);
            }
        } catch (err) {
            console.error("❌ ModelSelector failed:", err);
        }

        // 4. Test Provider Factory
        try {
            const provider = AIProviderFactory.createProvider("openai", {
                apiKey: "sk-test",
                model: "gpt-4o-mini"
            });
            console.log("✅ Provider factory verified (created:", provider.getProviderName(), ")");

            const deepseek = AIProviderFactory.createProvider("deepseek", {
                apiKey: "sk-test",
                model: "deepseek-coder"
            });
            console.log("✅ Provider factory verified (created:", deepseek.getProviderName(), ")");

            const openrouter = AIProviderFactory.createProvider("openrouter", {
                apiKey: "sk-test",
                model: "openai/gpt-4o"
            });
            console.log("✅ Provider factory verified (created:", openrouter.getProviderName(), ")");
        } catch (e) {
            console.error("❌ Provider factory failed:", e);
        }

    } catch (error) {
        console.error("Verification failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
