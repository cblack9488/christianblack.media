#!/usr/bin/env node
/* christianblack.media — reach figures.

   Fetches follower and view counts and writes them where the renderer can
   read them. Run by the build, so the numbers are baked into the deployed
   pages; nothing is ever committed back to main.

   Nothing here is required. With no credentials set it writes an empty file
   and exits quietly, and the Reach block falls back to whatever is typed
   into content.js by hand. A platform that fails — an expired token, an API
   having a bad day — is skipped rather than failing the build, because a
   slightly stale number is better than no website.

   Secrets it looks for, all optional:
     IG_TOKEN        long-lived Instagram access token
     IG_USER_ID      the Instagram account id (or 'me')
     YT_API_KEY      a Google API key with YouTube Data API v3 enabled
     YT_CHANNEL_ID   the channel id, beginning UC…
     GH_TOKEN        a repo token that can write secrets, for token renewal
     GH_REPO         owner/repo, supplied by Actions

   Run: node tools/fetch-reach.js
*/

'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../assets/js/reach.js');
const API = 'https://graph.instagram.com';

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'christianblack.media build' } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body.error && (body.error.message || body.error.type)) || res.status;
    throw new Error(String(msg));
  }
  return body;
}

/* ---------- Instagram ----------

   The long-lived token lasts sixty days. Refreshing returns a *new* token
   rather than extending the one in hand, so the new one has to be stored or
   the refresh was pointless — hence writing it back into the repository
   secret. Where that is not possible the figure is still fetched; the token
   simply needs replacing by hand before it lapses, and the log says when. */

async function instagram() {
  const token = process.env.IG_TOKEN;
  if (!token) return null;
  const who = process.env.IG_USER_ID || 'me';
  const data = await getJSON(`${API}/v21.0/${who}?fields=followers_count,media_count&access_token=${token}`);
  const out = {
    followers: data.followers_count,
    posts: data.media_count
  };
  try {
    const r = await getJSON(`${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`);
    const days = Math.round((r.expires_in || 0) / 86400);
    if (r.access_token && r.access_token !== token) {
      const stored = await storeSecret('IG_TOKEN', r.access_token);
      console.log('     instagram token refreshed, good for ~' + days + ' days' +
        (stored ? ' (stored)' : ' — COULD NOT STORE IT, see below'));
      if (!stored) {
        console.log('     !! the refreshed token was not saved. Set GH_TOKEN so this can renew');
        console.log('        itself, or replace IG_TOKEN by hand before it lapses.');
      }
    }
  } catch (e) {
    console.log('     instagram token refresh skipped: ' + e.message);
  }
  return out;
}

/* Repository secrets are stored sealed, so a new value has to be encrypted
   against the repository's public key before it can be written. */
async function storeSecret(name, value) {
  const token = process.env.GH_TOKEN;
  const repo = process.env.GH_REPO;
  if (!token || !repo) return false;
  let sodium;
  try { sodium = require('libsodium-wrappers'); } catch (e) { return false; }
  await sodium.ready;
  const head = { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json' };
  const key = await getJSON2(`https://api.github.com/repos/${repo}/actions/secrets/public-key`, head);
  const sealed = sodium.crypto_box_seal(
    sodium.from_string(value), sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL));
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/${name}`, {
    method: 'PUT',
    headers: Object.assign({ 'content-type': 'application/json' }, head),
    body: JSON.stringify({
      encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL),
      key_id: key.key_id
    })
  });
  return res.ok;
}

async function getJSON2(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('github ' + res.status);
  return res.json();
}

/* ---------- YouTube ----------
   Public channel statistics need an API key and nothing else — no login
   flow, no token to keep alive. Subscriber counts come back rounded down to
   three significant figures, which is Google's doing, not ours. */

async function youtube() {
  const key = process.env.YT_API_KEY;
  const id = process.env.YT_CHANNEL_ID;
  if (!key || !id) return null;
  const data = await getJSON(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${id}&key=${key}`);
  const s = ((data.items || [])[0] || {}).statistics;
  if (!s) throw new Error('no channel returned — check the channel id');
  return {
    subscribers: +s.subscriberCount || undefined,
    views: +s.viewCount || undefined,
    videos: +s.videoCount || undefined
  };
}

(async () => {
  const reach = { fetchedAt: new Date().toISOString().slice(0, 10) };
  for (const [name, fn] of [['instagram', instagram], ['youtube', youtube]]) {
    try {
      const v = await fn();
      if (v) { reach[name] = v; console.log('     ' + name + ': ' + JSON.stringify(v)); }
    } catch (e) {
      console.log('     ' + name + ' skipped: ' + e.message);
    }
  }
  const got = Object.keys(reach).filter(k => k !== 'fetchedAt');
  fs.writeFileSync(OUT,
    '/* Generated by tools/fetch-reach.js at build time. Not committed:\n' +
    '   these numbers exist only in the deployed site. */\n' +
    'window.CB_REACH = ' + JSON.stringify(reach, null, 2) + ';\n');
  console.log('  reach: ' + (got.length ? got.join(', ') : 'nothing configured — using whatever is in content.js'));
})().catch(e => {
  /* Never fail the build over a follower count. */
  console.log('  reach: skipped (' + e.message + ')');
  fs.writeFileSync(OUT, 'window.CB_REACH = {};\n');
});
