/**
 * Renders a JSON-LD <script> for structured data (rich results).
 * Server component — emitted in the initial HTML so crawlers see it immediately.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify escapes </script> as <\/script> is not automatic; guard the closing tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
