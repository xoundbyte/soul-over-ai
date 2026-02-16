import { Octokit } from '@octokit/rest';
import { readFileSync } from 'fs';
import { resolveHandle } from './youtube.js';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const payload = JSON.parse(process.env.PAYLOAD);
const data = payload.data;

// Load existing artist data from src/[id].json
const existingArtist = JSON.parse(readFileSync(`src/${data.id}.json`, 'utf8'));

// Fields that can be updated (excluding id which is mandatory)
const updateableFields = [
  'disclosure',
  'disclosureNotes',
  'disclosureTypes',
  'urls',
  'markers',
  'markerNotes',
  'apple',
  'amazon',
  'youtube',
  'tiktok',
  'instagram',
];

// Compare and collect only changed fields
const changedData = { id: data.id };

// Fields where empty strings should be converted to null
const nullableFields = ['disclosureNotes', 'markerNotes', 'apple', 'amazon', 'youtube', 'tiktok', 'instagram'];

const arrayFields = ['disclosureTypes', 'urls', 'markers'];

for (const field of updateableFields) {
  if (!(field in data)) continue;

  let newValue = data[field];
  const existingValue = existingArtist?.[field];

  // Trim string values to avoid whitespace differences
  if (typeof newValue === 'string') {
    newValue = newValue.trim();
  }

  // Default arrays
  if (arrayFields.includes(field)) {
    newValue = newValue || [];
  }

  // Convert empty strings to null for nullable fields
  if (nullableFields.includes(field) && newValue === '') {
    newValue = null;
  }

  // Deep comparison for arrays
  const isEqual =
    Array.isArray(newValue) && Array.isArray(existingValue)
      ? JSON.stringify(newValue) === JSON.stringify(existingValue)
      : newValue === existingValue;

  if (!isEqual) {
    changedData[field] = newValue;
  }
}

// Resolve YouTube @handle to channel ID
if (changedData.youtube && changedData.youtube.startsWith('@')) {
  console.log(`Resolving YouTube handle ${changedData.youtube}...`);
  changedData.youtube = await resolveHandle(changedData.youtube);
  console.log(`Resolved to channel ID: ${changedData.youtube}`);
}

// Only create issue if there are actual changes (more than just id)
if (Object.keys(changedData).length > 1) {

  // Create link to souloverai.com update form with prefilled data
  const encode = (value) =>
    encodeURIComponent(value)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');

  const params = Object.keys(changedData)
    .filter(key => key !== 'id')
    .flatMap(key => {
      const value = changedData[key];
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

  const link = `[Make changes](https://souloverai.com/artist/${data.id}/update?${params ? params : ''})`
  const issueBody = `\`\`\`json\n${JSON.stringify(changedData, null, 2)}\n\`\`\`\n\n${link}`;

  (async () => {
    const searchQuery = `repo:${owner}/${repo} is:issue in:title "${data.name} (${data.spotify})"`;
    const searchResults = await octokit.search.issuesAndPullRequests({ q: searchQuery });

    // Add comment to existing issue
    if (searchResults.data.items.length > 0) {
      const existingIssue = searchResults.data.items[0];

      // Re-open closed issues and clear labels
      if (existingIssue.state === 'closed') {
        await octokit.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          state: 'open',
          labels: ['update-artist'],
        });
      }

      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: existingIssue.number,
        body: issueBody,
      });
    }
    // Add new issue
    else {
      await octokit.issues.create({
        owner,
        repo,
        title: `${data.name} (${data.spotify})`,
        body: issueBody,
        labels: ['update-artist'],
      });
    }
  })();
} else {
  console.log('No changes detected for artist:', data.id);
}