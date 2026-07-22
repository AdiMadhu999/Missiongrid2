const https = require('https');
const fs = require('fs');
const token = process.env.GITHUB_TOKEN;

let runId = process.argv[2];

function start() {
  if (runId) {
    console.log(`Using user-specified Run ID: ${runId}`);
    checkAction();
  } else {
    console.log('No Run ID specified. Fetching the latest "Build Android APKs" run dynamically...');
    getLatestRunId((fetchedId) => {
      runId = fetchedId;
      checkAction();
    });
  }
}

function getLatestRunId(callback) {
  https.get({
    hostname: 'api.github.com',
    path: '/repos/AdiMadhu999/MissionGrid/actions/runs',
    headers: {
      'User-Agent': 'Node.js',
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json'
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (!json.workflow_runs) {
          console.error("No workflow runs found in response:", json);
          process.exit(1);
        }
        const runs = json.workflow_runs;
        const targetRun = runs.find(run => run.name === 'Build Android APKs');
        if (targetRun) {
          console.log(`Latest 'Build Android APKs' run ID found: ${targetRun.id} (Status: ${targetRun.status}, Conclusion: ${targetRun.conclusion})`);
          callback(targetRun.id.toString());
        } else {
          console.error("Could not find any run named 'Build Android APKs'.");
          process.exit(1);
        }
      } catch (e) {
        console.error("Failed to parse workflow runs:", e);
        process.exit(1);
      }
    });
  }).on('error', err => {
    console.error('Error fetching workflow runs:', err);
    process.exit(1);
  });
}

function checkAction() {
  https.get({
    hostname: 'api.github.com',
    path: `/repos/AdiMadhu999/MissionGrid/actions/runs/${runId}`,
    headers: {
      'User-Agent': 'Node.js',
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json'
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const run = JSON.parse(data);
      console.log(`Run ${run.id} - Status: ${run.status} - Conclusion: ${run.conclusion}`);
      
      if (run.status === 'completed') {
        if (run.conclusion === 'success') {
          console.log('Action successful. Fetching artifacts...');
          fetchArtifacts(run.id);
        } else {
          console.log('Action failed.');
          process.exit(1);
        }
      } else {
        setTimeout(checkAction, 10000);
      }
    });
  }).on('error', err => {
    console.error('Error fetching action:', err);
    setTimeout(checkAction, 10000);
  });
}

function fetchArtifacts(runId) {
  https.get({
    hostname: 'api.github.com',
    path: `/repos/AdiMadhu999/MissionGrid/actions/runs/${runId}/artifacts`,
    headers: {
      'User-Agent': 'Node.js',
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json'
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const artifacts = JSON.parse(data).artifacts;
      console.log('Found artifacts:', artifacts.map(a => a.name));
      
      let pending = artifacts.length;
      if (pending === 0) process.exit(0);

      artifacts.forEach(artifact => {
        downloadArtifact(artifact, () => {
          pending--;
          if (pending === 0) {
            console.log('All artifacts downloaded.');
            process.exit(0);
          }
        });
      });
    });
  }).on('error', err => {
    console.error('Error fetching artifacts:', err);
    process.exit(1);
  });
}

function downloadArtifact(artifact, callback) {
  https.get({
    hostname: 'api.github.com',
    path: `/repos/AdiMadhu999/MissionGrid/actions/artifacts/${artifact.id}/zip`,
    headers: {
      'User-Agent': 'Node.js',
      'Authorization': 'token ' + token
    }
  }, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      const httpsReq = https.get(res.headers.location, (redirectRes) => {
        const file = fs.createWriteStream(artifact.name + '.zip');
        redirectRes.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded ${artifact.name}.zip`);
          callback();
        });
      });
    } else {
      console.error(`Failed to download ${artifact.name}: Status code ${res.statusCode}`);
      callback();
    }
  }).on('error', err => {
    console.error(`Error downloading ${artifact.name}:`, err);
    callback();
  });
}

start();
