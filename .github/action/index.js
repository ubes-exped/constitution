const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');
const fs = require('mz/fs');

(async () => {
  try {
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

    const { data: pulls } = await octokit.pulls.list({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo
    });

    const root = github.context.repo.repo;
    console.log('root', root);

    await fs.mkdir('./gh-pages/_amendments', { recursive: true });
    await fs.readdir('./gh-pages/_amendments');

    for (const pull of pulls) {
      console.log(JSON.stringify(pull, undefined, 2));
      const base = pull.base.label;
      const source = pull.base.label;
      console.log(
        'listfiles',
        await octokit.pulls.listFiles({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          pull_number: pull.number
        })
      );
      const commit = pull.merge_commit_sha;
    }

    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2);
    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
})();
