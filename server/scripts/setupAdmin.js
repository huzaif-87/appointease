require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../src/config/db');
const { User } = require('../src/models');

const ADMIN_EMAIL = 'sharukshaik631@gmail.com';

const promptPassword = () => {
  return new Promise((resolve) => {
    if (process.env.ADMIN_PASSWORD) {
      return resolve(process.env.ADMIN_PASSWORD.trim());
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Masked / muted input for password entry
    process.stdout.write('Enter secure password for admin account (sharukshaik631@gmail.com): ');
    let pass = '';
    
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', function handler(char) {
        char = char + '';
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', handler);
            console.log('\n[Secure Input] Password received.');
            rl.close();
            resolve(pass.trim());
            break;
          case '\u0003':
            process.exit(1);
            break;
          default:
            pass += char;
            break;
        }
      });
    } else {
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
};

const setupAdmin = async () => {
  try {
    const rawPassword = await promptPassword();
    if (!rawPassword || rawPassword.length < 6) {
      console.error('[Error] Password must be at least 6 characters long.');
      process.exit(1);
    }

    await connectDB();

    let user = await User.findOne({ email: ADMIN_EMAIL });
    if (user) {
      user.password = rawPassword;
      user.role = 'ADMIN';
      if (!user.name) user.name = 'Sharuk Shaik';
      await user.save();
      console.log(`[Success] Existing user '${ADMIN_EMAIL}' updated to role 'ADMIN' with secure bcrypt hash.`);
    } else {
      user = await User.create({
        name: 'Sharuk Shaik',
        email: ADMIN_EMAIL,
        password: rawPassword,
        role: 'ADMIN',
        phone: '+91 98110 09999'
      });
      console.log(`[Success] New ADMIN account '${ADMIN_EMAIL}' created with role 'ADMIN' and secure bcrypt hash.`);
    }

    // Verify password verification works
    const isMatch = await bcrypt.compare(rawPassword, user.password);
    if (!isMatch) {
      throw new Error('Hash verification check failed.');
    }
    console.log('[Verification] Bcrypt hash verification passed: Password matches.');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('[Error] Failed to setup admin account:', err.message);
    process.exit(1);
  }
};

setupAdmin();
