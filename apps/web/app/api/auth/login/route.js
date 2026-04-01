import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'NOT_IMPLEMENTED',
      message: 'Auth login is pending implementation in the Next.js backend.',
    },
    { status: 501 },
  );
}
