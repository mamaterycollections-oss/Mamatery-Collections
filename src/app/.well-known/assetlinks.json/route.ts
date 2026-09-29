import { NextResponse } from 'next/server'

// Digital Asset Links: proves to Android that the Play Store app (Trusted Web
// Activity) and this website belong together, so the app opens full-screen
// without a browser bar. Values come from Play Console → App integrity.
export function GET() {
  const pkg = process.env.ANDROID_PACKAGE_NAME
  const prints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const body = pkg && prints.length
    ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: prints } }]
    : []
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
