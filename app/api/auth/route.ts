import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getClientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  // Max 10 Versuche pro IP in 15 Minuten
  const ip = getClientIp(request);
  if (isRateLimited(`auth:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Versuche. Bitte warten.' }, { status: 429 });
  }

  const { passcode } = await request.json();
  const valid = passcode?.trim() === process.env.ADMIN_PASSCODE;
  return NextResponse.json({ valid });
}
