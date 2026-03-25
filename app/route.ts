import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const html = fs.readFileSync(
    path.join(process.cwd(), 'public', 'homepage.html'),
    'utf8'
  )
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
