const core = require('@actions/core');
const github = require('@actions/github');
const git = require('nodegit');

(async () => {
  try {
    // `who-to-greet` input defined in action metadata file
    const nameToGreet = core.getInput('who-to-greet');
    const repo = await git.Repository.open();
    await repo.checkoutBranch('master');
    await git.Reference.symbolicCreate(repo, 'HEAD', 'refs/heads/gh-pages', 1);
    const { exec } = require('child_process');
    exec('git status', (err, stdout, stderr) => {
      if (err) {
        //some err occurred
        throw new Error(err);
      } else {
        // the *entire* stdout and stderr (buffered)
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
      }
    });

    console.log(`Hello ${nameToGreet}!`);
    const time = new Date().toTimeString();
    core.setOutput('time', time);
    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2);
    console.log(`The event payload: ${payload}`);
  } catch (error) {
    core.setFailed(error.message);
  }
})();
