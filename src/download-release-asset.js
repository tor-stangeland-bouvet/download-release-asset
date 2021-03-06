const core = require('@actions/core');
const fs  = require('fs');
const axios = require('axios').default;

async function run() {
  try {
    const api = 'https://api.github.com';
    const owner = core.getInput('owner');
    const repo = core.getInput('repo');
    const tag = core.getInput('tag');
    const file = core.getInput('file');
    const token = core.getInput('token');

    // Get release
    let url;
    if (tag == 'latest') {
      url = api + '/repos/' + owner + '/' + repo + '/releases/latest';
    } else {
      url = api + '/repos/' + owner + '/' + repo + '/releases/tags/' + tag;
    }

    let headers = {
      Accept: 'application/json',
    };
    if (token != '') {
      headers.Authorization = 'token ' + token;
    }

    let resp = await axios({
      method: 'get',
      url: url,
      headers: headers,
    });
    let js = resp.data;

    // Construct regex
    let re;
    if (file[0] == '/' && file[file.length - 1] == '/') {
      re = new RegExp(file.substr(1, file.length - 2));
    } else {
      re = new RegExp('^' + file + '$');
    }

    // Get assets
    let assets = [];
    for (let a of js.assets) {
      if (re.test(a.name)) {
        assets.push(a);
      }
      else {
        console.log('Ignoring ' + a.name);
      }
    }

    if (assets.length === 0) {
      console.warn('No matching assets in release!');
    }
    
    // Download assets
    headers = {
      Accept: 'application/octet-stream',
    };
    if (token != '') {
      headers.Authorization = 'token ' + token;
    }
    for (let a of assets) {
      console.log('Downloading asset: ' + a.name);
      resp = await axios({
        method: 'get',
        url: a.url,
        headers: headers,
        maxRedirects: 0,
        responseType: 'stream',
      }).catch(error => {
        if (error.isAxiosError && error.response.status==302) {
          return error.response
        }

        throw error;
      });

      if (resp.status==302) {
        console.log('Redirected to ' + resp.headers.location);
        resp = await axios({
          method: 'get',
          url: resp.headers.location,
          //headers: headers,
          maxRedirects: 0,
          responseType: 'stream',
        });
      }

      console.log('Writing ' + a.name + '...');
      resp.data.pipe(fs.createWriteStream(a.name));
      console.log('Download of ' + a.name + ' completed.');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = run;
