// Runs automatically before `npm run update:production`.
// `eas update` bundles the app on THIS computer, baking in EXPO_PUBLIC_* values from
// the local environment / .env. A wrong value here would break the app for every
// customer at once, so refuse to publish anything that isn't production config.
const fs = require('fs');
const path = require('path');

const env = { ...process.env };
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && env[match[1]] === undefined) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

const problems = [];
const apiUrl = env.EXPO_PUBLIC_API_URL || '';
if (!/^https:\/\//.test(apiUrl) || /localhost|127\.0\.0\.1|192\.168\.|10\.0\./.test(apiUrl)) {
  problems.push(`EXPO_PUBLIC_API_URL must be the live https API, got "${apiUrl || '(empty)'}"`);
}
if (!(env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '').startsWith('rzp_live_')) {
  problems.push('EXPO_PUBLIC_RAZORPAY_KEY_ID must be a live key (rzp_live_…)');
}

if (problems.length) {
  console.error('\n✖ Not publishing a production update:\n  - ' + problems.join('\n  - ') + '\n');
  process.exit(1);
}
console.log(`✔ Production config OK (API: ${apiUrl})`);
