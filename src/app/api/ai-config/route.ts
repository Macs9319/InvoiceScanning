import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // @ts-ignore: Prisma client casing mismatch
        const modelDelegate = prisma.aIModelConfig || prisma.aiModelConfig;
        if (!modelDelegate) {
            console.error("AIModelConfig model not found in Prisma client");
            return NextResponse.json({ error: "Configuration error" }, { status: 500 });
        }

        // Get system default config (userId + null vendorId)
        const config = await modelDelegate.findFirst({
            where: {
                userId: session.user.id,
                vendorId: null,
            },
        });

        return NextResponse.json({
            success: true,
            config: config || {
                provider: "openai",
                model: "gpt-4o-mini",
                temperature: 0.1,
                isActive: true,
            },
        });
    } catch (error) {
        console.error("Error fetching AI config:", error);
        return NextResponse.json(
            { error: "Failed to fetch AI configuration" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { provider, model, apiKey, temperature, maxTokens } = body;

        if (!provider || !model) {
            return NextResponse.json(
                { error: "Provider and model are required" },
                { status: 400 }
            );
        }

        // @ts-ignore: Prisma client casing mismatch
        const modelDelegate = prisma.aIModelConfig || prisma.aiModelConfig;
        if (!modelDelegate) {
            console.error("AIModelConfig model not found in Prisma client");
            return NextResponse.json({ error: "Configuration error" }, { status: 500 });
        }

        // Manual upsert to handle optional vendorId safely
        const existingConfig = await modelDelegate.findFirst({
            where: {
                userId: session.user.id,
                vendorId: null,
            },
        });

        let savedConfig;
        const configData = {
            provider,
            model,
            apiKey: apiKey || null,
            temperature: temperature || 0.1,
            maxTokens: maxTokens || null,
            isActive: true,
        };

        if (existingConfig) {
            savedConfig = await modelDelegate.update({
                where: { id: existingConfig.id },
                data: configData,
            });
        } else {
            savedConfig = await modelDelegate.create({
                data: {
                    userId: session.user.id,
                    vendorId: null,
                    ...configData,
                },
            });
        }

        return NextResponse.json({ success: true, config: savedConfig });
    } catch (error) {
        console.error("Error saving AI config:", error);
        return NextResponse.json(
            { error: "Failed to save AI configuration" },
            { status: 500 }
        );
    }
}
