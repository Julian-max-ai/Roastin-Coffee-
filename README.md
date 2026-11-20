# ☕ Roastin Coffee — PR Bot

Discord PR bot for the Roblox café group **Roastin' Coffee**. Manages partners, infractions, tickets, monthly reviews and event requests across multiple Discord servers.

## Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/config` | Interactive server configuration panel | Administrator |
| `/partner add/remove/edit/list/info` | Manage partner groups | Manage Guild |
| `/infraction add/list/remove` | Warnings, strikes, terminations | Manage Guild |
| `/review send/status` | Monthly partnership review system | Manage Guild |
| `/event-request` | Submit affiliate event for staff approval | Everyone |
| `/ticket setup/edit/info/add/remove/rename/priority` | Configure and manage tickets | Manage Guild |
| `/dweeb send/edit` | Post Components V2 designs from dweeb.faizo.net | Administrator |
| `/test-style` | Preview all card styles | Administrator |
| `/stats` | Server statistics | Administrator |
| `/doctor` | Bot health check | Administrator |
| `/export` | Export data as CSV | Administrator |
| `/audit` | Audit log | Administrator |

## Ticket System — Dweeb Integration

Build your ticket panel on [dweeb.faizo.net](https://dweeb.faizo.net) and set button `customId`s to:

| Ticket Type | CustomId |
|-------------|----------|
| General Question | `ticket_open:general` |
| Partnership Request | `ticket_open:partnership` |
| PR Report | `ticket_open:report` |

Then use `/dweeb send` to post the panel to your channel.

## Automation

All automation features are configurable under `/config` → **⚙️ Automation**:

- **Ticket Inactivity Reminder** — remind after N hours of inactivity
- **Ticket Auto-Close** — close after N hours
- **Max Open Tickets per User** — limit concurrent tickets
- **Ticket Rating** — send rating DM after ticket close
- **Infraction Expiry** — auto-expire warnings/strikes after N days
- **Review Reminder** — remind after N days
- **Review Overdue** — flag to staff after N days
- **Event Reminder** — remind N hours before start
- **Anniversary Announcements** — congratulate partners
- **Invite Health Check** — weekly Discord invite validation
- **Auto-Assign Rep Roles** — assign partner rep roles automatically
- **Weekly Event Digest** — Monday overview

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/roastin-coffee
BRAND_LOGO_URL=https://your-logo-url.png  # optional
```

### 2. Install & Deploy

```bash
npm install
node deploy-commands.js   # register slash commands (run once)
npm start
```

### 3. First-time Server Setup

```
/config              → set channels, roles, review settings, automation
/ticket setup        → initialize ticket types
```

## Deployment (Render)

1. Push to GitHub
2. Create a **Web Service** on [render.com](https://render.com), connect repo
3. Set env vars in Render dashboard
4. The `healthCheckPath: /` in `render.yaml` enables Render's health checks

### Keep-Alive

Render Free instances spin down after inactivity. The built-in mini HTTP server responds with `OK` on `GET /`. Set up an external uptime monitor (e.g. UptimeRobot) to ping your Render URL every 5–10 minutes.

## Architecture

```
src/
├── commands/       # slash command handlers
├── events/         # Discord event handlers
├── models/         # Mongoose schemas
├── theme/          # brand colors, emojis, constants
├── ui/             # reusable Components V2 card builders
└── utils/          # format, permissions, pagination, audit helpers
```

## CustomIds

- `ticket_open:<type>` — open ticket
- `ticket_close`, `ticket_claim`, `ticket_release` — ticket actions
- `ticket_rate:<id>:<stars>` — ticket rating
- `review_start:<partnerId>` — start review
- `review_submit:<partnerId>` — submit review
- `event_approve:<id>`, `event_deny:<id>` — event decision
- `event_deny_reason:<id>` — denial reason modal
- `event_interest:<id>` — interested button
- `partner_confirm_remove:<id>`, `partner_cancel_remove` — partner removal
- `page:<ctx>:<prev\|next>:<n>` — pagination
- `cfg_*` — configuration panel interactions

## ⚠️ Security Note

If you see a file `q-dev-chat-*.md` in the git history, it contained a Discord webhook URL. Delete that webhook immediately in your Discord server settings (Channel → Integrations → Webhooks).
