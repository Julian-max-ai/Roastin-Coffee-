'use strict';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PAGE_SIZE } = require('../theme');

/**
 * Returns { items, totalPages, row } for a given page.
 * row is null on the last page with only one page.
 * ctx is a short context string embedded in customIds (e.g. 'partners', 'infractions:<partnerId>').
 */
function paginate(allItems, page = 0, pageSize = PAGE_SIZE, ctx = '') {
  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const safePage   = Math.max(0, Math.min(page, totalPages - 1));
  const items      = allItems.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const prefix = ctx ? `page:${ctx}:` : `page:_:`;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}prev:${safePage}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage === 0),
    new ButtonBuilder()
      .setCustomId(`${prefix}next:${safePage}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages - 1),
  );

  return { items, totalPages, page: safePage, row: totalPages > 1 ? row : null };
}

module.exports = { paginate };
