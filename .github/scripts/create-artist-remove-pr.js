import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src');

const { GITHUB_TOKEN, REPO, ISSUE_NUMBER, ISSUE_BODY, COMMENT_ID, GITHUB_OUTPUT } = process.env;
const [owner, repo] = REPO?.split('/') || [];

const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Extract JSON from a text containing a code block
 */
const extractJSON = (text) => {
  const match = text.match(/```json\s*\n([\s\S]*?)\n```/);
  return match ? match[1] : null;
};

/**
 * Get content to parse from issue body or most recent comment
 */
const getContentToParse = async () => {
  const comments = await octokit.issues.listComments({ owner, repo, issue_number: ISSUE_NUMBER });
  const sortedComments = comments.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  for (const comment of sortedComments) {
    const json = extractJSON(comment.body);
    if (json) {
      console.log('Using comment from', comment.created_at);
      return json;
    }
  }

  const json = extractJSON(ISSUE_BODY);
  if (json) {
    console.log('Using issue body');
    return json;
  }

  throw new Error('No JSON code block found in issue body or comments');
};

/**
 * Set GitHub Actions output
 */
const setOutput = (key, value) => {
  if (GITHUB_OUTPUT) {
    fs.appendFileSync(GITHUB_OUTPUT, `${key}=${value}\n`);
  }
};

/**
 * Main execution
 */
const main = async () => {
  try {
    // Get and parse content
    const content = await getContentToParse();
    console.log('Received content:', content, '\n---');

    const removeData = JSON.parse(content);
    if (!removeData.id) {
      throw new Error('Artist id is required');
    }

    // Verify artist file exists
    const artistFilePath = path.join(SRC_DIR, `${removeData.id}.json`);
    if (!fs.existsSync(artistFilePath)) {
      throw new Error(`Artist file not found: ${removeData.id}.json`);
    }

    // Read artist data to get the name before deleting
    const existingArtist = JSON.parse(fs.readFileSync(artistFilePath, 'utf8'));
    const artistName = existingArtist.name;

    const branchName = `artist-remove/${removeData.id}`;

    // Delete artist file
    fs.unlinkSync(artistFilePath);
    console.log(`Artist file deleted: src/${removeData.id}.json`);

    // Set outputs for subsequent workflow steps
    setOutput('filename', `${removeData.id}.json`);
    setOutput('artist_id', removeData.id);
    setOutput('artist_name', artistName);
    setOutput('branch_name', branchName);

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

main();
