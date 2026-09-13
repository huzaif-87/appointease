require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { User } = require('../src/models');

const ADMIN_EMAIL = 'sharukshaik631@gmail.com';

const run = async () => {
  try {
    await connectDB();

    // Generate secure cryptographically random password
    const securePass = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, 'a') + '!A1';

    let user = await User.findOne({ email: ADMIN_EMAIL });
    if (user) {
      user.password = securePass;
      user.role = 'ADMIN';
      if (!user.name) user.name = 'Sharuk Shaik';
      await user.save();
      console.log(`[Admin Account] Existing user '${ADMIN_EMAIL}' role set to 'ADMIN' with new bcrypt hash.`);
    } else {
      user = await User.create({
        name: 'Sharuk Shaik',
        email: ADMIN_EMAIL,
        password: securePass,
        role: 'ADMIN',
        phone: '+91 98110 09999'
      });
      console.log(`[Admin Account] Created new user '${ADMIN_EMAIL}' with role 'ADMIN' and bcrypt hash.`);
    }

    // Verify hash integrity in-memory
    const match = await bcrypt.compare(securePass, user.password);
    if (!match) throw new Error('Bcrypt verification failed');
    console.log('[Admin Account] Bcrypt hash self-verification: SUCCESS (Password matches hash).');

    // Test authentication against JWT logic
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET || 'development_appointease_secret_key_change_in_prod',
      { expiresIn: '24h' }
    );
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'development_appointease_secret_key_change_in_prod');
    if (decoded.role !== 'ADMIN' || decoded.email !== ADMIN_EMAIL) {
      throw new Error(`Token verification failed. Role: ${decoded.role}`);
    }
    console.log(`[Admin Account] JWT role verification: SUCCESS (role=${decoded.role}, email=${decoded.email})`);

    // Write password ONLY to a secure, local-only, gitignored file so the user can use it
    const fs = require('fs');
    const path = require('path');
    const credsPath = path.join(__dirname, '..', '.admin_credentials_local');
    fs.writeFileSync(credsPath, `ADMIN_EMAIL=${ADMIN_EMAIL}\nADMIN_PASSWORD=${securePass}\n# This file is for local execution only. Do not commit.\n`, { mode: 0o600 });
    console.log(`[Admin Account] Secure temporary credentials written to local-only file: server/.admin_credentials_local`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('[Admin Account] Error setting up admin:', err.message);
    process.exit(1);
  }
};

run();
