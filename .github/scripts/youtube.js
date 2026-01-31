/**
 * Resolve a YouTube @handle to a channel ID by fetching the channel page
 * and extracting the ID from the canonical URL.
 */
export const resolveHandle = async (handle) => {
  const url = `https://www.youtube.com/${handle}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube channel page for ${handle}: ${response.status}`);
  }
  const html = await response.text();
  const match = html.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/(UC[^"]+)"/);
  if (!match) {
    throw new Error(`Could not extract channel ID from YouTube page for ${handle}`);
  }
  return match[1];
};
