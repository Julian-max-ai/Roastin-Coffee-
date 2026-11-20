const { WebhookClient } = require('discord.js');

/**
 * Sends a Components V2 message via webhook.
 * payload = JSON exported from dweeb.faizo.net
 */
async function sendComponentsV2(webhookUrl, payload) {
  const url = new URL(webhookUrl);
  const parts = url.pathname.split('/');
  const webhookId = parts[3];
  const webhookToken = parts[4];
  const client = new WebhookClient({ id: webhookId, token: webhookToken });
  // Components V2 flag = 1 << 15
  await client.send({ ...payload, flags: 32768 });
  client.destroy();
}

async function editComponentsV2(webhookUrl, messageId, payload) {
  const url = new URL(webhookUrl);
  const parts = url.pathname.split('/');
  const client = new WebhookClient({ id: parts[3], token: parts[4] });
  await client.editMessage(messageId, { ...payload, flags: 32768 });
  client.destroy();
}

module.exports = { sendComponentsV2, editComponentsV2 };
