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
