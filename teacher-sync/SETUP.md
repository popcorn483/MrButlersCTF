# Live class progress — setup (about 5 minutes, once)

Once this is done, every pupil's progress is sent automatically to a Google Sheet that you own, and the **Teacher** tab on the site shows the whole class live — no progress files to collect.

## 1. Make the Sheet and add the script
1. Go to [sheets.new](https://sheets.new) (signed in to the Google account you want to own the data). Name it e.g. *MrButlersCTF Live Progress*.
2. **Extensions → Apps Script**.
3. Delete what's in `Code.gs` and paste in everything from [`Code.gs`](Code.gs) in this folder.
4. On the `TEACHER_KEY` line, change `change-me-to-something-secret` to a password of your own. **Only change it in Apps Script — never commit your real key to GitHub** (this repo is public).
5. Press **Save** (💾).

## 2. Deploy it as a web app
1. **Deploy → New deployment**. Click the ⚙ next to *Select type* → **Web app**.
2. *Execute as*: **Me**. *Who has access*: **Anyone**.
3. **Deploy**, then **Authorize access** and allow it (choose your account; if Google warns the app is unverified, click *Advanced → Go to … (unsafe)* — it's your own script).
4. Copy the **Web app URL** (it ends in `/exec`).

## 3. Tell the site about it
Put the URL in `assets/js/config.js`:

```js
window.CTF_CONFIG = {
  syncUrl: 'https://script.google.com/macros/s/XXXXXXXX/exec'
};
```

Commit, wait a minute for GitHub Pages, and you're live.

## Using it
- Open the site → **Teacher** tab → **▶ Start live view** → enter your teacher key (remembered on that computer).
- The table refreshes every 20 seconds. 🟢 = the pupil did something in the last 5 minutes.
- Pupils see a 📡 note on **My progress** confirming it's being sent. Ask them to set their name (click *Set your name* at the top).
- **Clear live data** empties the Sheet — use it before a new group. Pupils' own progress is untouched and re-sends when they next solve.
- The Sheet itself is readable too (name, score, flags, last update), but the Teacher tab is better: it checks each solve's proof code, so anything tampered with shows as *edited* / *unverified*.

## Notes
- Pupils without internet (or if Google is ever blocked) just keep working; it re-sends when it can. Progress files and resume codes still work as before.
- If you edit the script later, use **Deploy → Manage deployments → ✏ → Version: New version** so the URL stays the same.
- What's sent: the pupil's chosen name, a random device ID, and their solves/hints/tutorial use — the same data as the progress file.
