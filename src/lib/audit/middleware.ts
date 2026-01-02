import { NextRequest } from 'next/server';

/**
 * Extract request metadata for audit logging
 * Extracts IP address and user agent from Next.js request
 *
 * @param request - Next.js request object
 * @returns Object containing ipAddress and userAgent (both nullable)
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const { ipAddress, userAgent } = extractRequestMetadata(request);
 *
 *   await logAuditEvent({
 *     ...
 *     ipAddress,
 *     userAgent,
 *   });
 * }
 * ```
 */
export function extractRequestMetadata(request: NextRequest): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  // Extract IP address
  // Try multiple headers as IP can be in different places depending on proxy setup
  let ipAddress: string | null = null;

  // Priority order: x-forwarded-for (most reliable with proxies) → x-real-ip → direct connection
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list, take the first one (client IP)
    ipAddress = forwardedFor.split(',')[0].trim();
  } else {
    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      ipAddress = realIp;
    }
  }

  // If still no IP, try to get from request.ip (Vercel/Next.js specific)
  if (!ipAddress && (request as any).ip) {
    ipAddress = (request as any).ip;
  }

  // Extract user agent
  const userAgent = request.headers.get('user-agent');

  return {
    ipAddress,
    userAgent,
  };
}

/**
 * Format IP address for logging (truncate IPv6 if needed)
 * Useful for GDPR compliance - you can choose to anonymize IPs
 *
 * @param ip - IP address string
 * @param anonymize - Whether to anonymize the IP (default: false)
 * @returns Formatted/anonymized IP address
 *
 * @example
 * ```typescript
 * formatIpAddress('192.168.1.100', true);  // Returns '192.168.1.0'
 * formatIpAddress('2001:db8::1', true);    // Returns '2001:db8::'
 * ```
 */
export function formatIpAddress(ip: string | null, anonymize: boolean = false): string | null {
  if (!ip) return null;

  if (!anonymize) return ip;

  // Anonymize IPv4: set last octet to 0
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
  }

  // Anonymize IPv6: keep first 48 bits (3 groups)
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 3) {
      return parts.slice(0, 3).join(':') + '::';
    }
  }

  return ip;
}
