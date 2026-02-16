import { Octokit } from '@octokit/rest';
import { readFileSync } from 'fs';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const payload = JSON.parse(process.env.PAYLOAD);
const data = payload.data;

// Load existing artist data to get the name for the issue title
const existingArtist = JSON.parse(readFileSync(`src/${data.id}.json`, 'utf8'));

const issueData = {
  id: data.id,
  details: data.details || null,
};

const link = `[View artist profile](https://souloverai.com/artist/${data.id})`;
const issueBody = `\`\`\`json\n${JSON.stringify(issueData, null, 2)}\n\`\`\`\n\n${link}`;

(async () => {
  const searchQuery = `repo:${owner}/${repo} is:issue in:title "${existingArtist.name} (${existingArtist.spotify})"`;
  const searchResults = await octokit.search.issuesAndPullRequests({ q: searchQuery });

  // If there is an existing issue
  if (searchResults.data.items.length > 0) {
    const existingIssue = searchResults.data.items[0];

    // Re-open closed issues and set label to remove-artist
    if (existingIssue.state === 'closed') {
      await octokit.issues.update({
        owner,
        repo,
        issue_number: existingIssue.number,
        state: 'open',
        labels: ['remove-artist'],
      });
    }

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: existingIssue.number,
      body: issueBody,
    });
  }
  // Create new issue
  else {
    await octokit.issues.create({
      owner,
      repo,
      title: `${existingArtist.name} (${existingArtist.spotify})`,
      body: issueBody,
      labels: ['remove-artist'],
    });
  }
})();
