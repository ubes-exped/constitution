// @ts-check

const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');
const fs = require('mz/fs');
const fetch = require('node-fetch');

/** @typedef {import('@octokit/rest').Octokit.PullsListResponseItem } PullsListResponseItem */
/** @typedef {import('@actions/exec/lib/interfaces').ExecOptions } ExecOptions */

(async () => {
  try {
    await main();
  } catch (error) {
    core.setFailed(error.message);
  }
})();

async function main() {
  const token = core.getInput('repo-token');

  const octokit = new github.GitHub(token);

  const { data: allPulls } = await octokit.pulls.list({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo
  });

  const root = github.context.repo.owner;
  const rootBranch = `${root}:master`;

  const pulls = filterPRs(allPulls, rootBranch);

  await fs.mkdir('./gh-pages/_amendments', { recursive: true });

  for (const [baseRef, pull] of pulls) {
    const sourceRef = pull.base.label;

    const merge_commit = pull.merge_commit_sha;
    const newConstitutionURL = `${pull.base.repo.html_url}/raw/${merge_commit}/Constitution.md`;
    const newConstitution = await (await fetch(newConstitutionURL)).text();
    const oldConstitution = await fs.readFile('./gh-pages/Constitution.md', {
      encoding: 'utf8'
    });
    if (newConstitution == oldConstitution) {
      core.warning(`No change to constitution in ${pull.number}`);
    }
    const prefix = ["---", "---", ""].join("\n");
    fs.writeFile(`./gh-pages/_amendments/${pull.number}.md`, prefix + newConstitution);
  }

  await commit();
}

async function commit() {
  /** @type {(string: String, args?: string[], opts?: ExecOptions) => Promise<number>} */

  const cmd = async (string, args = [], opts = {}) =>
    await exec.exec(string, args, { cwd: 'gh-pages', ...opts });
  await cmd('git', ['checkout', '-b', 'gh-pages']);
  await cmd('git', [
    'config',
    '--local',
    'user.email',
    'charlie_harding@icloud.com'
  ]);
  await cmd('git', ['config', '--local', 'user.name', 'Charlie Harding']);
  await cmd('git', ['fetch']);
  await cmd('git', ['merge', '-s', 'ours', 'origin/gh-pages', '--no-commit'], {
    ignoreReturnCode: true
  });
  await cmd('git', ['add', '.']);
  await cmd('git', ['commit', '-m', 'Update pull requests on gh-pages']);
}

function filterPRs(
  /** @type {PullsListResponseItem[]} */ pulls,
  /** @type {String} */ rootBranch
) {
  /** @type {String[]} */ const rootChildren = [];

  /** @type {Map<String, PullsListResponseItem & { children: String[] }>} */ const pullsByRef = new Map();
  for (const pull of pulls) {
    const headRef = pull.head.label;
    if (pullsByRef.has(headRef)) {
      core.warning(
        `Two pulls with same head ${headRef}, ignoring #${pull.number}.`
      );
      continue;
    }
    pullsByRef.set(headRef, { ...pull, children: [] });
  }

  for (const pull of pulls) {
    const headRef = pull.head.label;
    const baseRef = pull.base.label;
    if (baseRef === rootBranch) rootChildren.push(headRef);
    else {
      const base = pullsByRef.get(baseRef);
      if (base) base.children.push(headRef);
    }
  }
  /** @type {Set<String>} */ const goodRefs = new Set();

  /** @type {(ref: String) => void} */ const markChildren = ref => {
    goodRefs.add(ref);
    pullsByRef.get(ref).children.forEach(markChildren);
  };
  rootChildren.forEach(markChildren);

  for (const [ref, pull] of pullsByRef) {
    if (!goodRefs.has(ref)) {
      console.warn(`Ignoring #${pull.number} with base ${pull.base.label}.`);
      pullsByRef.delete(ref);
    }
  }
  return pullsByRef;
}
