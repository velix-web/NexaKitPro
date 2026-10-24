export const config = { runtime: 'edge' };

// Vercel populates these headers automatically at the edge for every request —
// no API key, no third-party geolocation service, nothing to configure.
// If this ever runs on a host other than Vercel, the fields just come back null
// and the frontend shows "Tidak diketahui" instead of guessing.
export default function handler(req) {
  const country = req.headers.get('x-vercel-ip-country') || null;
  return new Response(JSON.stringify({ country }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
