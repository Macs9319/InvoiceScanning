/**
 * Vision API Cost Calculator
 *
 * Estimates the cost of processing invoices with Vision API
 * based on model, page count, and resolution.
 */

export interface VisionCostEstimate {
  estimatedCost: number; // in USD
  provider: string;
  model: string;
  pageCount: number;
  pricePerPage: number;
  breakdown: string;
}

/**
 * Vision API pricing (as of 2025)
 * Prices are per 1000 tokens for images
 */
const VISION_PRICING = {
  // OpenAI GPT-4o Vision
  'openai:gpt-4o': {
    inputPerImage: 0.00765, // ~$0.01 per image (high res)
    outputPer1kTokens: 0.03,
    name: 'GPT-4o Vision',
  },
  'openai:gpt-4o-mini': {
    inputPerImage: 0.0015, // ~$0.002 per image (high res)
    outputPer1kTokens: 0.006,
    name: 'GPT-4o-mini Vision',
  },
  'openai:gpt-4-turbo': {
    inputPerImage: 0.01, // ~$0.01 per image
    outputPer1kTokens: 0.03,
    name: 'GPT-4 Turbo Vision',
  },

  // Anthropic Claude
  'anthropic:claude-3-5-sonnet-20241022': {
    inputPerImage: 0.0048, // ~$0.005 per image
    outputPer1kTokens: 0.015,
    name: 'Claude 3.5 Sonnet',
  },
  'anthropic:claude-3-opus-20240229': {
    inputPerImage: 0.024, // ~$0.024 per image
    outputPer1kTokens: 0.075,
    name: 'Claude 3 Opus',
  },

  // Google Gemini
  'google:gemini-1.5-pro': {
    inputPerImage: 0.00125, // ~$0.001 per image
    outputPer1kTokens: 0.005,
    name: 'Gemini 1.5 Pro',
  },
  'google:gemini-1.5-flash': {
    inputPerImage: 0.000075, // ~$0.0001 per image (very cheap!)
    outputPer1kTokens: 0.0003,
    name: 'Gemini 1.5 Flash',
  },
} as const;

/**
 * Calculate estimated cost for Vision API processing
 */
export function calculateVisionCost(
  provider: string,
  model: string,
  pageCount: number = 1
): VisionCostEstimate {
  const key = `${provider}:${model}` as keyof typeof VISION_PRICING;
  const pricing = VISION_PRICING[key];

  if (!pricing) {
    // Default fallback pricing (assume expensive)
    return {
      estimatedCost: pageCount * 0.01,
      provider,
      model,
      pageCount,
      pricePerPage: 0.01,
      breakdown: 'Unknown model - using default estimate',
    };
  }

  // Calculate image cost
  const imageCost = pricing.inputPerImage * pageCount;

  // Estimate output tokens (typical invoice response ~500-1000 tokens)
  const estimatedOutputTokens = 750;
  const outputCost = (pricing.outputPer1kTokens * estimatedOutputTokens) / 1000;

  const totalCost = imageCost + outputCost;

  return {
    estimatedCost: totalCost,
    provider,
    model,
    pageCount,
    pricePerPage: totalCost / pageCount,
    breakdown: `${pageCount} page(s) × $${pricing.inputPerImage.toFixed(4)} + output ($${outputCost.toFixed(4)}) = $${totalCost.toFixed(4)}`,
  };
}

/**
 * Get cost comparison between text and Vision processing
 */
export function getCostComparison(
  provider: string,
  model: string,
  pageCount: number = 1
): {
  textCost: number;
  visionCost: number;
  difference: number;
  multiplier: number;
} {
  // Text-only processing cost (much cheaper)
  const textCostPerInvoice = 0.003; // ~$0.001-0.005

  const visionEstimate = calculateVisionCost(provider, model, pageCount);

  return {
    textCost: textCostPerInvoice,
    visionCost: visionEstimate.estimatedCost,
    difference: visionEstimate.estimatedCost - textCostPerInvoice,
    multiplier: visionEstimate.estimatedCost / textCostPerInvoice,
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  } else if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  } else {
    return `$${cost.toFixed(2)}`;
  }
}

/**
 * Get recommended model for Vision processing
 * (balances cost and accuracy)
 */
export function getRecommendedVisionModel(): { provider: string; model: string; reason: string } {
  return {
    provider: 'openai',
    model: 'gpt-4o-mini',
    reason: 'Best balance of cost (~$0.002/page) and accuracy for invoice processing',
  };
}

/**
 * Calculate bulk processing cost
 */
export function calculateBulkVisionCost(
  provider: string,
  model: string,
  invoices: Array<{ pageCount?: number }>
): {
  totalCost: number;
  averageCost: number;
  totalPages: number;
  invoiceCount: number;
  breakdown: Array<{ index: number; pages: number; cost: number }>;
} {
  const breakdown = invoices.map((invoice, index) => {
    const pageCount = invoice.pageCount || 1;
    const estimate = calculateVisionCost(provider, model, pageCount);
    return {
      index,
      pages: pageCount,
      cost: estimate.estimatedCost,
    };
  });

  const totalCost = breakdown.reduce((sum, item) => sum + item.cost, 0);
  const totalPages = breakdown.reduce((sum, item) => sum + item.pages, 0);

  return {
    totalCost,
    averageCost: totalCost / invoices.length,
    totalPages,
    invoiceCount: invoices.length,
    breakdown,
  };
}
