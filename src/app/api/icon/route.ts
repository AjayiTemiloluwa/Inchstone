import { NextResponse } from 'next/server'

export async function GET() {
    const canvas = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="#000"/>
      <text x="256" y="340" font-size="280" font-family="serif" fill="#fff" text-anchor="middle" font-weight="bold">I</text>
    </svg>
  `

    return new NextResponse(canvas, {
        headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    })
}
