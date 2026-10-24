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
