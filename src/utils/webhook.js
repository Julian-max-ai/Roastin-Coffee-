const { WebhookClient } = require('discord.js');
const https = require('https');

/**
 * Sends a Components V2 message via webhook using raw HTTP (flags must be passed directly).
 */
async function sendComponentsV2(webhookUrl, payload) {
  return rawWebhookRequest(webhookUrl, 'POST', payload);
}

async function editComponentsV2(webhookUrl, messageId, payload) {
  return rawWebhookRequest(`${webhookUrl}/messages/${messageId}`, 'PATCH', payload);
}

function rawWebhookRequest(url, method, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ ...payload, flags: 32768 });
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data ? JSON.parse(data) : {});
        reject(new Error(`Discord API error ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { sendComponentsV2, editComponentsV2 };
