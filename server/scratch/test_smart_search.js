const mongoose = require('mongoose');
require('dotenv').config();

const { getSmartTimeRecommendations } = require('../src/services/aiRecommendationService');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
  try {
    const res = await getSmartTimeRecommendations({
      query: 'after 5 PM this week',
      patientId: '66a123456789012345678901'
    });
    console.log('Result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
