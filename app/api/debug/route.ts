import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_DATABASE_URL;
  
  return NextResponse.json({
    hasDatabaseUrl: !!dbUrl,
    hasDirectUrl: !!directUrl,
    databaseUrlPrefix: dbUrl ? dbUrl.substring(0, 50) + '...' : null,
    directUrlPrefix: directUrl ? directUrl.substring(0, 50) + '...' : null,
    nodeEnv: process.env.NODE_ENV,
  });
}
