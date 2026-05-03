# Bunny

A Discord egg-hunt bot for server events and community games.

Members chat, eggs appear, players claim them for points, and the leaderboard tracks event rankings.

Current version: `v1.1.1`

## What This Bot Does

- Spawns eggs in one configured channel when people are active.
- Lets users claim eggs for points with `<prefix>claim`.
- Tracks a leaderboard with `<prefix>lb`.
- Occasionally spawns a golden egg for bigger rewards.
- Supports streak bonus rewards for repeat claimers.
- Persists active egg + streak runtime state across restarts.
- Includes admin/owner controls for manual spawn, rate changes, edits, and reset.

## Command List

Replace `<prefix>` with your configured `PREFIX` from `.env` (for example, `.`).

| Command | Access | What it does |
| --- | --- | --- |
| `<prefix>claim` | Everyone | Claims the active egg in the configured channel. |
| `<prefix>lb` | Everyone | Shows the egg leaderboard (top 10, plus your rank highlight when present). |
| `<prefix>prizes` | Everyone | Shows the event prize embed. |
| `<prefix>spawn` | Bot manager | Manually spawns a new egg. |
| `<prefix>rate [0-100]` | Bot manager | Shows or sets base spawn rate percent. |
| `<prefix>edit <user> add <n>` | Bot manager | Adds eggs to a user score. |
| `<prefix>edit <user> minus <n>` | Bot manager | Removes eggs from a user score. |
| `<prefix>reset` | Bot manager | Starts a reset confirmation flow. |
| `<prefix>reset confirm` | Bot manager | Confirms reset within 30 seconds and truncates egg data. |

Bot manager means either:
- a user ID listed in `BOT_OWNER_IDS`, or
- a member with Discord `Administrator` permission.

## Reward Rules

- Normal egg claim reward: random `1-10` eggs.
- Golden egg claim reward: random `11-20` eggs.
- Streak bonus: `+floor(streakCount / CLAIM_STREAK_TIER_SIZE)`.
- Default streak tier size: `5`.
- Claim lock: duplicate claims are throttled for `10` seconds per active egg to avoid race spam.

## Spawn Rules

- Base spawn rate starts at `3%` (`client.egg.rate = 3`).
- Spawn checks happen from activity in the configured `CHANNEL`.
- There is a spawn cooldown of `10` minutes between spawn attempts.
- Dynamic spawn rate can scale up/down based on message activity:
  - Defaults: 300-second window, target 30 messages, multiplier clamped to `0.5-2`.
  - Effective rate is clamped to `0-100`.
- Golden egg roll chance default is `0.03` (3%).

## Quick Start

### 1) Install prerequisites

- Node.js (LTS recommended)
- npm

### 2) Clone and install

```bash
git clone https://github.com/MiraBellierr/bunny.git
cd bunny
npm i
```

### 3) Configure environment

Create a `.env` file (or copy `.env.example`) and fill required values:

```env
TOKEN=your-bot-token
PREFIX=.
CHANNEL=channel-id-to-send-easter-egg

# Optional manager IDs (comma/space separated)
BOT_OWNER_IDS=123456789012345678,987654321098765432

# Optional tuning
GOLDEN_EGG_CHANCE=0.03
CLAIM_STREAK_TIER_SIZE=5
DYNAMIC_SPAWN_RATE=true
DYNAMIC_RATE_WINDOW_SECONDS=300
DYNAMIC_RATE_TARGET_MESSAGES=30
DYNAMIC_RATE_MIN_MULTIPLIER=0.5
DYNAMIC_RATE_MAX_MULTIPLIER=2
```

### 4) Run

```bash
node .
```

If Bunny boots correctly, it logs in and starts watching messages for egg spawn checks.

## Environment Reference

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `TOKEN` | Yes | None | Discord bot token. |
| `PREFIX` | Yes | None | Command prefix, such as `.` |
| `CHANNEL` | Yes | None | Channel ID where eggs spawn/claim logic is active. |
| `BOT_OWNER_IDS` | No | Empty | Comma/space-separated user IDs with manager access. |
| `GOLDEN_EGG_CHANCE` | No | `0.03` | Float from `0` to `1`. Values are clamped. |
| `CLAIM_STREAK_TIER_SIZE` | No | `5` | Claims required per streak bonus tier. Minimum is `1`. |
| `DYNAMIC_SPAWN_RATE` | No | `true` | Set `false` to disable activity-based scaling. |
| `DYNAMIC_RATE_WINDOW_SECONDS` | No | `300` | Activity sampling window length. |
| `DYNAMIC_RATE_TARGET_MESSAGES` | No | `30` | Activity target used for multiplier calculation. |
| `DYNAMIC_RATE_MIN_MULTIPLIER` | No | `0.5` | Lower multiplier clamp. |
| `DYNAMIC_RATE_MAX_MULTIPLIER` | No | `2` | Upper multiplier clamp. |

## Dev Commands

```bash
npm test
npm run lint
npm run format:check
```

## Operational Notes

- Required env vars are validated at boot. Missing `TOKEN`, `PREFIX`, or `CHANNEL` exits the process with a clear error.
- The bot needs permission to send messages in relevant channels.
- For command replies, the bot also needs `Read Message History`.
- Runtime state persistence stores:
  - active egg message IDs,
  - active golden/drop state,
  - current claim streak holder + count.

## Troubleshooting

### "Nothing happens when users type commands"

- Verify `PREFIX` is correct.
- Verify the bot can read/send in that channel.
- Verify the command is sent in a guild text channel (not DM).

### "Eggs never spawn"

- Confirm `CHANNEL` is the channel where members are chatting.
- Check base rate with `<prefix>rate`.
- If activity is extremely high, dynamic scaling may reduce effective spawn chance.

### "Reset did not run"

- Use the two-step flow:
  - `<prefix>reset`
  - then `<prefix>reset confirm` within 30 seconds, from the same requester.

## Versioning

This project uses Semantic Versioning: `MAJOR.MINOR.PATCH`.

Release flow:

```bash
npm version <major|minor|patch> --no-git-tag-version
git add package.json package-lock.json CHANGELOG.md README.md
git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push
git push --tags
```

## License

Apache-2.0. See `LICENSE`.
