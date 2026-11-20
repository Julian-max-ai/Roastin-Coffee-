const https = require('https');

function rawWebhookRequest(url, method, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
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

async function sendComponentsV2(webhookUrl, payload) {
  const { flags, content, embeds, ...rest } = payload;
  const body = {
    ...rest,
    flags: 32768,
  };
  return rawWebhookRequest(webhookUrl + '?wait=true', 'POST', body);
}

async function editComponentsV2(webhookUrl, messageId, payload) {
  const { flags, content, embeds, ...rest } = payload;
  const body = { ...rest, flags: 32768 };
  return rawWebhookRequest(`${webhookUrl}/messages/${messageId}`, 'PATCH', body);
}

module.exports = { sendComponentsV2, editComponentsV2 };
