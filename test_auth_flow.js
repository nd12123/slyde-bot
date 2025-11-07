const crypto = require('crypto');

// Simulate token generation like the bot does
const telegramId = 555999;
const token = crypto.randomBytes(32).toString('hex');

console.log('Generated token:', token.substring(0, 16) + '...');
console.log('Telegram ID:', telegramId);

// Test 1: Validate token
console.log('\n=== Test 1: Validate Token ===');
fetch('http://localhost:3001/api/validate-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
})
  .then(res => res.json())
  .then(data => {
    console.log('Validation Response:', data);
    
    if (data.valid && data.telegramId) {
      // Test 2: Authenticate with Telegram ID
      console.log('\n=== Test 2: Authenticate with Telegram ID ===');
      return fetch('http://localhost:3001/functions/v1/auth-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: data.telegramId }),
      })
        .then(res => res.json())
        .then(authData => {
          console.log('Auth Response:', authData);
          
          if (authData.session && authData.user) {
            console.log('\n✅ Full flow successful!');
            console.log('Session:', authData.session);
            console.log('User:', authData.user);
          }
        });
    }
  })
  .catch(err => console.error('Error:', err.message));
