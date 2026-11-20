# Roastin Coffee PR Bot — Development Log

## System Overview
Discord PR Bot for Roastin Coffee Roblox Café Group.
Hosted on Render, DB on MongoDB Atlas, Code on GitHub.

---

## Commands

| Command | Description |
|---------|-------------|
| `/config` | Interactive config panel with select menus |
| `/partner add/remove/edit/list` | Partner management with autocomplete |
| `/infraction add/list/remove` | Warnings, strikes, terminations with autocomplete |
| `/review send` | Monthly review system (DM or link mode) |
| `/event-request` | Affiliate event submissions with approve/deny |
| `/ticket setup/edit/info` | Ticket system setup |
| `/dweeb send/edit` | Send dweeb.faizo.net Components V2 messages |

---

## Ticket System — Fixed CustomIds for Dweeb

In dweeb.faizo.net, set button customIds to:

| Ticket Type | CustomId |
|-------------|----------|
| General Question | `ticket_open:general` |
| Partnership Request | `ticket_open:partnership` |
| PR Report | `ticket_open:report` |

---

## Setup Steps

1. `/ticket setup` — initializes the 3 ticket types
2. `/config` — set channels and roles
3. `/dweeb send` — post dweeb designs to channels

---

## Environment Variables (Render)

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `MONGODB_URI`
