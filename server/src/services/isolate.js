// isolate-test.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

resend.emails.send({
  from: 'Appointees <onboarding@resend.dev>',
  to: 'sharukshaik631@gmail.com',
  subject: 'Isolated Resend test',
  html: '<p>Testing directly, no app logic involved</p>',
})
  .then(result => console.log('RESULT:', JSON.stringify(result, null, 2)))
  .catch(err => console.error('ERROR:', err));