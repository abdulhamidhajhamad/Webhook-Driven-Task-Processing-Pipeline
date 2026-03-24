import dns from 'dns/promises';
import { URL } from 'url';

export async function isSafeUrl(targetUrl: string): Promise<boolean> {
  try {
    const parsed = new URL(targetUrl);
    if ([
      'localhost',
      '127.0.0.1',
      '[::1]'
    ].includes(parsed.hostname)) {
      return false;
    }
    const lookup = await dns.lookup(parsed.hostname);
    const ip = lookup.address;
    if (
      ip.startsWith('127.') ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
    ) {
      return false;
    }
    if (ip === '::1' || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
