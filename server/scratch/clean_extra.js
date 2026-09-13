require('dotenv').config();
const { connectDB } = require('../src/config/db');
const { Appointment } = require('../src/models');

async function clean() {
  await connectDB();
  const ids = [
    '6aa6a070c1b217a3e3502a16',
    '6aa69fdbc1b217a3e350298e',
    '6aa69f6dc1b217a3e35028c8',
    '6aa6987401ef1a57cb16f1bf',
    '6aa6a7e9409f6d0701c985cf'
  ];
  await Appointment.deleteMany({ _id: { $in: ids } });
  const count = await Appointment.countDocuments();
  console.log('CURRENT APPOINTMENTS IN DB:', count);
  process.exit(0);
}

clean();
