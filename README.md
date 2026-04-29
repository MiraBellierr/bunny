# Bunny

An easter egg Discord bot. An egg will appear randomly in the desire channel when a member is active in the server.
Current version: `Bunny v1.1.1`

- To claim an egg. do `.claim`
- To see the leaderboard. do `.lb`

## Versioning

- This project uses Semantic Versioning: `MAJOR.MINOR.PATCH`
- Track release notes in `CHANGELOG.md`
- Create a new version locally with:

```
npm version <major|minor|patch> --no-git-tag-version
```

- Then commit and tag the release:

```
git add package.json package-lock.json CHANGELOG.md README.md
git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push && git push --tags
```

## Run a bot locally

Make sure nodejs and npm is installed in your machine to be able to run this bot.

1. Clone the repository

```
git clone https://github.com/MiraBellierr/bunny.git && cd bunny
```

2. Install all dependencies

```
npm i
```

3. Create `.env` file. Fill and edit the following:

```
TOKEN=your-bot-token
PREFIX=bot-prefix
CHANNEL=channel-id-to-send-easter-egg
# Optional: chance between 0 and 1 (default: 0.03 for 3%)
GOLDEN_EGG_CHANCE=0.03
# Optional: claims needed per streak tier (default: 5, +1 bonus per tier)
CLAIM_STREAK_TIER_SIZE=5
# Optional: enable/disable dynamic spawn rate (default: true)
DYNAMIC_SPAWN_RATE=true
# Optional: message window in seconds for activity sampling (default: 300)
DYNAMIC_RATE_WINDOW_SECONDS=300
# Optional: target messages per window before rate scales down (default: 30)
DYNAMIC_RATE_TARGET_MESSAGES=30
# Optional: clamp for dynamic rate multiplier (default: 0.5 to 2)
DYNAMIC_RATE_MIN_MULTIPLIER=0.5
DYNAMIC_RATE_MAX_MULTIPLIER=2
```

4. Run the bot.

```
node .
```
