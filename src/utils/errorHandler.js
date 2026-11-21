'use strict';
const { errorCard } = require('../ui');

async function handleError(interaction, err) {
  console.error('[error]', err?.stack || err);
  try {
    const msg = errorCard('An unexpected error occurred. Please try again later.');
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply({ ...msg, ephemeral: true }).catch(() => {});
    }
  } catch {}
}

function wrap(fn) {
  return async (...args) => {
    try { return await fn(...args); }
    catch (err) { await handleError(args[0], err); }
  };
}

module.exports = { handleError, wrap };
