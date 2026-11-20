# ☕ Roastin Coffee — PR Bot

Discord PR bot for the Roblox café group **Roastin' Coffee**. Manages partners, infractions, tickets, monthly reviews and event requests across multiple Discord servers.

## Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/config` | Interactive server configuration panel | Administrator |
| `/partner add/remove/edit/list` | Manage partner groups | Manage Guild |
| `/infraction add/list/remove` | Warnings, strikes, terminations | Manage Guild |
| `/review send` | Send monthly partnership reviews | Manage Guild |
| `/event-request` | Submit affiliate event for staff approval | Everyone |
| `/ticket setup/edit/info` | Configure ticket types | Manage Guild |
| `/dweeb send/edit` | Post Components V2 designs from dweeb.faizo.net | Administrator |

## Ticket System — Dweeb Integration

Build your ticket panel on [dweeb.faizo.net](https://dweeb.faizo.net) and set button `customId`s to:

| Ticket Type | CustomId |
|-------------|----------|
| General Question | `ticket_open:general` |
| Partnership Request | `ticket_open:partnership` |
| PR Report | `ticket_open:report` |

Then use `/dweeb send` to post the panel to your channel.

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
/config              → set channels and roles
/ticket setup        → initialize ticket types
```

## Deployment (Render + GitHub + UptimeRobot)

1. Push to GitHub
2. Create a **Web Service** on [render.com](https://render.com), connect repo
3. Set env vars in Render dashboard
4. Add UptimeRobot monitor (every 5 min) to keep the instance alive

## Architecture

```
src/
├── commands/       # slash command handlers
├── events/         # Discord event handlers
├── models/         # Mongoose schemas
├── theme/          # brand colors, emojis, constants
├── ui/             # reusable Components V2 card builders
└── utils/          # format, permissions, pagination helpers
```

## ⚠️ Security Note

If you see a file `q-dev-chat-*.md` in the git history, it contained a Discord webhook URL. Delete that webhook immediately in your Discord server settings (Channel → Integrations → Webhooks).
