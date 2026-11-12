const https = require('https');

const emails = [
  'harsh02v@gmail.com',
  'poornachandram661@gmail.com',
  'test@gmail.com'
];

let done = 0;
emails.forEach(email => {
  const url = `https://student-avaibility-form.vercel.app/api/user/status?email=${email}`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.found) {
          console.log(`[OK] ${email} -> ${json.user.fullName}, ${json.user.totalPoints} pts, ${json.claimedRewards.length} rewards`);
        } else if (json.error) {
          console.log(`[ERROR] ${email} -> ${json.error}`);
        } else {
          console.log(`[NOT FOUND] ${email}`);
        }
      } catch (e) {
        console.log(`[PARSE ERROR] ${email} -> ${data.substring(0, 200)}`);
      }
      if (++done === emails.length) process.exit(0);
    });
  }).on('error', (e) => {
    console.error(`[FAIL] ${email} -> ${e.message}`);
    if (++done === emails.length) process.exit(1);
  });
});
