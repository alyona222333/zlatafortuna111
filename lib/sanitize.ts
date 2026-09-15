/**
 * Strips ALL HTML tags from a string, keeping only the text content.
 *
 * Replaces isomorphic-dompurify (used previously with ALLOWED_TAGS: []ate,
 * i.e. "strip everything, keep text only"). That package pulls in jsdom,
 * which in turn pulls in an ES-module-only dependency
 * (html-encoding-sniffer -> @exodus/bytes) that Netlify's serverless
 * function bundler cannot require() — every request that touched this
 * code path failed with ERR_REQUIRE_ESM in production.
 *
 * Since both call sites only ever used ALLOWED_TAGS: [] (plain-text
 * fields: a person's name, a business name, a service name), a full
 * browser-grade HTML sanitizer was never needed here — stripping tags
 * is enough, and this has no dependency that can break serverless
 * bundling. The loop removes tags repeatedly until none remain (defeats
 * malformed/nested tag tricks like "<<script>script>"), then strips any
 * leftover angle brackets as a safety net.
 *
 * Do NOT reuse this for fields that are later rendered as HTML — it's
 * only for plain-text fields that get stored and displayed as text.
 */
export function stripHtml(input: string): string {
  let out = input
  let previous: string
  do {
    previous = out
    out = out.replace(/<[^>]*>/g, '')
  } while (out !== previous)
  return out.replace(/[<>]/g, '').trim()
}
