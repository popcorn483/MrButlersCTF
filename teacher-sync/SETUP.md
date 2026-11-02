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

## 4. Updating the script (when Code.gs changes)
1. In Apps Script, replace `Code.gs` with the new version from this folder — **keep your own `TEACHER_KEY` line**.
2. Save, then **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**. The URL stays the same, so nothing on the site needs changing.

## Using it
- On the homepage press **👩‍🏫 Teacher access** and enter the Teacher Area password. That PC becomes a teacher screen: the Teacher tab appears (pupils never see it), live view starts by itself and the answer book opens without asking again. The live-view key is stored inside the encrypted answer book, so staff only need one password. (You can still type the key by hand with the **Teacher key** button.)
- **Any number of PCs** can be teacher screens at once — your desk PC, the projector, a laptop walking round the room. Enter the key on each; they all see the same live data, and deleting or clearing on one shows on the others within 20 seconds. Teacher PCs are never counted as pupils.
- Signed in on a pupil's PC? Press **Sign out of this PC** afterwards so it's tracked as a pupil again. (On C2k the key may be forgotten when you log off — just enter it again.)
- The table refreshes every 20 seconds. 🟢 = the pupil did something in the last 5 minutes.
- **Pupils must sign in** before using the site: first name and surname, form class and a 4-digit PIN (the same system as the Digital Technology revision site). The same details on another computer bring their progress with them. PINs are stored only as salted hashes on the *Pupils* tab; five wrong tries locks that pupil for 15 minutes. Forgotten PIN? Click the pupil → **🔑 Reset PIN**, and whatever they type next becomes their new PIN. Teacher PCs skip it ("Teacher? Sign in here").
- Filter the leaderboard by **class** with the drop-down above it.
- **Click any pupil** in the leaderboard to see every challenge they've solved, attempted, used hints or tutorials on, or revealed. **🗑 Delete pupil** removes them (e.g. test accounts); their device is listed on the *Removed* tab of the Sheet and ignored from then on — delete a row there to let it back in.
- **Clear live data** empties the Sheet — use it before a new group. Pupils' own progress is untouched and re-sends when they next solve.
- The Sheet itself is readable too (name, score, flags, last update), but the Teacher tab is better: it checks each solve's proof code, so anything tampered with shows as *edited* / *unverified*.

## Notes
- Pupils without internet (or if Google is ever blocked) just keep working; it re-sends when it can. Progress files and resume codes still work as before.
- If you edit the script later, use **Deploy → Manage deployments → ✏ → Version: New version** so the URL stays the same.
- What's sent: the pupil's chosen name, a random device ID, and their solves/hints/tutorial use — the same data as the progress file.
