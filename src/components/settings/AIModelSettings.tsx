"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export function AIModelSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [config, setConfig] = useState({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "",
        temperature: 0.1,
        maxTokens: 0, // 0 means undefined/null in UI for now
    });

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch("/api/ai-config");
            const data = await res.json();
            if (data.success && data.config) {
                setConfig({
                    provider: data.config.provider || "openai",
                    model: data.config.model || "gpt-4o-mini",
                    apiKey: data.config.apiKey || "", // Don't show actual key for security? Or show masked?
                    // Usually we don't return API key to frontend if it's sensitive.
                    // But here it's user configuration, so maybe mask it.
                    // For now let's assume if it exists we show placeholder.
                    temperature: data.config.temperature ?? 0.1,
                    maxTokens: data.config.maxTokens ?? 0,
                });
            }
        } catch (error) {
            console.error("Failed to fetch AI config:", error);
            toast.error("Failed to load AI settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/ai-config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...config,
                    maxTokens: config.maxTokens > 0 ? config.maxTokens : null,
                    apiKey: config.apiKey || null, // logic to handle sending/not sending?
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save");

            toast.success("AI settings saved successfully");
        } catch (error) {
            console.error("Error saving AI config:", error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const getModelsForProvider = (provider: string) => {
        switch (provider) {
            case "openai":
                return [
                    { value: "gpt-4o", label: "GPT-4o (Best Accuracy)" },
                    { value: "gpt-4o-mini", label: "GPT-4o Mini (Fast & Cheap)" },
                    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
                    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
                ];
            case "anthropic":
                return [
                    { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
                    { value: "claude-3-opus", label: "Claude 3 Opus" },
                    { value: "claude-3-haiku", label: "Claude 3 Haiku" },
                ];
            case "google":
                return [
                    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
                    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
                ];
            case "deepseek":
                return [
                    { value: "deepseek-coder", label: "DeepSeek Coder" },
                    { value: "deepseek-chat", label: "DeepSeek Chat" },
                ];
            case "openrouter":
                return [
                    { value: "openai/gpt-4o", label: "OR: GPT-4o" },
                    { value: "anthropic/claude-3.5-sonnet", label: "OR: Claude 3.5 Sonnet" },
                    { value: "google/gemini-pro-1.5", label: "OR: Gemini 1.5 Pro" },
                    { value: "meta-llama/llama-3-70b-instruct", label: "OR: Llama 3 70B" },
                ];
            default:
                return [];
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="pt-6 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>AI Model Configuration</CardTitle>
                    <CardDescription>
                        Configure which AI model to use for extracting data from invoices.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="provider">AI Provider</Label>
                        <Select
                            value={config.provider}
                            onValueChange={(val) => setConfig({ ...config, provider: val, model: getModelsForProvider(val)[0]?.value || "" })}
                        >
                            <SelectTrigger id="provider">
                                <SelectValue placeholder="Select a provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="anthropic">Anthropic</SelectItem>
                                <SelectItem value="google">Google Gemini</SelectItem>
                                <SelectItem value="deepseek">DeepSeek</SelectItem>
                                <SelectItem value="openrouter">OpenRouter</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="model">Model</Label>
                        <Select
                            value={config.model}
                            onValueChange={(val) => setConfig({ ...config, model: val })}
                        >
                            <SelectTrigger id="model">
                                <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent>
                                {getModelsForProvider(config.provider).map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key (Optional Override)</Label>
                        <Input
                            id="apiKey"
                            type="password"
                            placeholder="Leave empty to use system default"
                            value={config.apiKey}
                            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                            If unset, the system environment variable for this provider will be used.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="temperature">Temperature: {config.temperature}</Label>
                            <span className="text-xs text-muted-foreground">Lower is more deterministic</span>
                        </div>
                        <Slider
                            id="temperature"
                            min={0}
                            max={1}
                            step={0.1}
                            value={[config.temperature]}
                            onValueChange={(val) => setConfig({ ...config, temperature: val[0] })}
                        />
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Save Configuration
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* TODO: Add usage Log viewer or cost estimation here later */}
        </div>
    );
}
