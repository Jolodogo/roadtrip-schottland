import { NextRequest } from 'next/server';

// Einfaches In-Memory-Rate-Limiting (pro Serverless-Instanz)
const store = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= maxAttempts) return true;
  entry.count++;
  return false;
}
