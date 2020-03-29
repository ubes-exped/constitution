// @ts-check

const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');
const fs = require('mz/fs');
const fetch = require('node-fetch');

/** @typedef {import('@octokit/rest').Octokit.PullsListResponseItem } PullsListResponseItem */

(async () => {
  try {
    await main();
  } catch (error) {
    core.setFailed(error.message);
  }
})();

async function main() {
  const token = core.getInput('repo-token');

  await exec.exec('git symbolic-ref HEAD refs/heads/gh-pages', [], {
    silent: true
  });

  await exec.exec('git status', [], {
    silent: true,
    listeners: {
      stdline(line) {
        console.log(line);
      }
    }
  });

  const octokit = new github.GitHub(token);

  const { data: allPulls } = await octokit.pulls.list({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo
  });

  const root = github.context.repo.owner;
  const rootBranch = `${root}:master`;

  const pulls = filterPRs(allPulls, rootBranch);

  await fs.mkdir('./gh-pages/_amendments', { recursive: true });
  const files = await fs.readdir('./gh-pages/_amendments');

  console.log(files);

  for (const [baseRef, pull] of pulls) {
    console.log(JSON.stringify(pull, undefined, 2));
    const sourceRef = pull.base.label;

    const merge_commit = pull.merge_commit_sha;
    const newConstitutionURL = `${pull.base.repo.html_url}/raw/${merge_commit}/Constitution.md`;
    console.log(newConstitutionURL);
    const newConstitution = await (await fetch(newConstitutionURL)).text();
    const oldConstitution = await fs.readFile('./gh-pages/Constitution.md', {
      encoding: 'utf8'
    });
    if (newConstitution == oldConstitution) {
      core.warning(`No change to constitution in ${pull.number}`);
    }
    fs.writeFile(`./gh-pages/_amendments/${pull.number}.md`, newConstitution);

    // const { data: filesChanged } = await octokit.pulls.listFiles({
    //   owner: github.context.repo.owner,
    //   repo: github.context.repo.repo,
    //   pull_number: pull.number
    // });
    // console.log('listfiles', filesChanged);
  }

  await exec.exec('git', ['add', '.']);
  await exec.exec('git', [
    'config',
    'user.email',
    'charlie_harding@icloud.com'
  ]);
  await exec.exec('git', ['config', 'user.name', 'Charlie Harding']);
  await exec.exec('git', ['status']);
  await exec.exec('git', ['commit', '-m', 'Update pull requests on gh-pages']);
  await exec.exec('git', ['push']);
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
