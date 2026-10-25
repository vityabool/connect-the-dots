# Screenshots

Taken from a local copy of the app with a **sample game** ("Prague offsite": 10 made-up people, 10 topics, 26+ connections,
nobody left alone). Real browser, real API, nothing mocked. The people and the email address on screen are invented.

| File | Shows |
|------|-------|
| `mobile-landing.png`, `landing.png`, `how-to-play.png` | The public pages on a phone and on a desktop |
| `mobile-join.png`, `mobile-pick-name.png`, `mobile-play.png`, `mobile-add-connection.png`, `mobile-my-connections.png` | A player on a phone: enter the code, pick a name, add a connection, see my connections |
| `facilitator-games.png`, `facilitator-game.png`, `facilitator-topics.png`, `facilitator-timer.png`, `facilitator-connections.png` | The facilitator's pages: games, one game (code, people), topics, timer settings, connections |
| `timer-screen.png` | The Timer screen for the projector: countdown, short link, game code, QR code, live graph |
| `results-network.png` to `results-summary.png` | The nine results views: network, top topics, super-connectors, unexpected links, groups, topic spotlight, who met whom, replay, summary |

## Taking them again (after a UI change)

```bash
# 1. local services: Table Storage emulator, its tables, the API
node_modules/.bin/azurite --silent --skipApiVersionCheck --location .azurite --tableHost 127.0.0.1 &
node -e "const {TableClient}=require('@azure/data-tables');(async()=>{for(const n of ['Games','GameCodes','OwnerGames','Participants','Topics','Connections','RateLimits'])await TableClient.fromConnectionString('UseDevelopmentStorage=true',n,{allowInsecureConnection:true}).createTable()})()"
cp api/local.settings.json.example api/local.settings.json
npm run build -w api && (cd api && ../node_modules/.bin/func start --port 7072) &

# 2. build the web app and serve it with a dev sign-in
npm run build -w web
CTD_DEV_ADMIN=1 CTD_DEV_ADMIN_NAME=jana@example.com node scripts/serve-dist.mjs --port 4173 &

# 3. a fresh sample game (prints the game id and code), then the screenshots
node scripts/sample-game.mjs --minutes 30
npm install --no-save puppeteer-core
node scripts/take-screenshots.mjs --code <code> --game <game id>
```

Use a fresh sample game for every run (the run adds one connection from the phone). Never run these against production: the
sample script and the dev sign-in only work against a local API.

## The landing page carousel

The pictures in the carousel on the landing page are composed from these screenshots (browser windows and phones on a dark
background, cropped to 16:10) by `scripts/make-landing-slides.mjs`, which writes `web/public/screens/*.webp`. After you take new
screenshots, run `node scripts/make-landing-slides.mjs` and commit the result. The slide titles, captions and picture
descriptions are in `web/src/site/Landing.tsx` (`SLIDES`).
