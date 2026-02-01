export function generateQueryParams(data, excludeKeys = []) {
  return Object.keys(data)
    .filter(key => !excludeKeys.includes(key))
    .map(key => {
      let value = data[key];
      if (Array.isArray(value)) {
        if (value.length === 0) return null;
        value = value.join(',');
      } else if (value === null || value === undefined) {
        return null;
      }
      const encodedValue = encodeURIComponent(value)
        .replace(/\(/g, '%28') // left parenthesis
        .replace(/\)/g, '%29'); // right parenthesis
      return `${key}=${encodedValue}`;
    })
    .filter(Boolean)
    .join('&');
}

export function generateSocialLinks(data) {
  return [
    data.spotify?.length ? `* [Spotify](https://open.spotify.com/artist/${data.spotify})` : null,
    data.apple?.length ? `* [Apple Music](https://music.apple.com/us/artist/${data.apple})` : null,
    data.amazon?.length ? `* [Amazon Music](https://music.amazon.com/artists/${data.amazon})` : null,
    data.youtube?.length ? `* [YouTube](https://www.youtube.com/channel/${data.youtube})` : null,
    data.tiktok?.length ? `* [TikTok](https://www.tiktok.com/${data.tiktok})` : null,
    data.instagram?.length ? `* [Instagram](https://www.instagram.com/${data.instagram})` : null,
  ].filter(Boolean);
}

export function formatIssueBody(contents, links, editUrl) {
  const bodyContents = "```json\n" + JSON.stringify(contents, null, 2) + "\n```";
  return [
    bodyContents,
    links.length ? links.join('\n') : null,
    `[Make changes](${editUrl})`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
