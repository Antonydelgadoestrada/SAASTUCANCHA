import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.error('🚨 [CLIENT-SIDE ERROR LOG] 🚨', JSON.stringify(body, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to parse client error', error);
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
