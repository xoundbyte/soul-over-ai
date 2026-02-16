import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { resolveHandle } from './youtube.js';
// import { createSpotifyClient } from './spotify.js';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const payload = JSON.parse(process.env.PAYLOAD);
const data = payload.data;

const schemaPath = path.join(process.cwd(), 'artist.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const propertyOrder = Object.keys(schema.properties);

const orderedData = {};
for (const key of propertyOrder) {
  orderedData[key] = data[key];
}

// Default arrays
orderedData.disclosureTypes = orderedData.disclosureTypes || [];
orderedData.markers = orderedData.markers || [];
orderedData.urls = orderedData.urls || [];

// Trim strings and set empty to null
for (const key in orderedData) {
  if (typeof orderedData[key] === 'string') {
    const trimmed = orderedData[key].trim();
    orderedData[key] = trimmed === '' ? null : trimmed;
  }
}

// Resolve YouTube @handle to channel ID
if (orderedData.youtube && orderedData.youtube.startsWith('@')) {
  console.log(`Resolving YouTube handle ${orderedData.youtube}...`);
  orderedData.youtube = await resolveHandle(orderedData.youtube);
  console.log(`Resolved to channel ID: ${orderedData.youtube}`);
}

// Create link to souloverai.com submission form with prefilled data
const encode = (value) =>
  encodeURIComponent(value)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');

const params = Object.keys(orderedData)
  .flatMap(key => {
    const value = orderedData[key];
    if (value === null || value === undefined) return [];
    if (key === 'urls') {
      return value.flatMap((item, i) => [
        `url_${i + 1}=${encode(item.url)}`,
        `notes_${i + 1}=${encode(item.notes)}`,
      ]);
    }
    if (Array.isArray(value)) {
      return value.length === 0 ? [] : [`${key}=${encode(value.join(','))}`];
    }
    return [`${key}=${encode(value)}`];
  })
  .join('&');

const link = `[Make changes](https://souloverai.com/add?${params})`;
const issueBody = `\`\`\`json\n${JSON.stringify(orderedData, null, 2)}\n\`\`\`\n\n${link}`;

// If an issue with the same artist name exists, add a comment instead of creating a new issue
(async () => {
  const searchQuery = `repo:${owner}/${repo} is:issue in:title "${data.name} (${data.spotify})"`;
  const searchResults = await octokit.search.issuesAndPullRequests({ q: searchQuery });
  const label = data.disclosure === 'none' ? 'add-artist:low' : 'add-artist:high';

  // Add comment to existing issue
  if (searchResults.data.items.length > 0) {
    const existingIssue = searchResults.data.items[0];

    // Re-open closed issues and reset labels
    if (existingIssue.state === 'closed') {
      await octokit.issues.update({
        owner,
        repo,
        issue_number: existingIssue.number,
        state: 'open',
        labels: [label],
      });
    }

    // Add comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: existingIssue.number,
      body: issueBody,
    });
  }
  // Add new issue
  else {
    // Determine label based on Spotify followers/popularity
    // let label = 'add-artist:low';
    // if (data.spotify) {
    //   try {
    //     const spotify = await createSpotifyClient({
    //       clientId: process.env.SPOTIFY_CLIENT_ID,
    //       clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    //     });
    //     const artist = await spotify.getArtist(data.spotify);
    //     const followers = artist.followers.total;
    //     const popularity = artist.popularity;

    //     if (followers >= 5000 || popularity >= 40) {
    //       label = 'add-artist:high';
    //     } else if (followers <= 200 && popularity < 15) {
    //       label = 'add-artist:trash';
    //     }
    //   } catch (err) {
    //     console.warn('Failed to fetch Spotify data, defaulting to low priority:', err.message);
    //   }
    // }

    await octokit.issues.create({
      owner,
      repo,
      title: `${data.name} (${data.spotify})`,
      body: issueBody,
      labels: [label],
    });
  }
})();