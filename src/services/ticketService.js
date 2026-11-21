'use strict';
const Ticket = require('../models/Ticket');
const GuildConfig = require('../models/GuildConfig');
const { getText } = require('../utils/texts');
const { logCard, successCard, errorCard, ticketRatingCard } = require('../ui');
const { EMOJI, COLORS, TICKET_CLOSE_DELAY_MS } = require('../theme');
const { audit } = require('../utils/audit');
const { ts } = require('../utils/format');

const TRANSCRIPT_MAX_MESSAGES = 2000;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function buildTranscript(channel, ticket, closedByTag, closeReason) {
  const messages = [];
  let lastId = null;
  while (messages.length < TRANSCRIPT_MAX_MESSAGES) {
    const fetchLimit = Math.min(100, TRANSCRIPT_MAX_MESSAGES - messages.length);
    const fetched = await channel.messages.fetch({ limit: fetchLimit, ...(lastId ? { before: lastId } : {}) }).catch(() => null);
    if (!fetched || fetched.size === 0) break;
    messages.push(...fetched.values());
    lastId = fetched.last().id;
    if (fetched.size < fetchLimit) break;
  }
  messages.sort((a, b) => a.createdAt - b.createdAt);

  let transcript = `Ticket Transcript — ${channel.name}\n`;
  transcript += `Closed by: ${closedByTag} at ${new Date().toISOString()} (UTC)\n`;
  if (closeReason) transcript += `Reason: ${closeReason}\n`;
  transcript += '─'.repeat(50) + '\n';

  let htmlRows = '';
  if (messages.length) {
    for (const msg of messages) {
      transcript += `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content || '[no text content]'}\n`;
      if (msg.embeds.length) transcript += `  Embeds: ${msg.embeds.length}\n`;
      if (msg.attachments.size) transcript += `  Attachments: ${msg.attachments.map(a => a.url).join(', ')}\n`;
      if (msg.reactions.cache.size) transcript += `  Reactions: ${msg.reactions.cache.map(r => r.emoji.name).join(', ')}\n`;
      const initials = msg.author.username.slice(0, 2).toUpperCase();
      const contentEscaped = msg.content ? escapeHtml(msg.content) : '<em>[no text]</em>';
      const authorEscaped = escapeHtml(msg.author.tag);
      const attachLinks = msg.attachments.size
        ? `<div class="attachments">${msg.attachments.map(a => `<a href="${escapeHtml(a.url)}" target="_blank">${escapeHtml(a.name)}</a>`).join(' ')}</div>`
        : '';
      htmlRows += `<div class="msg"><div class="avatar">${initials}</div><div class="body"><span class="author">${authorEscaped}</span><span class="time">${msg.createdAt.toISOString()} UTC</span><p>${contentEscaped}</p>${attachLinks}</div></div>\n`;
    }
  } else {
    transcript += '(No messages found.)\n';
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transcript — ${escapeHtml(channel.name)}</title>
<style>body{font-family:sans-serif;background:#1e1e1e;color:#ddd;padding:20px;max-width:800px;margin:auto}
.msg{display:flex;gap:12px;margin-bottom:16px}.avatar{width:40px;height:40px;border-radius:50%;background:#C68E4E;display:flex;align-items:center;justify-content:center;font-weight:bold;flex-shrink:0}
.body{flex:1}.author{font-weight:bold;color:#C68E4E}.time{font-size:.8em;color:#888;margin-left:8px}p{margin:4px 0}.attachments a{color:#7ab4f5;font-size:.85em;margin-right:8px}
h1{color:#C68E4E;border-bottom:1px solid #444;padding-bottom:8px}</style></head>
<body><h1>🎫 ${escapeHtml(channel.name)}</h1><p>Closed by <strong>${escapeHtml(closedByTag)}</strong> at ${new Date().toISOString()} UTC</p><hr>${htmlRows}</body></html>`;

  const txtFile = { attachment: Buffer.from(transcript, 'utf-8'), name: `transcript-${String(ticket.ticketNumber || 0).padStart(4, '0')}.txt` };
  const htmlFile = { attachment: Buffer.from(html, 'utf-8'), name: `transcript-${String(ticket.ticketNumber || 0).padStart(4, '0')}.html` };

  return { txtFile, htmlFile, messageCount: messages.length };
}

async function closeTicket(client, ticketId, { closedBy, reason, source }) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket || ticket.status !== 'open') return null;

  // Atomic transition
  const updated = await Ticket.findOneAndUpdate(
    { _id: ticketId, status: 'open' },
    { status: 'closing', closedBy, closeReason: reason, closeSource: source },
    { new: true }
  );
  if (!updated) return null; // Already being closed

  const guildId = updated.guildId;
  const cfg = await GuildConfig.findOne({ guildId });
  const channel = await client.channels.fetch(updated.channelId).catch(() => null);

  // Build transcript if channel exists
  let txtFile = null, htmlFile = null;
  if (channel) {
    const result = await buildTranscript(channel, updated, closedBy, reason);
    var messageCount = result?.messageCount || 0;
    txtFile = result.txtFile;
    htmlFile = result.htmlFile;

    // Lock channel for opener
    try {
      await channel.permissionOverwrites.edit(updated.userId, { SendMessages: false }).catch(() => {});
    } catch {}

    // Closing card
    try {
      await channel.send(logCard(`${EMOJI.ticket} Ticket Closing`, `Transcript is being generated…`)).catch(() => {});
    } catch {}
  }

  // Send summary card to transcript channel (fallback logChannel)
  const transcriptChId = cfg?.transcriptChannel || cfg?.logChannel;
  if (transcriptChId) {
    const tCh = await client.channels.fetch(transcriptChId).catch(() => null);
    if (tCh) {
      const openedAt = updated.createdAt ? new Date(updated.createdAt) : null;
      const closedAt = new Date();
      const durationMs = openedAt ? closedAt - openedAt : 0;
      const durationStr = durationMs > 0 ? `${Math.floor(durationMs / 3600000)}h ${Math.floor((durationMs % 3600000) / 60000)}m` : 'N/A';
      const firstReplyStr = updated.firstStaffReplyAt ? `<t:${Math.floor(new Date(updated.firstStaffReplyAt).getTime() / 1000)}:R>` : 'N/A';
      const closedByDisplay = closedBy === 'system' ? 'Automatic' : `<@${closedBy}>`;

      const summaryCard = (require('../ui')).card({
        title: `${require('../theme').EMOJI.ticket} Ticket Closed — #${String(updated.ticketNumber || 0).padStart(4, '0')}`,
        description: `**Type:** ${updated.typeId}\n**Opener:** <@${updated.userId}>\n**Claimer:** ${updated.claimedBy ? `<@${updated.claimedBy}>` : 'Never claimed'}\n**Closed by:** ${closedByDisplay}\n**Reason:** ${reason || 'None'}\n**Source:** ${source}\n**Opened:** <t:${openedAt ? Math.floor(openedAt.getTime() / 1000) : 0}:f>\n**Closed:** <t:${Math.floor(closedAt.getTime() / 1000)}:f>\n**Duration:** ${durationStr}\n**First Staff Reply:** ${firstReplyStr}\n**Messages:** ${messageCount || (txtFile ? 'Transcript attached' : 'N/A')}`,
        color: require('../theme').COLORS.dark,
        buttons: [],
        ephemeral: false,
      });
      await tCh.send(summaryCard).catch(() => {});
      if (txtFile && htmlFile) {
        await tCh.send({ content: '📎 Transcript files:', files: [txtFile, htmlFile] }).catch(() => {});
      }
    }
  }

  // Send to log channel
  if (cfg?.logChannel && cfg?.logChannel !== transcriptChId) {
    const logCh = await client.channels.fetch(cfg.logChannel).catch(() => null);
    if (logCh) {
      await logCh.send(logCard(`${EMOJI.ticket} Ticket Closed — ${channel?.name || 'unknown'}`, `Closed by <@${closedBy}>${reason ? `\n**Reason:** ${reason}` : ''}\nSource: ${source}`)).catch(() => {});
      if (txtFile && htmlFile) {
        await logCh.send({ content: '📎 Transcript files:', files: [txtFile, htmlFile] }).catch(() => {});
      }
    }
  }

  // DM transcript to opener (respect config)
  if (cfg?.automation?.transcriptDmToUser !== false && updated.userId && txtFile && htmlFile) {
    try {
      const opener = await client.users.fetch(updated.userId);
      await opener.send(successCard(getText(cfg, 'ticket_transcript_dm', { user: `<@${updated.userId}>`, ticket: updated._id }), false)).catch(() => {});
      await opener.send({ content: '📎 Transcript files:', files: [txtFile, htmlFile] }).catch(() => {});
    } catch {}
  }

  // Update DB to closed
  await Ticket.findByIdAndUpdate(ticketId, {
    status: 'closed',
    closedAt: new Date(),
    closedBy,
    closedReason: reason,
    closeSource: source,
    deleteAt: new Date(Date.now() + (cfg?.automation?.closeDelaySeconds || 10) * 1000),
  });

  await audit(guildId, closedBy, 'ticket_close', 'ticket', ticketId, { channelName: channel?.name, reason, source });

  // Rating DM
  if (cfg?.automation?.ticketRatingEnabled !== false && updated.userId) {
    try {
      const opener = await client.users.fetch(updated.userId);
      await opener.send(ticketRatingCard(channel?.name || 'ticket', ticketId, cfg)).catch(() => {});
    } catch {}
  }

  // Invalidate ticketChannelMap
  // (messageCreate.js handles this via its own cache)

  // Schedule channel deletion
  if (channel) {
    setTimeout(() => channel.delete().catch(() => {}), (cfg?.automation?.closeDelaySeconds || 10) * 1000);
  }

  return updated;
}

module.exports = { closeTicket, buildTranscript };
