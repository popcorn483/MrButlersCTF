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

## 5. Give the script its permissions (once, after each update that adds a feature)
In Apps Script, pick **authorise** from the function drop-down at the top, press **Run**, and allow everything Google asks for (your Sheet, sending you email, connecting to an external service — that is your own CTF site). The log should say “All set: the script can read … challenges”. Then deploy a **New version** as in step 4.

## Using it
- On the homepage press **👩‍🏫 Teacher access** and enter the Teacher Area password. That PC becomes a teacher screen: the Teacher tab appears (pupils never see it), live view starts by itself and the answer book opens without asking again. The live-view key is stored inside the encrypted answer book, so staff only need one password. (You can still type the key by hand with the **Teacher key** button.)
- **Forgotten the password?** Press **Email it to me** on the Teacher access box (or on the Teacher Area page). The Google script emails the password to `RECOVERY_EMAIL` in the script — the Google account that owns the script if that's left empty — and never to anyone else. At most one email every 10 minutes. The first time after updating the script, Google asks you to allow it to send email as you.
- The Teacher access password and the live-view key (`TEACHER_KEY`) are the **same**, so the email always gives you the one password you need. If you change it, change `TEACHER_KEY` and ask Claude to re-lock the answer book with the new password.
- **Any number of PCs** can be teacher screens at once — your desk PC, the projector, a laptop walking round the room. Enter the key on each; they all see the same live data, and deleting or clearing on one shows on the others within 20 seconds. Teacher PCs are never counted as pupils.
- Signed in on a pupil's PC? Press **Sign out of this PC** afterwards so it's tracked as a pupil again. (On C2k the key may be forgotten when you log off — just enter it again.)
- The table refreshes every 20 seconds. 🟢 = the pupil did something in the last 5 minutes.
- **New pupils need your approval** (as in the revision app). After signing up they see “Waiting for approval” and can’t use the site. You get an email for each new sign-up, and the Teacher tab shows **N waiting for approval** with **Approve**, **Decline** and **Approve all**. They’re let in within 20 seconds of approving. Requests are kept on the *Access* tab of the Sheet; pupils who signed up before approvals were switched on count as approved. Set `REQUIRE_APPROVAL = false` to let anyone in, or `EMAIL_SIGNINS = false` to stop the emails. Not getting emails? Press **✉ Send test email** under the approval list: it shows exactly where emails go, or why they fail. Emails go to `RECOVERY_EMAIL`, or to the Google account that owns the script if that is blank.
- **Pupils must sign in** before using the site: first name and surname, form class and a 4-digit PIN (the same system as the Digital Technology revision site). The same details on another computer bring their progress with them. PINs are stored only as salted hashes on the *Pupils* tab; five wrong tries locks that pupil for 15 minutes. Forgotten PIN? Click the pupil → **🔑 Reset PIN**, and whatever they type next becomes their new PIN. Teacher PCs skip it ("Teacher? Sign in here").
- Filter the leaderboard by **class** with the drop-down above it.
- **Click any pupil** in the leaderboard to see every challenge they've solved, attempted, used hints or tutorials on, or revealed. **🗑 Delete pupil** removes them (e.g. test accounts); their device is listed on the *Removed* tab of the Sheet and ignored from then on — delete a row there to let it back in.
- **Merge a second login** (a pupil signed in again with a misspelt name or the wrong class): click the pupil you want to keep → **🔗 Merge a second login** → pick the other login → **Merge**. Everything moves across and stays verified; signing in with either name opens the kept pupil, and the other computer switches over by itself within a few minutes. Merges are listed on the *Merged logins* tab.
- Progress from a pupil's different computers is now combined on the sheet, so a solve on one PC is never wiped out by another.
- **Mark a flag completed** (e.g. a pupil showed you their answer on paper): click the pupil → click the challenge → **✅ Mark completed**. They get the full points, it counts as verified, and their own computer picks it up within a few minutes with a message. **Undo** takes it back. Marks are kept on the *Marked complete* tab of the Sheet.
- **Mark several at once:** in a pupil’s breakdown press **☑ Select challenges to mark completed**, tick the squares (or **Tick all attempted**), optionally open **Also mark for other pupils** (e.g. **Tick everyone in 11B**), then **✅ Mark completed**. **Undo marks** reverses the same selection.
- **Pupils’ leaderboard** (🏆 Leaderboard tab): names show as first name + surname initial, with class. The script checks every solve’s proof itself (it reads the challenge list from `SITE_URL`), so hand-edited progress never counts. Set `BOARD_PUBLIC = false` in the script to hide it. The first time after updating, Google asks permission to “connect to an external service” — that’s the script reading the challenge list from your own site.
- **Clear live data** empties the Sheet — use it before a new group. Pupils' own progress is untouched and re-sends when they next solve.
- The Sheet itself is readable too (name, score, flags, last update), but the Teacher tab is better: it checks each solve's proof code, so anything tampered with shows as *edited* / *unverified*.

## Notes
- Pupils without internet (or if Google is ever blocked) just keep working; it re-sends when it can. Progress files and resume codes still work as before.
- If you edit the script later, use **Deploy → Manage deployments → ✏ → Version: New version** so the URL stays the same.
- What's sent: the pupil's chosen name, a random device ID, and their solves/hints/tutorial use — the same data as the progress file.
