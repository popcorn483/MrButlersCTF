/* Getting Started page + category guides */
window.CTF_START_HTML = function (cats) {
  var guides = {
    warmup: ['Read the whole description: flags sometimes sit right there.', 'Click <b>View HTML</b>: comments and hidden text are invisible on screen.', 'Learn to spot encodings: Base64 ends in <code>=</code>, hex is only 0-9 and a-f, binary is 0s and 1s.'],
    web: ['Websites hide things in source code, comments, JavaScript and files like <code>robots.txt</code>.', 'Read any JavaScript that checks a password: if the check happens in the browser, the answer is in the code.', 'At the real event press <kbd>F12</kbd> or <kbd>Ctrl</kbd>+<kbd>U</kbd>. Here, use View HTML and the file viewer.'],
    crypto: ['Work out what it is before decoding: letters only? numbers? <code>=</code> at the end?', 'Shifted letters = Caesar/ROT. Try all 25 shifts with "Caesar brute force".', 'Layered challenges: decode one layer, look at the output, decide the next step.'],
    forensics: ['File extensions lie. The first few bytes (the "magic number") tell you the real type.', 'Open files in the Hex viewer and read the Strings list.', 'Logs: look for patterns: repeated IPs, failed logins, odd times.'],
    stego: ['Steganography hides data inside images or text.', 'Check metadata and strings first, then colour channels and bit planes.', 'Tiny differences in colour are invisible to eyes but not to tools.'],
    osint: ['OSINT = Open Source Intelligence: finding facts from public information.', 'Usernames are often reused across sites.', 'Photos can leak locations; bios leak birthdays and pet names.'],
    reversing: ['Reverse engineering = work backwards from the code to the input it wants.', 'Read the code line by line and write down what each step does.', 'Undo the steps in reverse order.'],
    networking: ['Know common ports: 21 FTP, 22 SSH, 23 Telnet, 80 HTTP, 443 HTTPS, 53 DNS.', 'Old protocols like FTP, Telnet and HTTP send passwords in plain text.', 'Counting and sorting log lines answers most "who attacked?" questions.'],
    programming: ['Some answers are too tedious to do by hand: write a short program.', 'Write it in C# in Visual Studio (the language you use in class), or use the JS scratchpad here for a quick check.', 'Test your code on a small example you can work out by hand first.']
  };
  return '' +
  '<div class="callout" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><span>New here? Take the quick welcome tour again any time.</span><button class="btn small" data-action="welcome">▶ Replay welcome tour</button></div>' +
  '<h1>Getting started</h1>' +
  '<p>A <b>Capture The Flag</b> (CTF) is a cyber security competition. Each challenge hides a secret piece of text called a <b>flag</b>. Find it, type it in, score points.</p>' +
  '<div class="callout good"><b>Flag format on this site:</b> <code>flag{something_like_this}</code>. Flags are not case-sensitive here. The real competition will tell you its own flag format on the day.</div>' +
  '<h2>How a jeopardy CTF works</h2><ul>' +
  '<li>Challenges are grouped into categories (Web, Crypto, Forensics…). Harder challenges are worth more points.</li>' +
  '<li>You can do them in any order. Stuck for 15 minutes? Move on and come back.</li>' +
  '<li>Teams split up categories, then share what they learn.</li>' +
  '<li>Write notes as you go: what you tried, what you found. It saves time later.</li></ul>' +
  '<div class="callout warn"><b>Hints are practice only.</b> At the real event there are no hint buttons, so try for a while before you click one.</div>' +
  '<h2>Your tools</h2><ul>' +
  '<li><b>View HTML</b> on every challenge: shows the raw code, including hidden comments.</li>' +
  '<li><b>Decoder</b> (Toolkit): chain operations like Base64 → ROT13, just like CyberChef.</li>' +
  '<li><b>Hex viewer</b>: see the real bytes of a file and the readable strings inside.</li>' +
  '<li><b>JS scratchpad</b>: run small bits of code for programming challenges.</li></ul>' +
  '<h2>Saving your progress</h2><p>Progress saves in this browser, but school PCs can wipe it when you log off. Go to <a href="#" data-goto="progress">My progress</a> and download your progress file at the end of each session.</p>' +
  '<h2>How to approach each category</h2><div class="guide-grid">' +
  cats.map(function (c) {
    var g = guides[c.id] || [];
    return '<div class="guide-card" id="guide-' + c.id + '"><h3>' + c.icon + ' ' + c.name + '</h3><ul>' + g.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
  }).join('') + '</div>' +
  '<h2>Play fair</h2><p>Only attack systems you are given permission to test, like these challenges. Hacking real websites, school systems or other people\'s accounts is illegal under the Computer Misuse Act 1990.</p>';
};


/* Walkthrough page: the thought process and how to read a challenge */
window.CTF_WALK_HTML = function () {
  return `
  <h1>Walkthrough: how to think your way to a flag</h1>
  <p>Most beginners get stuck not because a challenge is too hard, but because they are not sure what to try first. This page gives you a repeatable way of thinking that works on almost any task. Read it once before you start, and come back to it whenever you feel stuck.</p>
  <div class="callout good"><b>The one goal:</b> every challenge hides a flag shaped like <code>flag{...}</code>. You are always hunting for that. If what you are looking at is not a flag yet, you have more work to do.</div>

  <h2>The big secret: a challenge tells you how to solve it</h2>
  <p>Here is the thing almost nobody explains to beginners: <b>CTF challenges are not trying to trick you.</b> Whoever wrote the challenge wants a fair fight, so they leave a trail of clues that point at the intended technique. Once you learn to <i>read</i> those clues, a task stops feeling like a locked door and starts feeling like a set of instructions written in code. Getting good at CTFs is mostly getting good at noticing the signposts.</p>
  <p>There are <b>five places</b> a clue almost always hides. Train your eye to check each one before you touch a tool.</p>

  <div class="guide-grid">
    <div class="guide-card"><h3>1 · The title</h3><p>The title is the single biggest hint, and people skip it. A title is chosen on purpose.</p>
      <div class="clue-why"><b class="sig">Why:</b> a title like <span class="signpost">Base what?</span> is naming the encoding. <span class="signpost">Shifty business</span> is telling you it is a Caesar shift. <span class="signpost">Hidden in plain sight</span> is steganography. The pun usually <i>is</i> the method.</div></div>
    <div class="guide-card"><h3>2 · The flavour text</h3><p>The sentence or two describing the task. Read it twice and underline every technical-sounding word.</p>
      <div class="clue-why"><b class="sig">Why:</b> "we <b>encoded</b> it a few times", "the password is <b>checked by the browser</b>", "this file <b>won't open</b>" — each verb is literally describing the solution. Authors describe what they did; you just reverse it.</div></div>
    <div class="guide-card"><h3>3 · The category</h3><p>Crypto, Web, Forensics, OSINT… the category narrows the whole universe of possible techniques before you start.</p>
      <div class="clue-why"><b class="sig">Why:</b> the same string of hex means "decode me" under Cryptography but "check the file type" under Forensics. The category tells you which lens to look through.</div></div>
    <div class="guide-card"><h3>4 · The points &amp; difficulty</h3><p>Low points means one or two steps. High points means layers or a trick.</p>
      <div class="clue-why"><b class="sig">Why:</b> if a 25-point Beginner task looks complicated, you are over-thinking it — the answer is simple. If a 200-point task decodes in one step, you are not finished; look for the next layer.</div></div>
    <div class="guide-card"><h3>5 · The file you're given</h3><p>An image, a <code>.txt</code>, a capture, a snippet of code. The <i>kind</i> of file hints at the whole approach.</p>
      <div class="clue-why"><b class="sig">Why:</b> a picture invites the Image inspector; a file that "won't open" invites the Hex viewer; code with input and output invites you to run it backwards. The attachment is a signpost too.</div></div>
    <div class="guide-card"><h3>The habit</h3><p>Before every challenge, run the five past yourself out loud: <b>title, text, category, points, file.</b></p>
      <div class="clue-why"><b class="sig">Payoff:</b> nine times out of ten you will have already named the technique before you open a single tool. That is what strong solvers are doing in their heads.</div></div>
  </div>
  <p class="muted small">The worked examples further down this page each end with a <b>“Why the wording pointed here”</b> box, so you can see exactly which words gave the game away.</p>

  <h2>The method: five steps for any challenge</h2>
  <div class="callout"><b>Read &rarr; Recognise &rarr; Try the obvious &rarr; Use a tool &rarr; Check the format.</b> Learn this loop and you will rarely be completely stuck.</div>
  <ol class="walk-steps">
    <li><b>Read it twice.</b> Read the whole challenge slowly. The title is a clue, the words in <b>bold</b> are clues, and sometimes the flag is sitting in the text already. Note anything that looks like a technical word (Base64, binary, cipher, cookie, metadata).</li>
    <li><b>Recognise what you are looking at.</b> Before touching a tool, ask: <i>what kind of data is this?</i> Only letters and numbers with an <code>=</code> on the end? Only 0s and 1s? Shifted-looking words? A picture? A log file? The table below helps you name it.</li>
    <li><b>Try the obvious first.</b> Is the flag in a comment (View HTML)? Is the text just backwards or shifted a little? Many early flags take one step. Do not over-think it.</li>
    <li><b>Use the right tool.</b> Once you know what it is, pick the matching tool from the Toolkit: the Decoder for encodings and ciphers, the Hex viewer for files, the Image inspector for pictures, the Hashes tool for password hashes.</li>
    <li><b>Check the format and submit.</b> Your answer should read like words, not gibberish. Wrap it as <code>flag{...}</code> if it is not already, then submit. Close but gibberish? You probably missed a layer, so go back a step.</li>
  </ol>

  <h2>"What am I looking at?" &mdash; a recognition guide</h2>
  <p>This is the most useful skill in a CTF: looking at a blob of data and naming it. Match the clue on the left to what to try on the right.</p>
  <div class="table-wrap"><table class="recognise">
    <thead><tr><th>If you see...</th><th>It is probably...</th><th>Try this</th></tr></thead>
    <tbody>
      <tr><td>Only <code>0</code> and <code>1</code>, in groups of 8</td><td>Binary</td><td>Decoder &rarr; From Binary</td></tr>
      <tr><td>Only <code>0-9</code> and <code>a-f</code></td><td>Hexadecimal</td><td>Decoder &rarr; From Hex</td></tr>
      <tr><td>Letters, numbers, <code>+ /</code>, ending in <code>=</code> or <code>==</code></td><td>Base64</td><td>Decoder &rarr; From Base64</td></tr>
      <tr><td>Words that look almost right but letters are shifted (e.g. <code>synt</code>)</td><td>Caesar / ROT cipher</td><td>Decoder &rarr; Caesar brute force</td></tr>
      <tr><td>Dots and dashes <code>.- -...</code></td><td>Morse code</td><td>Decoder &rarr; From Morse</td></tr>
      <tr><td>Numbers 1&ndash;26, separated by dashes</td><td>A1Z26 (A=1, B=2...)</td><td>Decoder &rarr; A1Z26 decode</td></tr>
      <tr><td>Groups of 2&ndash;3 digits like <code>102 108 97</code></td><td>ASCII codes</td><td>Decoder &rarr; From Decimal, or the ASCII table</td></tr>
      <tr><td>A long string of random hex that is not readable after From Hex</td><td>XOR or another cipher</td><td>From Hex, then XOR brute force</td></tr>
      <tr><td>A website, login box or page</td><td>Web challenge</td><td>View HTML; read comments, scripts and cookies</td></tr>
      <tr><td>A file: an image, a document, a <code>.txt</code> that will not open</td><td>Forensics</td><td>Hex viewer; check the magic bytes and the Strings list</td></tr>
      <tr><td>A picture that looks normal or oddly plain</td><td>Steganography</td><td>Image inspector; try the colour and lowest-bit views</td></tr>
      <tr><td>A 32-character hex string</td><td>An MD5 hash</td><td>Hashes tool; crack it with the wordlist</td></tr>
      <tr><td>A profile, username, photo or clue about a person/place</td><td>OSINT</td><td>Look for details that are public; think like a detective</td></tr>
      <tr><td>Code with numbers going in and a result coming out</td><td>Reverse engineering</td><td>Work backwards, undoing each step in reverse order</td></tr>
    </tbody>
  </table></div>
  <p class="muted small">Tip: when two things could be true (hex <i>and</i> only digits), just try one, look at the output, and decide the next step from what you get. Decoding is cheap: experiment.</p>

  <h2>A full worked example</h2>
  <p>Here is the whole thought process on a layered challenge, including a wrong turn, so you can see that getting it wrong once is normal.</p>
  <div class="worked">
    <p><b>The challenge says:</b> "This was encoded a few times. Peel the layers." and gives you:</p>
    <pre class="data">Njk2ZjY0NmE3YjczNjg2ODZmNWY3NzZiNjg1ZjZmNjQ2MjY4NzU3Njdk</pre>
    <p class="muted small">You can follow along for real: send this to the Decoder and add the steps as you read.</p>
    <ol class="walk-steps">
      <li><b>Recognise.</b> It is letters and numbers ending in <code>=</code>. That is the Base64 fingerprint. <i>Decision: start with From Base64.</i></li>
      <li><b>First tool.</b> Send it to the Decoder and add From Base64. The output is <code>696f646a7b7368686f5f776b685f6f64626875767d</code>. That is not a flag yet.</li>
      <li><b>Look again.</b> The new output is only <code>0-9</code> and <code>a-f</code>. That is hex. <i>Decision: add From Hex next.</i></li>
      <li><b>A wrong turn (this is fine).</b> Suppose instead you tried From Base64 again by mistake. You would get an error or gibberish. That is the signal to undo that step and look more carefully. Here, the digits-and-a-f pattern says hex, not Base64.</li>
      <li><b>Second tool.</b> Add From Hex. Now you get <code>iodj{shho_wkh_odbhuv}</code> &mdash; the shape <code>????{????_???_??????}</code> is clearly a flag, but the letters are shifted.</li>
      <li><b>Last layer.</b> Shifted letters? Add Caesar brute force and scan the 25 lines for the one that starts with <code>flag{</code>. The readable line is <code>flag{peel_the_layers}</code>.</li>
      <li><b>Format and submit.</b> It already looks like <code>flag{...}</code>, so submit it. Done.</li>
    </ol>
    <p class="muted">The pattern to notice: <b>after every step, look at the output and ask "what is this now?"</b> Each layer tells you the next move. You are never guessing blindly.</p>
    <div class="clue-why"><b class="sig">Why the wording pointed here:</b> the phrase <span class="signpost">encoded a few times</span> did two jobs. "Encoded" (not "encrypted") says this is reversible with decoders, no key-cracking needed. "A few times" warns you there are <b>several layers</b>, so you should expect the first decode to produce more encoded data, not the flag. The challenge told you the whole plan in four words.</div>
  </div>

  <h2>More worked examples, category by category</h2>
  <p>The same five-step loop works everywhere. Here is the thinking for four more kinds of task.</p>

  <div class="worked">
    <p><b>🌐 Web &mdash; "The login page says the password is checked by the browser."</b></p>
    <ol class="walk-steps">
      <li><b>Recognise.</b> It is a web challenge, and it mentions the browser doing the checking. That is the giveaway: if your computer checks the password, the answer must be on your computer.</li>
      <li><b>Open the code.</b> Click <b>View HTML</b> (Inspect Element is blocked, so this is your window into the page), or open the challenge's <code>.js</code> or <code>.html</code> file.</li>
      <li><b>Read the check.</b> Find the <code>if</code> that compares the password. The value it compares against, or the flag it shows on success, is sitting right there.</li>
      <li><b>Also worth a look:</b> HTML comments (<code>&lt;!-- --&gt;</code>), hidden form fields (<code>type="hidden"</code>), cookies and response headers. Flags love to hide in all of these.</li>
      <li><b>Submit</b> the flag you found. <i>Lesson: anything the browser can see, you can see.</i></li>
    </ol>
    <div class="clue-why"><b class="sig">Why the wording pointed here:</b> <span class="signpost">checked by the browser</span> is the entire solution in three words. If the <i>server</i> checked the password, you could never see the answer — it would live on a computer you don't control. The moment a challenge says your own browser does the checking, it is admitting the secret has been sent to your machine, which means <b>View HTML</b> can find it.</div>
  </div>

  <div class="worked">
    <p><b>🔎 Forensics &mdash; "Here is a file called notes.txt, but it will not open as text."</b></p>
    <ol class="walk-steps">
      <li><b>Recognise.</b> A file that will not open as its name suggests is a classic forensics trick. File names lie; the bytes do not.</li>
      <li><b>Open the Hex viewer.</b> Load the file into Toolkit &rarr; Hex viewer and look at the very first bytes (the <b>magic number</b>).</li>
      <li><b>Name the real type.</b> <code>89 50 4E 47</code> means PNG, <code>FF D8 FF</code> means JPEG, <code>50 4B</code> means a ZIP. So "notes.txt" is really a picture.</li>
      <li><b>Act on it.</b> Download it, rename it to <code>.png</code>, and open it: the flag is written inside the image. For plain files, skim the <b>Strings</b> list for <code>flag{</code> instead.</li>
      <li><b>Submit.</b> <i>Lesson: always check what a file really is, not what it is called.</i></li>
    </ol>
    <div class="clue-why"><b class="sig">Why the wording pointed here:</b> the clue is the <b>contradiction</b> — <span class="signpost">notes.txt</span> that <span class="signpost">will not open as text</span>. A real text file always opens as text. When the name and the behaviour disagree, the author is hinting that the name is a disguise. That contradiction is your cue to stop trusting the extension and read the magic bytes.</div>
  </div>

  <div class="worked">
    <p><b>🖼️ Steganography &mdash; "This photo looks completely normal."</b></p>
    <ol class="walk-steps">
      <li><b>Recognise.</b> A picture handed to you "that looks normal" almost always has something hidden in or on it.</li>
      <li><b>Check the easy places first.</b> Open it in the Hex viewer and read the Strings list &mdash; the flag may be in the image's <b>metadata</b> (a Comment field, for example).</li>
      <li><b>Then look at the pixels.</b> Open it in the Image inspector and try each view: single colour channels, "lowest bit", and "exaggerate tiny differences". Hidden text jumps out that your eyes could never see at normal brightness.</li>
      <li><b>Read and submit</b> the revealed flag. <i>Lesson: work from the outside in &mdash; metadata, then strings, then the pixels themselves.</i></li>
    </ol>
    <div class="clue-why"><b class="sig">Why the wording pointed here:</b> <span class="signpost">looks completely normal</span> is a steganography author gently winking at you. Why point out that a picture looks normal unless "normal to look at" and "normal underneath" are different things? The reassurance is the giveaway — it is telling you the change is there but too small for your eyes, which is exactly what the lowest-bit view is for.</div>
  </div>

  <div class="worked">
    <p><b>🕵️ OSINT &mdash; "Here is a public profile. What is the answer to their security question?"</b></p>
    <ol class="walk-steps">
      <li><b>Recognise.</b> OSINT means finding answers from information that is already public &mdash; no decoding, just careful reading.</li>
      <li><b>Find the question.</b> Note exactly what is being asked (a pet's name, a birthday, a first school).</li>
      <li><b>Hunt the clue.</b> Read the profile's bio and posts for anything that matches. People give away far more than they realise.</li>
      <li><b>Join the dots.</b> "Rodney is the best dog ever" answers "What is your pet's name?". That is how accounts get taken over in real life.</li>
      <li><b>Submit</b> the answer as the flag. <i>Lesson: think about what a photo or a post quietly reveals.</i></li>
    </ol>
    <div class="clue-why"><b class="sig">Why the wording pointed here:</b> there is <b>nothing to decode</b> — no odd characters, no file, just a <span class="signpost">public profile</span> and a question. That absence is itself the clue: when a task gives you a real person and a question but no puzzle-data, it is an OSINT task, and the answer is sitting in public waiting to be read, not computed.</div>
  </div>

  <div class="worked">
    <p><b>⚙️ Programming &mdash; "Here are 2,000 numbers. Add up only the ones in an even position."</b></p>
    <ol class="walk-steps">
      <li><b>Recognise.</b> A simple rule ("even positions", "add up") applied to far too much data to do by hand. That combination is the fingerprint of a programming task.</li>
      <li><b>Describe the loop in words.</b> "Go through the list; if the position is even, add the number to a running total." If you can say it as a sentence, you can write it as a <code>for</code> loop.</li>
      <li><b>Write a few lines of C#.</b> <code>int total = 0; for (int i = 0; i &lt; n.Length; i++) { if (i % 2 == 0) total += n[i]; }</code> then print <code>total</code>.</li>
      <li><b>Mind the edges.</b> Does "even position" mean index 0 or index 1? Try both and see which gives a sensible flag. Off-by-one is the most common slip.</li>
      <li><b>Wrap and submit</b> the result, usually as <code>flag{total}</code>. <i>Lesson: let the computer do the boring, careful work.</i></li>
    </ol>
    <div class="clue-why"><b class="sig">Why the wording pointed here:</b> the signpost is the <b>scale</b> — <span class="signpost">2,000 numbers</span>. A handful you would just add up. Thousands, with a rule attached, is the author saying "doing this by hand would take an hour and you'd make mistakes — write the loop." The size of the data is the instruction to code.</div>
  </div>

  <div class="worked">
    <p><b>🔢 Number bases &mdash; "01100110 01101100 01100001 01100111 ..."</b></p>
    <ol class="walk-steps">
      <li><b>Recognise.</b> Only <code>0</code> and <code>1</code>, grouped into blocks of <b>eight</b>. Eight bits is one character, so this is binary text.</li>
      <li><b>Decode.</b> Send it to the Decoder &rarr; From Binary. Each block of 8 becomes one letter.</li>
      <li><b>Read the result.</b> You will get readable text, often a flag straight away, or the next layer to work on.</li>
      <li><b>If the blocks are a different size</b> (say pairs of hex, or numbers up to 26) the <i>grouping</i> tells you the system: hex pairs &rarr; From Hex; numbers 1&ndash;26 &rarr; A1Z26.</li>
      <li><b>Submit</b> the decoded flag. <i>Lesson: the shape of the groups names the number system.</i></li>
    </ol>
    <div class="clue-why"><b class="sig">Why the wording pointed here:</b> you were given <b>no instructions at all</b> — just data. In that case the <i>characters themselves</i> are the clue. Two symbols only (<span class="signpost">0</span> and <span class="signpost">1</span>) in <b>groups of eight</b> can only really be binary bytes. The data announces its own type; you just have to notice the alphabet it uses.</div>
  </div>

  <div class="worked">
    <p><b>📡 Networking &mdash; "We captured the traffic. The password is in there somewhere."</b></p>
    <ol class="walk-steps">
      <li><b>Recognise.</b> Words like "captured", "traffic", "packets" or a <code>.pcap</code> file mean the flag is inside a recorded conversation between two machines.</li>
      <li><b>Follow the conversation.</b> Traffic is made of many small packets; the useful part is one back-and-forth exchange. Look for the stream that carries readable text (a login, a message, a web request).</li>
      <li><b>Read the fields that matter.</b> Usernames, passwords and messages often travel in plain text in these puzzles. Skim for <code>flag{</code> or an obvious login.</li>
      <li><b>Watch for encoding.</b> Web logins are frequently Base64-wrapped, so a captured password may need one more decode step.</li>
      <li><b>Submit</b> what you find. <i>Lesson: a capture is a transcript &mdash; read the conversation, don't stare at the whole blob.</i></li>
    </ol>
    <div class="clue-why"><b class="sig">Why the wording pointed here:</b> <span class="signpost">captured the traffic</span> is pure networking vocabulary. "Traffic" means data moving between computers, and "captured" means it was recorded for you to read afterwards. The sentence is telling you the flag was never hidden or encrypted — it was simply <i>said out loud</i> on the network, and you are reading the transcript.</div>
  </div>

  <h2>How to read each kind of task</h2>
  <div class="guide-grid">
    <div class="guide-card"><h3>🔐 Cryptography</h3><ul><li>Name the encoding before decoding (use the table above).</li><li>Layered? Decode one step, re-read, repeat.</li><li>Shifted letters = Caesar; brute force all 25.</li></ul></div>
    <div class="guide-card"><h3>🌐 Web</h3><ul><li>Always click View HTML first.</li><li>Read comments, scripts and cookies: secrets hide there.</li><li>If the browser checks a password, the answer is in the code.</li></ul></div>
    <div class="guide-card"><h3>🔎 Forensics</h3><ul><li>Open files in the Hex viewer.</li><li>Check the magic bytes: the real file type, not the name.</li><li>Skim the Strings list for <code>flag{</code>.</li></ul></div>
    <div class="guide-card"><h3>🖼️ Steganography</h3><ul><li>Check metadata and strings first.</li><li>Then the colour channels and the lowest-bit view.</li><li>Tiny colour changes your eyes cannot see.</li></ul></div>
    <div class="guide-card"><h3>🕵️ OSINT</h3><ul><li>Work only from public clues in the task.</li><li>Think about what a photo or bio gives away.</li><li>Usernames are often reused across sites.</li></ul></div>
    <div class="guide-card"><h3>⚙️ Reverse engineering</h3><ul><li>Write down what each line does.</li><li>Then undo the steps in reverse order.</li><li>For C# puzzles, trace the loop by hand first.</li></ul></div>
  </div>

  <h2>Good habits that win events</h2>
  <ul>
    <li><b>Split up as a team.</b> Take a category each, then share what you learn. Two people on a stuck challenge beats one.</li>
    <li><b>Keep notes.</b> Write down what you tried and what you got. It stops you repeating yourself and spots patterns.</li>
    <li><b>Watch the clock.</b> Stuck for 15 minutes? Move on and come back with fresh eyes. Easy flags first.</li>
    <li><b>Mind the format.</b> A wrong answer is often the right word in the wrong shape: check capitals, underscores and the <code>flag{ }</code> wrapper.</li>
    <li><b>Do not over-think the easy ones.</b> If it looks like the flag is just sitting there, it probably is.</li>
    <li><b>Really stuck?</b> On this practice site, after a few wrong tries each challenge offers a full step-by-step walkthrough. Use it to learn the move, then try the next one yourself. (There are no walkthroughs at the real event.)</li>
  </ul>
  <div class="callout good">Ready to practise? Open the <a href="#" data-goto="board">Challenge board</a> and start with the Warm-Up category, keeping this loop in mind: <b>Read, Recognise, Try the obvious, Use a tool, Check the format.</b></div>
  `;
};


/* Useful websites page: real tools pupils can use when they have internet */
window.CTF_RES_HTML = function () {
  function card(url, name, desc) {
    var host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return '<div class="res-card"><a href="' + url + '" target="_blank" rel="noopener">' + name + '</a>' +
      '<div class="res-host">' + host + '</div><p>' + desc + '</p></div>';
  }
  function group(title, cards) { return '<h2>' + title + '</h2><div class="res-grid">' + cards.join('') + '</div>'; }
  return '' +
  '<h1>Useful websites</h1>' +
  '<p>This practice site works with no internet so it runs on school machines. At the <b>real</b> event you will usually have the internet, and these are the tools people actually use. Learn where they are now so you are fast on the day.</p>' +
  '<div class="callout warn"><b>Play fair and stay safe.</b> Only ever use these on challenges you have been given permission to solve. Never point them at real websites, school systems or other people\'s accounts &mdash; that is illegal under the Computer Misuse Act 1990. Some events also limit which sites you may use, so check the rules first.</div>' +
  group('All-in-one toolboxes', [
    card('https://gchq.github.io/CyberChef/', 'CyberChef', 'The big one. Chain operations (Base64, hex, ROT13, XOR and hundreds more) in a "recipe", exactly like the Decoder on this site. Made by GCHQ.'),
    card('https://www.dcode.fr/en', 'dCode', 'A huge collection of cipher and puzzle solvers with clear explanations. Great when you are not sure what a cipher is.'),
    card('https://cryptii.com/', 'Cryptii', 'Clean, visual encoder/decoder you can chain. Good for seeing how a conversion works step by step.')
  ]) +
  group('Ciphers and hashes', [
    card('https://quipqiup.com/', 'quipqiup', 'Automatically solves substitution ciphers and cryptograms. Paste the scrambled text and it guesses the mapping.'),
    card('https://rumkin.com/tools/cipher/', 'Rumkin Cipher Tools', 'A tidy set of classic ciphers: Caesar, Vigenere, rail fence, Atbash and more.'),
    card('https://crackstation.net/', 'CrackStation', 'Looks up common password hashes (MD5, SHA1, SHA256) in a giant table. Shows why weak passwords are unsafe.'),
    card('https://hashes.com/en/decrypt/hash', 'Hashes.com', 'Another hash lookup service. Handy when CrackStation does not have a match.')
  ]) +
  group('Images and files (forensics & steganography)', [
    card('https://www.aperisolve.com/', 'Aperi\'Solve', 'Upload an image and it runs lots of steganography checks at once: layers, strings, metadata and more.'),
    card('https://georgeom.net/StegOnline/upload', 'StegOnline', 'Explore an image\'s colour channels and bit planes in the browser, like the Image inspector here but more powerful.'),
    card('https://29a.ch/photo-forensics/', 'Forensically', 'In-browser photo forensics: error-level analysis, noise, clone detection and a metadata viewer.'),
    card('https://exifdata.com/', 'EXIF Viewer', 'Reads the hidden metadata in a photo, including the camera and sometimes GPS location.')
  ]) +
  group('OSINT (finding public information)', [
    card('https://images.google.com/', 'Google Images', 'Reverse image search: drag a photo in to find where else it appears and what it shows.'),
    card('https://whatsmyname.app/', 'WhatsMyName', 'Checks a username across hundreds of sites at once &mdash; shows how reused handles link accounts.'),
    card('https://www.google.com/maps', 'Google Maps', 'Turn coordinates or landmarks into a place, and use Street View to match a photo to a location.')
  ]) +
  group('Run code (for programming challenges)', [
    card('https://dotnetfiddle.net/', 'dotnetfiddle', 'Write and run C# in your browser &mdash; the language you use in class &mdash; with nothing to install.'),
    card('https://www.programiz.com/csharp-programming/online-compiler/', 'Programiz C# compiler', 'Another quick online C# runner for testing a short loop or calculation.')
  ]) +
  group('Keep practising', [
    card('https://play.picoctf.org/practice', 'picoGym (picoCTF)', 'Hundreds of free beginner-to-intermediate challenges with the same categories as the event. The best next step.'),
    card('https://overthewire.org/wargames/bandit/', 'OverTheWire: Bandit', 'A gentle, famous introduction to Linux and the command line, one small puzzle at a time.'),
    card('https://cryptohack.org/', 'CryptoHack', 'Fun, game-like cryptography challenges that start gently and teach as you go.'),
    card('https://tryhackme.com/', 'TryHackMe', 'Guided cyber-security lessons in the browser. Good for going deeper after the event.')
  ]) +
  group('The real events', [
    card('https://zerodays.ie/', 'ZeroDays CTF', 'The organisers behind the event style this site is based on.'),
    card('https://cyberschools.ie/', 'Cyber-Schools CTF', 'The secondary-school CTF run by ZeroDays.')
  ]) +
  '<div class="callout good">On this practice site, the <a href="#" data-goto="toolkit">Toolkit</a> already covers most of what CyberChef and the hash tools do, so you can get a long way with no internet at all.</div>';
};


/* Lessons & practice: structured mini-lessons that teach each skill and how to practise */
window.CTF_LESSONS_HTML = function () {
  function tries(list) {
    return '<div class="try-row"><span class="try-label">Try it:</span>' +
      list.map(function (x) { return '<button class="btn small" data-chal="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }
  function lesson(num, title, body) {
    return '<details class="lesson"><summary><span class="lesson-num">Lesson ' + num + '</span> ' + title + '</summary><div class="lesson-body">' + body + '</div></details>';
  }
  var L = '';

  L += '<h1>Lessons &amp; practice</h1>' +
    '<p>This is the teaching part of the site. The short lessons below each explain one skill from scratch, show a worked example, and send you to challenges to try it. Above them is a guide on <b>how</b> to practise so the time you put in actually sticks.</p>';

  // ---- How to practise ----
  L += '<h2>How to practise</h2>' +
    '<div class="callout good"><b>The golden rule: little and often beats one long cram.</b> Three or four 20-minute sessions across a week will teach you far more than one two-hour blast the night before.</div>' +
    '<h3>1. Follow a path, one skill at a time</h3>' +
    '<p>Do not jump around randomly. Work through the lessons below in order. Each one builds on the last: number systems make encodings easy, encodings make ciphers easy, and so on. Finish a lesson\'s "Try it" challenges before moving to the next.</p>' +
    '<h3>2. Keep a notes file</h3>' +
    '<p>Open a document and, as you solve challenges, write down:</p><ul>' +
    '<li>What the puzzle <i>looked like</i> (only 0s and 1s, ended in =, dots and dashes...).</li>' +
    '<li>What it turned out to be, and which tool solved it.</li>' +
    '<li>Anything that caught you out.</li></ul>' +
    '<p>This becomes your personal cheat sheet. Re-reading it before the event is the single best revision you can do.</p>' +
    '<h3>3. Use this site the right way</h3><ul>' +
    '<li>Start every session in <a href="#" data-goto="board">Warm-Up</a>. It keeps the early wins coming and warms up your pattern-spotting.</li>' +
    '<li>Stuck? Reveal hints <b>one at a time</b>, and give each one a real go before taking the next.</li>' +
    '<li>Really stuck? Use the full walkthrough, read it properly, then <b>close it and solve a similar one yourself</b>. Reading a solution is not the same as being able to do it.</li>' +
    '<li>Download your progress file at the end of each session (<a href="#" data-goto="progress">My progress</a>) so nothing is lost when the school PC logs you off.</li></ul>' +
    '<h3>4. A three-week run-up to the event</h3>' +
    '<div class="plan"><div class="plan-week"><b>Week 1 &mdash; Foundations</b><span>Lessons 1&ndash;4. Get comfortable with number systems, Base64 and the Caesar cipher. Aim to clear all of Warm-Up.</span></div>' +
    '<div class="plan-week"><b>Week 2 &mdash; Breadth</b><span>Lessons 5&ndash;10. Try every category at least once: Web, Forensics, Steganography, OSINT. Find which you enjoy.</span></div>' +
    '<div class="plan-week"><b>Week 3 &mdash; Speed &amp; teamwork</b><span>Lessons 11&ndash;13 plus timed practice: give yourself 30 minutes and see how many flags you can grab. Agree who covers which category in your team.</span></div></div>' +
    '<h3>5. When you are stuck (work down this list)</h3>' +
    '<ol class="walk-steps"><li>Re-read the challenge. What is the title hinting? What is in bold?</li>' +
    '<li>Ask "what does this data look like?" and check the <a href="#" data-goto="walkthrough">recognition table</a>.</li>' +
    '<li>Click View HTML in case something is hidden.</li>' +
    '<li>Try the most likely tool; look at the output; decide the next step.</li>' +
    '<li>Take one hint. Still stuck after a genuine go? Move on and come back later &mdash; fresh eyes solve a surprising amount.</li></ol>' +
    '<div class="callout warn"><b>On the day:</b> there are no hints or walkthroughs at the real event. Split the categories across your team, do the easy flags first, keep notes, and watch the clock. Only ever test the challenges you are given &mdash; nothing else.</div>';

  // ---- The lessons ----
  L += '<h2>The lessons</h2><p class="muted small">Click a lesson to open it.</p>';

  L += lesson(1, 'The CTF mindset',
    '<p><b>The idea.</b> A CTF challenge always hides a <b>flag</b> like <code>flag{...}</code>. Your whole job is to find it. If what you are looking at is not a flag yet, there is a step left to do. The core skill is not memorising tricks &mdash; it is <b>recognising</b> what kind of puzzle you have, then picking the matching tool.</p>' +
    '<p><b>The loop to use every time:</b> Read &rarr; Recognise &rarr; Try the obvious &rarr; Use a tool &rarr; Check the format.</p>' +
    tries([['warm-01', 'Your first flag'], ['warm-02', 'Hidden in plain sight']]) +
    '<p class="lesson-tip">Tip: flags here are not case-sensitive, but they must keep the <code>flag{ }</code> wrapper.</p>');

  L += lesson(2, 'Number systems: binary, hex and ASCII',
    '<p><b>The idea.</b> Computers store letters as numbers. <b>ASCII</b> is the code: capital A is 65, lower-case a is 97. Those numbers can be written in different <b>bases</b>:</p>' +
    '<ul><li><b>Binary</b> (base 2): only 0 and 1. Each letter is 8 bits, e.g. <code>01100110</code> = 102 = f.</li>' +
    '<li><b>Hex</b> (base 16): digits 0-9 then a-f. Two digits per letter, e.g. <code>66</code> = 102 = f.</li>' +
    '<li><b>Decimal</b>: the ASCII numbers written normally, e.g. <code>102 108 97 103</code>.</li></ul>' +
    '<p><b>Worked example.</b> <code>01100110 01101100</code> &rarr; split into bytes &rarr; 102 and 108 &rarr; f and l. The Decoder\'s From Binary does this instantly.</p>' +
    tries([['warm-04', 'Ones and zeros'], ['warm-05', 'Hex marks the spot'], ['warm-07', 'By the numbers']]) +
    '<p class="lesson-tip">Tip: only 0s and 1s = binary. Only 0-9 and a-f = hex. Plain numbers in small groups = ASCII codes.</p>');

  L += lesson(3, 'Base64 and encodings',
    '<p><b>The idea.</b> <b>Base64</b> turns any data into letters, numbers, <code>+</code> and <code>/</code>, often ending in <code>=</code>. It is an <b>encoding</b>, not encryption: there is no key and anyone can reverse it. It is everywhere &mdash; in cookies, tokens, config files and links.</p>' +
    '<p><b>Worked example.</b> <code>ZmxhZ3toaQ==</code> ends in <code>==</code>, a Base64 giveaway. From Base64 gives <code>flag{hi}</code>.</p>' +
    tries([['warm-03', 'Base64 basics'], ['warm-13', 'Web address code'], ['warm-12', 'Wrapped twice']]) +
    '<p class="lesson-tip">Tip: if text ends in <code>=</code> or <code>==</code>, try From Base64 first.</p>');

  L += lesson(4, 'The Caesar cipher and friends',
    '<p><b>The idea.</b> A <b>Caesar cipher</b> shifts every letter the same number of places. Shift "flag" forward 13 and you get "synt". To break it when you do not know the shift, try all 25 &mdash; that is <b>brute force</b>.</p>' +
    '<ul><li><b>ROT13</b> is just a Caesar shift of 13 (doing it twice returns the original).</li>' +
    '<li><b>Atbash</b> flips the alphabet: A becomes Z, B becomes Y.</li>' +
    '<li><b>Morse</b> uses dots and dashes; <b>A1Z26</b> uses numbers 1-26 for letters.</li></ul>' +
    '<p><b>Worked example.</b> <code>iodj{...}</code> looks like a shifted <code>flag{...}</code>. Caesar brute force lists all 25 shifts; the readable one is the answer.</p>' +
    tries([['cry-01', 'Half way round'], ['cry-02', "Caesar's salad"], ['cry-04', 'Mirror, mirror'], ['cry-05', 'Dot dot dash'], ['cry-06', 'A is for 1']]) +
    '<p class="lesson-tip">Tip: words that look almost right but scrambled usually mean a Caesar/ROT shift. Spot <code>synt</code> = <code>flag</code>.</p>');

  L += lesson(5, 'Keyword ciphers and rail fence',
    '<p><b>The idea.</b> The <b>Vigenere</b> cipher is a Caesar where the shift changes every letter, following a repeating <b>keyword</b>. You need the key to decode. The <b>rail fence</b> cipher writes the message in a zig-zag across several lines, then reads the lines in order.</p>' +
    '<p><b>Worked example.</b> With the keyword SCHOOL, each letter of SCHOOL says how far to shift, repeating across the message. The Decoder\'s Vigenere decode does it once you type the key.</p>' +
    tries([['cry-07', 'The school key'], ['cry-08', 'Zig zag']]) +
    '<p class="lesson-tip">Tip: if a cipher names a keyword, it is almost always Vigenere. No key given? Sometimes the known start <code>flag</code> lets you work it out.</p>');

  L += lesson(6, 'Layered challenges',
    '<p><b>The idea.</b> Harder crypto stacks several steps. The method never changes: undo <b>one</b> layer, look at the new output, name it, undo the next. Work in the <b>reverse</b> of the order they were applied.</p>' +
    '<p><b>Worked example.</b> Base64 that decodes to hex that decodes to shifted text: From Base64 &rarr; From Hex &rarr; Caesar brute force. After each step you ask again: "what is this now?"</p>' +
    tries([['cry-03', 'Layer cake'], ['cry-11', 'Undo in reverse']]) +
    '<p class="lesson-tip">Tip: never try to see the whole solution at once. One layer at a time.</p>');

  L += lesson(7, 'Web: reading the page',
    '<p><b>The idea.</b> Anything your browser can see, you can see. Flags hide in the page source, HTML comments, JavaScript, hidden form fields, cookies and response headers. Inspect Element is blocked on school PCs, so use the <b>View HTML</b> button instead.</p>' +
    '<p><b>Worked example.</b> A login page checks the password in JavaScript. If the check runs in the browser, the correct password is written in the code &mdash; just read it.</p>' +
    tries([['web-01', 'Robots only'], ['web-02', 'Password in the page'], ['web-03', 'Have a cookie']]) +
    '<p class="lesson-tip">Tip: always click View HTML first, then check comments, scripts and cookies.</p>');

  L += lesson(8, 'Forensics: files and logs',
    '<p><b>The idea.</b> A file\'s name can lie; its first few bytes (the <b>magic number</b>) tell you what it really is. Pull readable text out with the <b>Strings</b> list, and read <b>logs</b> for patterns like one address failing over and over.</p>' +
    '<p><b>Worked example.</b> A file called notes.txt starts with bytes <code>89 50 4E 47</code> &mdash; that is PNG, so it is really an image. Rename it to .png and the flag is inside.</p>' +
    tries([['for-01', 'Who is knocking?'], ['for-02', 'Wrong name tag'], ['for-03', 'Needle in a haystack']]) +
    '<p class="lesson-tip">Tip: open mystery files in the Hex viewer and read both the magic number and the Strings list.</p>');

  L += lesson(9, 'Steganography: hidden in images',
    '<p><b>The idea.</b> Steganography hides data inside a picture. Check the easy places first (<b>metadata</b> and strings), then the pixels: single colour channels, the <b>lowest bit</b> of each colour, or exaggerating tiny differences the eye cannot see.</p>' +
    '<p><b>Worked example.</b> A "plain" dark image has text drawn one shade off the background. The Image inspector\'s "exaggerate" view makes it pop.</p>' +
    tries([['steg-01', 'Night sky'], ['steg-02', 'Picture properties'], ['steg-03', 'Lowest bit']]) +
    '<p class="lesson-tip">Tip: work from the outside in &mdash; metadata, then strings, then the pixels.</p>');

  L += lesson(10, 'OSINT: public information',
    '<p><b>The idea.</b> OSINT (Open Source Intelligence) means finding answers from information that is already public: a photo, a bio, a username, map coordinates. No decoding &mdash; just careful reading and joining the dots.</p>' +
    '<p><b>Worked example.</b> A profile\'s reset question is "first pet\'s name", and a post says "my dog Rodney". The answer was handed over without anyone realising. That is how real accounts get taken over.</p>' +
    tries([['osint-01', 'What three words'], ['osint-02', 'Oversharing']]) +
    '<p class="lesson-tip">Tip: think about what a photo or a post quietly reveals &mdash; locations, dates, names.</p>');

  L += lesson(11, 'Reverse engineering &amp; C#',
    '<p><b>The idea.</b> Reverse engineering means reading code and working backwards to the input it wants. Write down what each line does, then undo the steps in <b>reverse order</b>. You do not always need to run the code &mdash; often you can trace it by hand.</p>' +
    '<p><b>Worked example.</b> A function does <code>x = x + 3; x = x * 2;</code> and returns 30. Undo in reverse: 30 / 2 = 15, then 15 - 3 = 12. The input was 12.</p>' +
    tries([['rev-01', 'Work backwards'], ['rev-02', 'Trace the code']]) +
    '<p class="lesson-tip">Tip: these use C#, the language you already learn. Read the loop, then do the opposite in the opposite order.</p>');

  L += lesson(12, 'Networking basics',
    '<p><b>The idea.</b> Computers talk through numbered <b>ports</b>, and each service has its own: 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS, 21 FTP, 23 Telnet. Old protocols like HTTP and Telnet send data in plain text, so anyone watching can read passwords.</p>' +
    '<p><b>Worked example.</b> A captured packet shows a login sent over plain HTTP: the password is right there in the form data. HTTPS would have encrypted it.</p>' +
    tries([['net-01', 'Know your ports'], ['net-02', 'Listening in']]) +
    '<p class="lesson-tip">Tip: learn the common port numbers &mdash; they come up again and again.</p>');

  L += lesson(13, 'Online safety',
    '<p><b>The idea.</b> Many challenges (and real life) test whether you can spot a trick: a faked sender address, a look-alike link, a weak password, an app asking for too much. The real website name is the part just before the first single slash, and a long passphrase beats a short password with symbols.</p>' +
    '<p><b>Worked example.</b> <code>apple-verify-login.secure-check.ru</code> is not Apple &mdash; the real domain is <code>secure-check.ru</code>. Always check what comes just before the first slash.</p>' +
    tries([['safe-01', 'Spot the phish'], ['safe-02', 'Strong or weak']]) +
    '<p class="lesson-tip">Tip: slow down on anything urgent or too-good-to-be-true. That urgency is the trick.</p>');

  L += '<div class="callout good">Finished the lessons? Put them together on the <a href="#" data-goto="board">Challenge board</a>, and when you have internet, the <a href="#" data-goto="resources">Useful sites</a> page lists the real tools for going further.</div>';
  return L;
};


/* Toolkit help: what each tool does, how to use it, and the cue that tells you to reach for it */
window.CTF_TOOLS_HELP_HTML = function () {
  var T = [
    ['🧪 Decoder', 'Your main workhorse. It undoes encodings and ciphers &mdash; Base64, hex, binary, ROT13, Caesar, Vigenere, Morse and more &mdash; and you can chain steps into a "recipe" like CyberChef.',
      'Type or paste text into Input, then click an operation on the left to add it. Add more steps to build a recipe; the Output updates live. "Output to Input" feeds the result back in for the next layer.',
      'Reach for it whenever the challenge gives you scrambled text: letters and numbers ending in = (Base64), only 0s and 1s (binary), only 0-9 and a-f (hex), dots and dashes (Morse), or shifted-looking words (Caesar).'],
    ['📊 Frequency analysis', 'Counts how often each letter appears and lets you build your own letter-for-letter swaps.',
      'Paste the ciphertext; the bars show the common letters. Fill in guesses in the substitution grid and watch the decoded text update.',
      'Use it on a substitution cipher where each letter is always swapped for the same other letter, and the Caesar tools have not cracked it.'],
    ['#️⃣ Hashes', 'Shows the MD5, SHA-1 and SHA-256 of any text, and can crack a weak hash by trying a wordlist.',
      'Type text to see its hashes. To crack one, paste the hash, check the wordlist, and press "Try every word".',
      'Reach for it when a challenge gives you a long string of hex that is exactly 32, 40 or 64 characters long &mdash; that is almost always a hash.'],
    ['🔢 Hex viewer', 'Opens any file and shows its raw bytes, the "magic number" that reveals its true type, and a Strings list of readable text inside.',
      'Open a file (or use "Open in Hex viewer" on a challenge). Check the first bytes against the magic-number note, and skim the Strings list for flag{.',
      'Use it on any file challenge: a file that will not open, a wrong-looking extension, or anything where the flag might be hidden as text inside.'],
    ['🖼️ Image inspector', 'Reveals things hidden in pictures by viewing single colour channels, the lowest bit of each colour, or exaggerating tiny differences.',
      'Open an image, then try each view from the dropdown. Click a pixel to read its exact colour values.',
      'Reach for it on steganography challenges &mdash; any picture that "looks normal" or oddly plain probably has something hidden in the pixels.'],
    ['💻 JS scratchpad', 'A little code runner for quick calculations. Write JavaScript and press Run; use print(...) to show results.',
      'Type your code and press Run. For programming challenges you will usually write the real answer in C# (Visual Studio), but this is handy for a fast check.',
      'Use it when an answer is too tedious to work out by hand &mdash; adding up a long list, counting things, looping.'],
    ['🔤 ASCII table', 'A lookup chart showing every character with its decimal, hex and binary code.',
      'Just read it &mdash; find a character to get its number, or a number to get its character.',
      'Use it to check a single code by hand, or to understand what the Decoder is doing under the hood.']
  ];
  return T.map(function (t) {
    return '<div class="tg-item"><h4>' + t[0] + '</h4>' +
      '<p><b>What it does:</b> ' + t[1] + '</p>' +
      '<p><b>How to use it:</b> ' + t[2] + '</p>' +
      '<p class="tg-when"><b>When to use it:</b> ' + t[3] + '</p></div>';
  }).join('');
};


/* Reference: glossary, cheat sheets and FAQ — printable as a revision handout */
window.CTF_REFERENCE_HTML = function () {
  var recog = [
    ['Only 0 and 1 (groups of 8)', 'Binary', 'Decoder, From Binary'],
    ['Only 0-9 and a-f', 'Hexadecimal', 'Decoder, From Hex'],
    ['Letters, numbers, + /, ends in =', 'Base64', 'Decoder, From Base64'],
    ['Shifted-looking words (synt = flag)', 'Caesar / ROT', 'Decoder, Caesar brute force'],
    ['Dots and dashes', 'Morse code', 'Decoder, From Morse'],
    ['Numbers 1-26 with dashes', 'A1Z26', 'Decoder, A1Z26 decode'],
    ['Small groups of numbers (102 108)', 'ASCII codes', 'Decoder, From Decimal'],
    ['32 / 40 / 64-character hex string', 'A hash (MD5/SHA)', 'Hashes tool, crack with wordlist'],
    ['A web page or login box', 'Web', 'View HTML; comments, scripts, cookies'],
    ['A file or odd extension', 'Forensics', 'Hex viewer; magic bytes and Strings'],
    ['A normal-looking picture', 'Steganography', 'Image inspector; channels and lowest bit'],
    ['A profile, photo or clue', 'OSINT', 'Read public details; join the dots']
  ];
  var ports = [['21', 'FTP', 'File transfer (insecure)'], ['22', 'SSH', 'Secure login'], ['23', 'Telnet', 'Old remote login (insecure)'],
    ['25', 'SMTP', 'Sending email'], ['53', 'DNS', 'Name lookups'], ['80', 'HTTP', 'Web (not encrypted)'],
    ['443', 'HTTPS', 'Secure web (encrypted)'], ['3389', 'RDP', 'Remote desktop']];
  var ciphers = [
    ['Base64', 'Ends in =, uses + /', 'An encoding, no key — anyone can reverse'],
    ['Hex', 'Only 0-9 a-f, pairs of digits', 'Two digits per character'],
    ['Binary', 'Only 0 and 1, 8 per character', 'Base 2'],
    ['Caesar / ROT', 'All letters shifted the same amount', 'Try all 25 shifts (ROT13 = shift 13)'],
    ['Atbash', 'A becomes Z, B becomes Y', 'The alphabet mirrored'],
    ['Vigenere', 'Named a keyword', 'A Caesar whose shift changes per letter'],
    ['Rail fence', 'Letters zig-zag across rows', 'Read the zig-zag back'],
    ['Morse', 'Dots and dashes, / between words', 'Dots and dashes to letters'],
    ['A1Z26', 'Numbers 1-26', 'Each number is a letter']
  ];
  var glossary = [
    ['Flag', 'The secret you are hunting, written like flag{...}.'],
    ['CTF', 'Capture The Flag — a cyber security puzzle competition.'],
    ['Jeopardy CTF', 'The common style: challenges in categories, each worth points.'],
    ['Encoding', 'A reversible way of writing data (Base64, hex). No key needed.'],
    ['Encryption', 'Scrambling data with a key, so you need the key to read it.'],
    ['Cipher', 'A method of encryption, like Caesar or Vigenere.'],
    ['Hash', 'A one-way fingerprint of data. You cannot reverse it, only guess and check.'],
    ['Brute force', 'Trying every possibility until one works (e.g. all 25 Caesar shifts).'],
    ['Payload', 'The useful data part — for example the middle of a login token.'],
    ['Metadata', 'Hidden data carried inside a file, like a photo\'s camera or comment.'],
    ['Magic number', 'The first bytes of a file that reveal its true type.'],
    ['Steganography', 'Hiding a message inside something else, like an image.'],
    ['OSINT', 'Open Source Intelligence — facts found from public information.'],
    ['Port', 'A numbered channel a network service uses (80 = web, 22 = SSH).'],
    ['Plaintext', 'Readable, unencrypted data — what you are trying to recover.']
  ];
  var faq = [
    ['Is the flag case-sensitive?', 'No — but you must keep the flag{ } wrapper.'],
    ['How do I save my progress?', 'It saves automatically in this browser. At the end of a session, go to My progress and download your progress file, then load it next time (school PCs can wipe browser data).'],
    ['Inspect Element is blocked. How do I see a page\'s code?', 'Use the View HTML button on web challenges, or the file viewer. They do the same job.'],
    ['I got the right word but it says wrong.', 'Wrap it as flag{word}, and check capitals and underscores.'],
    ['Can I use hints?', 'Yes! While practising, hints are there to help you learn. There are none at the real event, so try first.'],
    ['What if the site is blocked at school?', 'Ask your teacher — it is a plain web page with no logins or downloads, designed to work on C2k.'],
    ['Do revealed answers count?', 'They tick the challenge off but score 0 points, so the leaderboard stays fair.']
  ];
  function table(headers, rows, cls) {
    return '<div class="table-wrap"><table class="' + (cls || 'recognise') + '"><thead><tr>' +
      headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div>';
  }
  return '<div class="ref-head"><h1>Reference &amp; cheat sheet</h1>' +
    '<button class="btn" data-action="print">🖨 Print this page</button></div>' +
    '<p>A quick-reference you can keep open while you solve, or print as a one-page revision sheet. Flags always look like <code>flag{...}</code>.</p>' +
    '<h2>Spot it fast</h2><p>What the data looks like, what it probably is, and the tool to use.</p>' + table(['If you see...', 'It is probably...', 'Use'], recog) +
    '<h2>Encodings &amp; ciphers at a glance</h2>' + table(['Name', 'How to spot it', 'What it is'], ciphers) +
    '<h2>Common ports</h2>' + table(['Port', 'Service', 'What it is for'], ports) +
    '<h2>Glossary</h2><dl class="glossary">' + glossary.map(function (g) { return '<dt>' + g[0] + '</dt><dd>' + g[1] + '</dd>'; }).join('') + '</dl>' +
    '<h2>Frequently asked questions</h2><dl class="faq">' + faq.map(function (q) { return '<dt>' + q[0] + '</dt><dd>' + q[1] + '</dd>'; }).join('') + '</dl>' +
    '<div class="callout good no-print">Tip: print this page and keep it beside you while you practise. On the day, you will know it by heart.</div>';
};


/* Printable classroom pack: handouts a teacher can print for the class. Each prints on its own. */
window.CTF_PACK_HTML = function () {
  function handout(id, title, body) {
    return '<section class="handout" data-handout="' + id + '">' +
      '<div class="handout-head"><h2>' + title + '</h2>' +
      '<button class="btn small no-print" data-print-handout="' + id + '">🖨 Print this handout</button></div>' +
      '<div class="handout-body">' + body + '</div></section>';
  }

  var flag = '<div class="poster">' +
    '<div class="poster-big"><code>flag{...}</code></div>' +
    '<p class="poster-sub">Every answer is a flag. If what you have is not shaped like this, you are not finished.</p>' +
    '<ul class="poster-list">' +
    '<li><b>Keep the wrapper.</b> <code>peel_the_layers</code> is wrong; <code>flag{peel_the_layers}</code> is right.</li>' +
    '<li><b>Underscores, not spaces.</b> Words are joined with <code>_</code>.</li>' +
    '<li><b>Capitals matter only inside</b> if the challenge shows them — otherwise lower case is fine.</li>' +
    '<li><b>Copy it exactly.</b> No extra spaces at the start or end.</li>' +
    '<li><b>Close but gibberish?</b> You missed a layer — decode once more.</li>' +
    '</ul></div>';

  var method = '<ol class="method-poster">' +
    '<li><b>READ it twice.</b> The title and the bold words are clues. Sometimes the flag is already there.</li>' +
    '<li><b>RECOGNISE what you have.</b> Name the data before touching a tool: Base64? Binary? A shifted cipher? A file? A picture?</li>' +
    '<li><b>TRY the obvious.</b> Is it just backwards, shifted, or sitting in the page source? Many flags take one step.</li>' +
    '<li><b>USE the right tool.</b> Decoder for codes, Hex viewer for files, Image inspector for pictures, Hashes for password hashes.</li>' +
    '<li><b>CHECK the format.</b> Your answer should read like words. Wrap it as <code>flag{...}</code> and submit.</li>' +
    '</ol>' +
    '<p class="poster-sub">Stuck for 15 minutes? Move on and come back with fresh eyes. Easy flags first.</p>';

  var recog = [
    ['Letters/numbers ending in <code>=</code>', 'Base64', 'Decoder &rarr; From Base64'],
    ['Only <code>0</code> and <code>1</code>, groups of 8', 'Binary', 'Decoder &rarr; From Binary'],
    ['Only <code>0-9 a-f</code>', 'Hex', 'Decoder &rarr; From Hex'],
    ['Words almost right, letters shifted', 'Caesar / ROT', 'Decoder &rarr; Caesar brute force'],
    ['Dots and dashes', 'Morse', 'Decoder &rarr; From Morse'],
    ['Numbers 1&ndash;26', 'A1Z26', 'Decoder &rarr; A1Z26'],
    ['A web page or login box', 'Web', 'View HTML; comments, cookies'],
    ['A file that won\'t open right', 'Forensics', 'Hex viewer; magic bytes &amp; strings'],
    ['A normal-looking picture', 'Steganography', 'Image inspector; lowest-bit view'],
    ['A 32-char hex string', 'MD5 hash', 'Hashes tool; crack with wordlist'],
    ['A profile, photo or clue', 'OSINT', 'Read public details; join the dots'],
    ['Code: input in, result out', 'Reverse engineering', 'Undo the steps in reverse']
  ];
  var cheat = '<table class="recognise"><thead><tr><th>If you see…</th><th>It is probably…</th><th>Do this</th></tr></thead><tbody>' +
    recog.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>'; }).join('') +
    '</tbody></table>';

  var tools = '<table class="recognise"><thead><tr><th>Tool</th><th>Reach for it when…</th></tr></thead><tbody>' +
    '<tr><td><b>Decoder</b></td><td>you have a code or cipher (Base64, hex, binary, Caesar, Morse). Chain steps like CyberChef.</td></tr>' +
    '<tr><td><b>Frequency analysis</b></td><td>a substitution cipher where you don\'t know the key — the letter counts give it away.</td></tr>' +
    '<tr><td><b>Hex viewer</b></td><td>a file. Check the first bytes (magic number) and skim the strings for <code>flag{</code>.</td></tr>' +
    '<tr><td><b>Image inspector</b></td><td>a picture that might be hiding something — try the colour channels and lowest-bit view.</td></tr>' +
    '<tr><td><b>Hashes</b></td><td>a password hash to identify or crack against the wordlist.</td></tr>' +
    '<tr><td><b>View HTML</b></td><td>any web challenge — it does the job of View Source (Inspect is blocked at school).</td></tr>' +
    '<tr><td><b>ASCII table</b></td><td>you have numbers that might be character codes (65 = A, 97 = a).</td></tr>' +
    '</tbody></table>';

  var roles = [
    ['👑 Captain', 'Keeps the team moving. Watches the clock, decides what to tackle next, and makes sure nobody is stuck in silence. Calls "move on" after 15 minutes on one challenge.'],
    ['🔐 Cryptography', 'Owns codes and ciphers. Lives in the Decoder. First to spot Base64, binary, hex and Caesar shifts. Peels layered challenges one step at a time.'],
    ['🌐 Web', 'Owns web challenges. Always clicks View HTML first; reads comments, scripts and cookies. Knows "if the browser checks it, the answer is in the code."'],
    ['🔎 Forensics & Stego', 'Owns files and pictures. Uses the Hex viewer for magic bytes and strings, and the Image inspector for hidden pixels and metadata.'],
    ['🕵️ OSINT & Networking', 'Owns clue-hunting and captures. Finds answers in public details, follows the conversation in traffic, and knows the common ports.'],
    ['✍️ Scribe', 'Writes down every flag found and everything tried. Stops the team repeating work and spots patterns across challenges. Reads flags back carefully before submitting.']
  ];
  var roleCards = '<div class="role-cards">' + roles.map(function (r) {
    return '<div class="role-card"><h3>' + r[0] + '</h3><p>' + r[1] + '</p></div>';
  }).join('') + '</div>' +
  '<p class="poster-sub">Tip: in a small team, one person can hold two roles. Everyone can still try any challenge — roles just say who leads where.</p>';

  var onday = '<div class="twocol">' +
    '<div><h3>What to bring</h3><ul>' +
    '<li>Yourself and your team — split the categories using your role cards.</li>' +
    '<li>A pen and a sheet of paper (or the Scribe\'s notes) to track flags and ideas.</li>' +
    '<li>This cheat sheet and the 5-step method, in your head or in your pocket.</li>' +
    '<li>Your school login if the event is on your own devices.</li>' +
    '</ul>' +
    '<h3>How a CTF runs</h3><ul>' +
    '<li>Challenges sit in categories, each worth points — harder ones are worth more.</li>' +
    '<li>You can do them in any order. Grab the easy points first to build confidence.</li>' +
    '<li>You submit a flag; it is instantly right or wrong. Wrong guesses usually cost nothing, so try.</li>' +
    '<li>A live scoreboard shows every team\'s score. It moves all the way to the end — never give up.</li>' +
    '</ul></div>' +
    '<div><h3>Golden rules on the day</h3><ul>' +
    '<li><b>Read the challenge twice</b> before you touch a tool.</li>' +
    '<li><b>Share what you learn.</b> A trick on one challenge often unlocks another.</li>' +
    '<li><b>Watch the format</b> — right word, wrong shape is the commonest miss.</li>' +
    '<li><b>Mind the clock</b> and keep easy flags flowing.</li>' +
    '<li><b>No hints at the event</b> — but everything on this site has prepared you for that.</li>' +
    '</ul>' +
    '<h3>Feeling nervous? That\'s normal</h3><p>Every team starts not knowing where to look. The ones who do well are not the cleverest — they are the ones who stay calm, read carefully, and keep trying the next thing. You have practised all of this. Trust it.</p></div>' +
    '</div>';

  return '<div class="ref-head"><h1>Classroom pack</h1>' +
    '<button class="btn primary no-print" id="printAllPack">🖨 Print the whole pack</button></div>' +
    '<p>Ready-to-print handouts for the lead-up to the event. Print one at a time with the button on each, or the whole set at once. Designed to print clean in black and white.</p>' +
    handout('flag', '🚩 Flag format — pin this up', flag) +
    handout('method', '🧭 The 5-step method', method) +
    handout('cheat', '🔎 Spot-it-fast cheat sheet', cheat) +
    handout('tools', '🧰 Toolkit quick-reference', tools) +
    handout('roles', '👥 Team role cards (cut out)', roleCards) +
    handout('onday', '📅 On the day — what to bring &amp; expect', onday);
};
