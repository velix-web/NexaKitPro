// Blocks obviously dangerous fetch/forward targets: loopback, private and
// reserved IPv4/IPv6 ranges (including the cloud metadata address), and a
// few well-known internal hostnames. This does real IP-literal parsing
// (full dotted-decimal, short forms, octal, hex) rather than a substring
// check like `url.includes('localhost')`, which encodings trivially defeat.
//
// Known limitation (documented, not silently ignored): this cannot detect
// DNS rebinding — a plain hostname that only resolves to a private IP at
// fetch time — because the Edge runtime does not expose the resolved IP
// before the underlying `fetch()` connects. Endpoints using this guard
// only ever hand the URL to a fixed third-party API as a parameter (they
// do not fetch it directly from our own infrastructure), which limits the
// blast radius, but true rebinding protection would need a Node runtime
// with control over DNS resolution, or a dedicated proxy that resolves
// first and connects to the resolved IP directly.

function ipv4ToInt(a, b, c, d) {
  return ((a << 24) >>> 0) + (b << 16) + (c << 8) + d;
}

// Accepts the equivalent textual forms of an IPv4 address a naive URL
// parser treats as a normal hostname: full dotted-decimal, short forms
// (a.b, a.b.c, a), and octal/hex per-part encoding — the classic
// SSRF-filter-bypass tricks.
function parseIPv4Literal(host) {
  if (!/^[0-9xX.]+$/.test(host)) return null;
  const parts = host.split('.');
  if (parts.length < 1 || parts.length > 4) return null;
  const nums = [];
  for (const p of parts) {
    if (p === '') return null;
    let n;
    if (/^0[xX][0-9a-fA-F]+$/.test(p)) n = parseInt(p, 16);
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8);
    else if (/^[0-9]+$/.test(p)) n = parseInt(p, 10);
    else return null;
    if (!Number.isFinite(n) || n < 0) return null;
    nums.push(n);
  }
  let value;
  if (nums.length === 4) {
    if (nums.some(n => n > 255)) return null;
    value = ipv4ToInt(nums[0], nums[1], nums[2], nums[3]);
  } else if (nums.length === 3) {
    if (nums[0] > 255 || nums[1] > 255 || nums[2] > 0xffff) return null;
    value = ipv4ToInt(nums[0], nums[1], (nums[2] >>> 8) & 0xff, nums[2] & 0xff);
  } else if (nums.length === 2) {
    if (nums[0] > 255 || nums[1] > 0xffffff) return null;
    value = ipv4ToInt(nums[0], (nums[1] >>> 16) & 0xff, (nums[1] >>> 8) & 0xff, nums[1] & 0xff);
  } else {
    if (nums[0] > 0xffffffff) return null;
    value = nums[0] >>> 0;
  }
  return value >>> 0;
}

function isPrivateIPv4(intVal) {
  const a = (intVal >>> 24) & 0xff, b = (intVal >>> 16) & 0xff;
  if (a === 0) return true;                          // 0.0.0.0/8 ("this network")
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 127) return true;                         // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true;            // 169.254.0.0/16 link-local — includes 169.254.169.254 cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16
  if (a === 192 && b === 0) return true;               // 192.0.0.0/24 IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true;    // 100.64.0.0/10 carrier-grade NAT
  if (a >= 224) return true;                            // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + 255.255.255.255
  return false;
}

function isPrivateIPv6(host) {
  const h = host.toLowerCase();
  if (h === '::1' || h === '::') return true;                       // loopback / unspecified
  if (/^fe[89ab][0-9a-f]:/.test(h) || h === 'fe80::') return true;    // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;                      // fc00::/7 unique-local
  // IPv4-mapped IPv6 — the WHATWG URL parser normalizes ::ffff:a.b.c.d to
  // its canonical hex form (e.g. ::ffff:127.0.0.1 -> ::ffff:7f00:1), so
  // check both the rare textual form and the hex form we'll actually see.
  const mappedText = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h);
  if (mappedText) {
    const ip = parseIPv4Literal(mappedText[1]);
    if (ip != null && isPrivateIPv4(ip)) return true;
  }
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (mappedHex) {
    const ip = ((parseInt(mappedHex[1], 16) << 16) | parseInt(mappedHex[2], 16)) >>> 0;
    if (isPrivateIPv4(ip)) return true;
  }
  return false;
}

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata', 'instance-data']);

export function isBlockedTarget(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return true; // unparsable — reject rather than guess
  }
  if (!['http:', 'https:'].includes(u.protocol)) return true;
  const hostname = u.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower) || lower.endsWith('.localhost')) return true;
  if (hostname.includes(':')) return isPrivateIPv6(hostname);
  const ipv4 = parseIPv4Literal(hostname);
  if (ipv4 != null) return isPrivateIPv4(ipv4);
  return false; // a normal DNS hostname — see the rebinding note above
}
