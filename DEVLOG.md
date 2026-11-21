o# Roastin Coffee PR Bot — Development Log

## System Overview
Discord PR Bot for Roastin Coffee Roblox Café Group.
Hosted on Render (Web Service), DB on MongoDB Atlas, Code on GitHub.
Stack: Node.js (CommonJS), discord.js ^14.14.1 (Components V2), mongoose ^8, node-cron, dotenv.

---

## Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/config` | Interactive config panel with select menus | Administrator |
| `/partner add/remove/edit/list/info` | Partner management with autocomplete | Manage Guild |
| `/infraction add/list/remove` | Warnings, strikes, terminations with autocomplete | Manage Guild |
| `/review send/status` | Monthly review system (DM or link mode) | Manage Guild |
| `/event-request` | Affiliate event submissions with approve/deny | Everyone |
| `/ticket setup/edit/info/add/remove/rename/priority` | Ticket system | Manage Guild |
| `/dweeb send/edit` | Send dweeb.faizo.net Components V2 messages | Administrator |
| `/test-style` | Design system preview | Administrator |
| `/stats` | Server statistics | Administrator |
| `/doctor` | Bot health check | Administrator |
| `/export <type>` | Export data as CSV | Administrator |
| `/audit` | Audit log (paginated) | Administrator |

---

## Ticket System — Fixed CustomIds for Dweeb

In dweeb.faizo.net, set button customIds to:

| Ticket Type | CustomId |
|-------------|----------|
| General Question | `ticket_open:general` |
| Partnership Request | `ticket_open:partnership` |
| PR Report | `ticket_open:report` |

Ticket button handlers: `ticket_close`, `ticket_claim`, `ticket_release`.

---

## Data Models

**GuildConfig** — guildId, channels, roles, review settings, automation object
**Partner** — guildId, name, robloxLink, discordInvite, representativeId, status, inviteValid
**Infraction** — guildId, partnerId, type, reason, issuedBy, issuedAt, removed, expired, expiresAt
**Ticket** — guildId, channelId, userId, typeId, claimedBy, status, priority, timestamps, rating
**ReviewSubmission** — guildId, partnerId, month, answers, submittedBy, submittedAt
**AuditEntry** — guildId, actorId, action, targetType, targetId, details, createdAt (TTL 180d)

---

## Fixed Bugs (P1 + P2)

F1–F12: defer/reply strategy, V2 content+card separation, modal defer, ticket close/claim, config panel spread override, partner remove logic, pagination routing, event decision card, dweeb double-reply, autocomplete populate.

F13–F20: duplicate logs, ephemeral in channels, test-style redesign, {partners} placeholder, DM Questions → In-Discord Form, text truncation, reviewQuestions config, cleanup (webhook.js removed, logoUrl display), render.yaml web type, README/DEVLOG updates.

---

## Setup Steps

1. `/ticket setup` — initializes the 3 ticket types
2. `/config` — set channels, roles, review settings, automation
3. `/dweeb send` — post dweeb designs to channels
4. `node deploy-commands.js` — register new/changed slash commands

---

## Environment Variables (Render)

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `MONGODB_URI`
- `BRAND_LOGO_URL` (optional)

---

## Known Limitations

- Render Free instances spin down on inactivity; use external keep-alive ping
- Intents: Guilds only (no message content, no guild members)
- customIds must stay under 100 characters
