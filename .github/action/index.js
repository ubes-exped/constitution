const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');

(async () => {
  try {
    const token = core.getInput('github-token');

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

    const pulls = await octokit.pulls.list({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo
    });

    console.log(pulls);

    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2);
    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
})();
