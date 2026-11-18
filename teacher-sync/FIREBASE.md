# Class data in Firebase (free Spark plan)

The site's class data — pupils, sign-ins, progress, approvals, teacher marks, test passwords and the answers — lives in the Firebase project **ergs-ctf** (Cloud Firestore, London `europe-west2`). It replaces the Google Sheet + Apps Script, and is much faster.

## How it fits together
- `assets/js/config.js` — the Firebase settings, and the switch `USE_FIREBASE`. Add `?fb=1` (or `?fb=0`) to the site's address to try the other one on a single computer.
- `assets/js/fbapi.js` — answers every request the site used to send to the Google script, using Firestore and Firebase sign-in. Nothing else in the site needed to change.
- `firebase/firestore.rules` — **the security**: who may read and write what. Paste it into Firebase console › Firestore › Rules › Publish whenever it changes.

## Sign-in
- **Pupils**: name + class + PIN, or username + PIN, exactly as before. Each pupil has a Firebase account behind the scenes (`<pupil id>x<n>@pupils.ergs-ctf.firebaseapp.com`); its password is their PIN. Firebase slows down repeated wrong PINs by itself.
- **Pupils moved from the Google Sheet keep their PIN**: the first time each signs in, the old Google script checks the PIN and their Firebase account is made. So keep the old Apps Script deployed (it also still emails you a forgotten Teacher password).
- **Teachers**: on a teacher screen a bar asks you to **Sign in with Google** once (jbutler483@gmail.com or jbutler803@c2ken.net). To let another member of staff in, add a document to the Firestore `staff` collection whose ID is their Google email.

## Moving the data (Teacher tab › ⋯ › ⇪ Copy data from the Google Sheet)
Copies every pupil, their progress, approvals, teacher marks, merged logins and test passwords. Safe to run again: anyone already moved keeps their account, and progress is combined, never replaced. The answers install themselves when a signed-in teacher screen opens the Teacher tab.

## Staying free
The Spark plan has no card and can't be charged. Daily allowances: 50,000 reads, 20,000 writes, 20,000 deletes, 1 GB stored. The site is built to stay well inside them:
- The Teacher tab and projector use live listeners: refreshing every 20 seconds costs nothing; only changes are read.
- A flag check is about 2 reads. Saving progress is 1 read + 1 write.
- Reinstalling the answers (only when the challenges change) is about 2,000 writes.
- A class of 30 for an hour uses roughly 3,000–5,000 reads and 1,000 writes.
If an allowance is ever used up, Firebase stops answering until midnight (Pacific time) — it never bills you.

## What the free plan can't do
- **Emails on new sign-ups** (that needs server code). New sign-ups still appear on the Teacher tab straight away.
- The pupils' leaderboard is worked out by a teacher screen (it checks every solve), so it updates while a teacher screen has the Teacher tab open.
