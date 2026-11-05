# Mr Butler's CTF

Practice capture-the-flag challenges for pupils getting ready for a ZeroDays / Cyber-Schools style competition. Runs entirely in the browser with no external dependencies, so it works on the C2k network.

These are original practice challenges, not the real competition tasks.

## Features
- Challenge board by category, with seven difficulty tiers (Beginner → Unreal)
- **🏆 Competition Grade** — 100 Elite challenges (500–600 pts) modelled on real competition tasks; no hints or walkthroughs; unlocks after 5 Hard/Expert solves
- **🌌 Unreal** — 52 multi-stage challenges (1,000 pts) with decoys and no help at all; unlocks after 3 Competition Grade solves
- 1,000 challenges in total across 13 categories and 7 levels, every generated one solved again automatically from its own published puzzle
- **Practice tests** — three timed mock papers in the Test area: Paper 1 Foundations (Beginner & Intermediate, 45 min), Paper 2 Challenger (Intermediate & Hard, 60 min) and Paper 3 Final Boss (Expert, Competition Grade & Unreal, 90 min). No hints; flags checked by the script; live results on the Teacher tab, grouped by paper
- **View HTML** button on every challenge (Inspect Element is blocked on C2k)
- Practice-only hints, plus a **Show answer & solution** button (revealed challenges score 0 points)
- Toolkit: the full **CyberChef** v11.5 (GCHQ, Apache-2.0, served from `assets/cyberchef` with analytics removed), plus a guided CyberChef-style decoder, frequency analysis, hashes, hex viewer, image inspector, JS scratchpad, ASCII table
- Progress saves in the browser; pupils download a progress file at the end of each lesson and reload it next time
- Teacher tab: load every pupil's progress file to build a class leaderboard and export it as CSV
- **Easter eggs** — 41 of them, for curious pupils (typed words, a pretend terminal, payloads typed into flag boxes, recon pages, seasonal surprises). Just for fun: no points, kept on each device. Spoilers for teachers: `assets/js/eggs.js`.
- **Live class view** (optional): pupils' progress is sent automatically to a Google Sheet you own, and the Teacher tab updates itself every 20 seconds — see [`teacher-sync/SETUP.md`](teacher-sync/SETUP.md)

## Publish with GitHub Pages
1. Open the repository on GitHub and go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
3. Choose branch `main` and folder `/ (root)`, then press **Save**.
4. After a minute or two the site is live at `https://popcorn483.github.io/MrButlersCTF/`.
