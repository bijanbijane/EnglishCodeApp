import { fromBase64Url, toBase64Url, encoder } from "../../shared/crypto";

type Claims = { sub: string; iat: number; exp: number; iss: "englishcodeapp" };

export async function createSessionToken(
  userId: string, secret: string, ttlSeconds = 3_600, nowSeconds = Math.floor(Date.now() / 1000)
): Promise<string> {
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    sub: userId, iat: nowSeconds, exp: nowSeconds + ttlSeconds, iss: "englishcodeapp"
  } satisfies Claims)));
  const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(input)));
  return `${input}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)
): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  try {
    const parsedHeader = JSON.parse(new TextDecoder().decode(fromBase64Url(header))) as { alg?: string; typ?: string };
    if (parsedHeader.alg !== "HS256" || parsedHeader.typ !== "JWT") return null;
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(`${header}.${payload}`));
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as Claims;
    if (claims.iss !== "englishcodeapp" || !claims.sub || !Number.isInteger(claims.iat) ||
        !Number.isInteger(claims.exp) || claims.iat > nowSeconds + 60 ||
        claims.exp <= nowSeconds || claims.exp <= claims.iat || claims.exp - claims.iat > 3_600) return null;
    return claims.sub;
  } catch {
    return null;
  }
}