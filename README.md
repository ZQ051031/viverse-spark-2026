# Spark Drift

[Play Spark Drift](https://zq051031.github.io/viverse-spark-2026/) · [Recording guide](DEMO_SCRIPT.md)

Pilot the last spark through three neon floating-island routes: **Lumen Shoals**, **Amethyst Run**, and **Solstice Rift**. Recover light shards, weave around red hazards, and cross the charged portals. A run takes about a minute if you keep moving. The Three.js game runs on a static page with WebGL 2. It makes no external requests, needs no login, and uses synthesized Web Audio and original procedural art. The only persistent game data is your best score, stored locally in your browser.

## How to fly

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | ← / → or A / D | Hold ← / → |
| Boost | ↑ or W | Hold ↑ |
| Reverse to recover a missed shard | ↓ or S | Hold ↓ |
| Pause or resume | Esc or P | Pause / Resume |
| Toggle sound | M | Sound on / off |

You cruise automatically when no throttle is held. **Win** by collecting the required shards and steering into the center ring of each sector before its time expires. **Lose** if a timer reaches zero or you lose all three lives. Lives carry across sectors. The portal turns mint when charged; if you arrive early, hold reverse to go back for shards. Subsequent sectors ask for more shards and introduce moving hazards.

Shards score 100 points times your chain multiplier (up to ×5). A pickup within four seconds preserves the chain; hitting a hazard breaks it. Each portal also awards 15 points per rounded-up second remaining and 100 per life left. You can restart from pause or after the run ends. Reduced-motion preferences disable cosmetic movement and particle effects while keeping essential flight and hazard movement.

## Run locally, test, and deploy

Use Node.js 22 or newer for the development commands. To play locally, run `npm run serve` from the repository root and open [http://localhost:8080](http://localhost:8080). No installation or build is needed for this command. Or serve the same files with any static HTTP server; don't open `index.html` directly from the filesystem because browser ES modules require HTTP.

```sh
npm ci
npm test
npx playwright-core install chromium
npm run smoke
```

On Linux, add `--with-deps` to the Playwright install command if system dependencies are missing. Alternatively set `CHROMIUM_PATH` to an existing compatible Chromium/Chrome binary. The smoke check serves the project under a Pages-style path, checks asset loading and WebGL rendering, exercises held touch input, and plays through the three sectors, a timeout, and a restart. An optional `SHOTS_DIR` saves screenshots.

For GitHub Pages: a repository administrator must open **Settings → Pages** and choose **GitHub Actions** as the source. A push to `main` triggers [Test and deploy Pages](.github/workflows/pages.yml). The workflow runs unit and browser tests before packaging the static site, then deploys if Pages is enabled. If the run reports that Pages is disabled, enable it and manually run the workflow from **Actions**. The root `index.html` and its relative local assets need no build step or CDN. The vendored Three.js license is in [vendor/THREE-LICENSE](vendor/THREE-LICENSE).

## VIVERSE Spark 2026 — Games / solo

Sources: [official rules](https://www.viverse.com/events/hackathon/rules) and [contest page](https://www.viverse.com/events/hackathon).

- **Contest and dates:** VIVERSE Spark 2026 is HTC's global university hackathon. The rules open entries **November 9, 2026 at 7:00 a.m. PT** and close **December 4, 2026 at 11:59 p.m. PT**, equivalent to **December 5, 2026 at 15:59 China Standard Time (UTC+8)**. Judging is **December 7–18, 2026**; winners are announced **January 2027**. The organizer notes that dates can change.
- **Prizes:** **$27,000 total**: first **$5,000**, second **$2,500**, third **$1,500** per team and per category. Three categories × three places = nine winning teams.
- **Eligibility:** As of the start date, entrants must be legal residents of the United States, China, Taiwan, United Kingdom, Spain, Romania, Moldova, Germany, France, Malaysia, Singapore, or Republic of Ireland; be at least the age of majority in their place of residence; and attend a university. The rules explicitly include China residents and require them to read and agree to the **Processing and Cross-Border Transmission of Personal Sensitive Information Consent Form** in the rules. Entrants must receive prior approval from their university; see the rules for other exclusions.
- **Teams:** One to five members, all from the same university; a student may join only one team. One entry per team, in one category only. Spark Drift is a **one-person entry**.
- **Categories:** Games, Immersive Storytelling, and Social Experiences. **Games** entries must offer interactive gameplay for at least one player with clear objectives and winning/losing criteria. The contest page describes web games optimized across PCs and mobile devices.
- **Judging:** **50 points total**, up to 10 each for Scene Design, Interactivity and Technical Competency (shortened to “Technical Competency” on the landing page), Creativity, User Experience, and User Engagement.
- **World requirements:** Original work in English, suitable for all ages, with no unlicensed copyrighted, trademarked, patented, or previously published material (see the exact language in section 5 of the rules). Confirm any public-playtest or prior-publication interpretation with the organizer before entry if needed.
- **Engine:** Three.js is supported, along with WebGL, A-Frame, Babylon.js, Godot, PlayCanvas, React-Three-Fiber, and Unity.

### VIVERSE Create publishing (entrant only)

GitHub Pages hosts the browser version; it does **not** create a VIVERSE World or submit a contest entry. In [VIVERSE Create](https://create.viverse.com/), follow the [official Three.js publishing guide](https://docs.viverse.com/standalone-app-publishing/three.js-with-vite-or-getting-started-tutorial) on [docs.viverse.com](https://docs.viverse.com/). Use the packaged static site (the same files staged into `site/` in the Pages workflow, with `index.html` at the top level) as the production build folder. The guide describes signing in and running `viverse-cli publish <path>` for that folder. Open the resulting VIVERSE URL and verify rendering, keyboard/touch controls and audio before using it for the entry. VIVERSE publishing has not been performed or tested.

### Submission checklist (entrant completes later)

- [ ] Confirm eligibility, prior university approval, and any applicable China consent requirements.
- [ ] Follow the [contest page](https://www.viverse.com/events/hackathon) registration instructions yourself. The page says to create a VIVERSE account with your university email and complete team registration as the solo team leader. Keep the Team Code.
- [ ] Publish and test the VIVERSE World; keep its link handy.
- [ ] During the contest period, complete the entry form on the [contest page](https://www.viverse.com/events/hackathon) using:
  - **Team name:** `[Your team name]`
  - **University:** `[Your university]`
  - **World name:** Spark Drift
  - **Brief description:** Pilot a glowing spark through three neon island routes. Chain light shards, dodge hazards, and cross each charged portal before time or your three lives run out.
  - **Category:** Games
  - **Full legal names of team members:** `[Your full legal name]` (one member)
  - **University email:** `[Your university email address]`
- [ ] Review the form and submit it yourself before the deadline. No registration or entry has been sent.
