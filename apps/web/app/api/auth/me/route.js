import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'NOT_IMPLEMENTED',
      message: 'Current user endpoint is pending implementation in the Next.js backend.',
    },
    { status: 501 },
  );
}
