# Mr Butler's CTF

Practice capture-the-flag challenges for pupils getting ready for a ZeroDays / Cyber-Schools style competition. Runs entirely in the browser with no external dependencies, so it works on the C2k network.

These are original practice challenges, not the real competition tasks.

## Features
- Challenge board by category, with five difficulty tiers (Beginner → Expert)
- **View HTML** button on every challenge (Inspect Element is blocked on C2k)
- Practice-only hints, plus a **Show answer & solution** button (revealed challenges score 0 points)
- Toolkit: CyberChef-style decoder, frequency analysis, hashes, hex viewer, image inspector, JS scratchpad, ASCII table
- Progress saves in the browser; pupils download a progress file at the end of each lesson and reload it next time
- Teacher tab: load every pupil's progress file to build a class leaderboard and export it as CSV

## Publish with GitHub Pages
1. Open the repository on GitHub and go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
3. Choose branch `main` and folder `/ (root)`, then press **Save**.
4. After a minute or two the site is live at `https://popcorn483.github.io/MrButlersCTF/`.
