const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * High-quality synthetic dataset generator for AppointEase
 * Fully consistent relational data for Users, Services, Providers, Availabilities, and Appointments.
 */

const generateSyntheticDataset = async () => {
  console.log('[Seed] Generating synthetic dataset...');

  // Common default hashed password for demo users
  const salt = await bcrypt.genSalt(10);
  const defaultHashedPassword = await bcrypt.hash('Password@123', salt);

  // -------------------------------------------------------------
  // 1. SERVICES (18 distinct realistic services)
  // -------------------------------------------------------------
  const serviceTemplates = [
    {
      name: 'General Health Consultation',
      category: 'General Consultation',
      durationMinutes: 30,
      price: 500,
      description: 'Comprehensive physical examination and general health evaluation by a senior physician.'
    },
    {
      name: 'Preventive Executive Health Check',
      category: 'General Consultation',
      durationMinutes: 45,
      price: 850,
      description: 'Detailed wellness consultation with metabolic risk profile assessment and lifestyle guidance.'
    },
    {
      name: 'Comprehensive Cardiology Consultation',
      category: 'Cardiology Consultation',
      durationMinutes: 45,
      price: 1200,
      description: 'Clinical evaluation of heart disease, chest symptoms, ECG review, and cardiac risk assessment.'
    },
    {
      name: 'Hypertension & Lipid Review',
      category: 'Cardiology Consultation',
      durationMinutes: 30,
      price: 900,
      description: 'Specialized follow-up for blood pressure regulation and cholesterol monitoring.'
    },
    {
      name: 'Clinical Dermatology Consultation',
      category: 'Dermatology Consultation',
      durationMinutes: 30,
      price: 800,
      description: 'Expert diagnosis and management of skin rashes, infections, eczema, and psoriasis.'
    },
    {
      name: 'Acne & Skin Aesthetics Assessment',
      category: 'Dermatology Consultation',
      durationMinutes: 30,
      price: 1000,
      description: 'Personalized aesthetic skin evaluation, acne therapy planning, and pigmentation consultation.'
    },
    {
      name: 'Comprehensive Dental Examination & Cleaning',
      category: 'Dental Consultation',
      durationMinutes: 45,
      price: 750,
      description: 'Full oral prophylaxis, periodontal charting, cavity inspection, and hygiene advice.'
    },
    {
      name: 'Orthodontic & Smile Alignment Review',
      category: 'Dental Consultation',
      durationMinutes: 30,
      price: 950,
      description: 'Assessment for dental braces, clear aligners, and bite correction.'
    },
    {
      name: 'Orthopedic Joint & Bone Consultation',
      category: 'Orthopedic Consultation',
      durationMinutes: 30,
      price: 1000,
      description: 'Evaluation of arthritis, joint pain, osteoporosis, and musculoskeletal mobility disorders.'
    },
    {
      name: 'Spine & Sports Injury Consultation',
      category: 'Orthopedic Consultation',
      durationMinutes: 45,
      price: 1250,
      description: 'Specialist assessment of ligament tears, acute sports trauma, and lower back disorders.'
    },
    {
      name: 'Musculoskeletal Physiotherapy Session',
      category: 'Physiotherapy',
      durationMinutes: 45,
      price: 800,
      description: 'Targeted physical rehabilitation for muscle strain, neck stiffness, and joint mobilization.'
    },
    {
      name: 'Post-Surgical Rehabilitation Therapy',
      category: 'Physiotherapy',
      durationMinutes: 60,
      price: 1100,
      description: 'Supervised recovery exercises and mobility conditioning following orthopedic or spine surgery.'
    },
    {
      name: 'Clinical Diet & Nutrition Counseling',
      category: 'Nutrition Consultation',
      durationMinutes: 45,
      price: 700,
      description: 'Dietary therapy for diabetic management, gastrointestinal health, and micronutrient balance.'
    },
    {
      name: 'Weight & Metabolic Lifestyle Consultation',
      category: 'Nutrition Consultation',
      durationMinutes: 30,
      price: 600,
      description: 'Customized caloric intake planning, body composition review, and metabolic optimization.'
    },
    {
      name: 'Cognitive Behavioral Therapy (CBT) Session',
      category: 'Mental Wellness Consultation',
      durationMinutes: 60,
      price: 1500,
      description: 'Evidence-based psychotherapy for anxiety, depressive episodes, and cognitive restructuring.'
    },
    {
      name: 'Stress & Work-Life Counseling',
      category: 'Mental Wellness Consultation',
      durationMinutes: 45,
      price: 1200,
      description: 'Confidential psychological guidance for burnout, interpersonal strain, and sleep disturbances.'
    },
    {
      name: 'Pediatric Growth & Developmental Wellness',
      category: 'Pediatric Consultation',
      durationMinutes: 30,
      price: 750,
      description: 'Routine child wellness screening, immunization scheduling, and developmental milestones tracking.'
    },
    {
      name: 'Comprehensive Eye Examination & Vision Check',
      category: 'Ophthalmology Consultation',
      durationMinutes: 30,
      price: 650,
      description: 'Refraction assessment, intraocular pressure screening, and digital eye strain evaluation.'
    }
  ];

  const services = serviceTemplates.map((s) => ({
    _id: new mongoose.Types.ObjectId(),
    name: s.name,
    category: s.category,
    durationMinutes: s.durationMinutes,
    price: s.price,
    description: s.description,
    status: 'ACTIVE'
  }));

  // Create lookup map of services by category
  const servicesByCategory = {};
  services.forEach((s) => {
    if (!servicesByCategory[s.category]) {
      servicesByCategory[s.category] = [];
    }
    servicesByCategory[s.category].push(s);
  });

  // -------------------------------------------------------------
  // 2. USERS (40 Fictional Users: 35 Patients, 3 Providers, 2 Admins)
  // -------------------------------------------------------------
  const patientNames = [
    'Aarav Sharma', 'Diya Patel', 'Rohan Iyer', 'Ananya Nair', 'Rajesh Kumar',
    'Sneha Reddy', 'Vikram Joshi', 'Priya Menon', 'Kavita Verma', 'Arjun Nambiar',
    'Meera Deshmukh', 'Aditya Kulkarni', 'Pooja Chawla', 'Siddharth Rao', 'Tanvi Sengupta',
    'Manish Kapoor', 'Sunita Bhatia', 'Gaurav Hegde', 'Shruti Mukherjee', 'Karan Sethi',
    'Neha Aggarwal', 'Vivek Pillai', 'Deepa Swaminathan', 'Ramesh Srinivasan', 'Archana Roy',
    'Nikhil Bhatt', 'Divya Sundaram', 'Sanjay Gokhale', 'Swati Mahajan', 'Harish Chandra',
    'Ritu Mathur', 'Tarun Mittal', 'Jyoti Bansal', 'Alok Pandey', 'Anita Singhania'
  ];

  const users = [];

  // Admins
  users.push(
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Admin Operational Supervisor',
      email: 'admin.support@appointease.com',
      password: defaultHashedPassword,
      role: 'ADMIN',
      phone: '+91 98110 01100'
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Clinical Governance Manager',
      email: 'governance.admin@appointease.com',
      password: defaultHashedPassword,
      role: 'ADMIN',
      phone: '+91 98110 01101'
    }
  );

  // Provider User Accounts
  users.push(
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Dr. Suresh Varma',
      email: 'dr.suresh.varma@appointease.com',
      password: defaultHashedPassword,
      role: 'PROVIDER',
      phone: '+91 98220 12345'
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Dr. Radhika Krishnan',
      email: 'dr.radhika.krishnan@appointease.com',
      password: defaultHashedPassword,
      role: 'PROVIDER',
      phone: '+91 98220 12346'
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Dr. Meenakshi Sundaram',
      email: 'dr.meenakshi.sundaram@appointease.com',
      password: defaultHashedPassword,
      role: 'PROVIDER',
      phone: '+91 98220 12347'
    }
  );

  // Patient Users (35)
  patientNames.forEach((name, idx) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '.');
    users.push({
      _id: new mongoose.Types.ObjectId(),
      name,
      email: `${slug}@example.com`,
      password: defaultHashedPassword,
      role: 'PATIENT',
      phone: `+91 98${String(10000000 + idx).slice(0, 8)}`
    });
  });

  // -------------------------------------------------------------
  // 3. PROVIDERS (35 Fictional Providers across Indian Cities)
  // -------------------------------------------------------------
  const cities = ['Chennai', 'Bangalore', 'Hyderabad', 'Mumbai', 'Pune', 'Delhi', 'Coimbatore'];

  const providerDefinitions = [
    // General Medicine
    { name: 'Dr. Suresh Varma', specialty: 'General Medicine', qualification: 'MBBS, MD (Internal Medicine)', exp: 16, loc: 'Chennai', dur: 30, cat: 'General Consultation' },
    { name: 'Dr. Anjali Chopra', specialty: 'General Medicine', qualification: 'MBBS, DNB (Family Medicine)', exp: 11, loc: 'Bangalore', dur: 30, cat: 'General Consultation' },
    { name: 'Dr. Praveen Nair', specialty: 'General Medicine', qualification: 'MBBS, MD', exp: 14, loc: 'Coimbatore', dur: 45, cat: 'General Consultation' },
    { name: 'Dr. Rohit Singhal', specialty: 'General Medicine', qualification: 'MBBS, MD (General Medicine)', exp: 9, loc: 'Delhi', dur: 30, cat: 'General Consultation' },

    // Cardiology
    { name: 'Dr. Radhika Krishnan', specialty: 'Cardiology', qualification: 'MBBS, MD, DM (Cardiology)', exp: 19, loc: 'Chennai', dur: 45, cat: 'Cardiology Consultation' },
    { name: 'Dr. Amitav Sen', specialty: 'Cardiology', qualification: 'MBBS, MD, DNB (Cardiology)', exp: 15, loc: 'Mumbai', dur: 45, cat: 'Cardiology Consultation' },
    { name: 'Dr. Vandana Rao', specialty: 'Cardiology', qualification: 'MBBS, MD, FACC', exp: 12, loc: 'Hyderabad', dur: 30, cat: 'Cardiology Consultation' },
    { name: 'Dr. Karthik Subramaniam', specialty: 'Cardiology', qualification: 'MBBS, MD, DM', exp: 21, loc: 'Coimbatore', dur: 45, cat: 'Cardiology Consultation' },

    // Dermatology
    { name: 'Dr. Neha Shenoy', specialty: 'Dermatology', qualification: 'MBBS, MD (Dermatology, Venereology & Leprosy)', exp: 10, loc: 'Bangalore', dur: 30, cat: 'Dermatology Consultation' },
    { name: 'Dr. Farhan Merchant', specialty: 'Dermatology', qualification: 'MBBS, DVD, DDV', exp: 8, loc: 'Mumbai', dur: 30, cat: 'Dermatology Consultation' },
    { name: 'Dr. Shalini Kulkarni', specialty: 'Dermatology', qualification: 'MBBS, MD (Skin & VD)', exp: 13, loc: 'Pune', dur: 30, cat: 'Dermatology Consultation' },
    { name: 'Dr. Abhishek Saxena', specialty: 'Dermatology', qualification: 'MBBS, MD (Dermatology)', exp: 7, loc: 'Delhi', dur: 30, cat: 'Dermatology Consultation' },

    // Dental Surgery
    { name: 'Dr. Pooja Balakrishnan', specialty: 'Dental Surgery', qualification: 'BDS, MDS (Prosthodontics)', exp: 12, loc: 'Chennai', dur: 45, cat: 'Dental Consultation' },
    { name: 'Dr. Sameer Godbole', specialty: 'Dental Surgery', qualification: 'BDS, MDS (Orthodontics)', exp: 14, loc: 'Pune', dur: 30, cat: 'Dental Consultation' },
    { name: 'Dr. Monisha Reddy', specialty: 'Dental Surgery', qualification: 'BDS, MDS (Conservative Dentistry)', exp: 9, loc: 'Hyderabad', dur: 45, cat: 'Dental Consultation' },
    { name: 'Dr. Chirag Dave', specialty: 'Dental Surgery', qualification: 'BDS', exp: 6, loc: 'Mumbai', dur: 30, cat: 'Dental Consultation' },

    // Orthopedics
    { name: 'Dr. Meenakshi Sundaram', specialty: 'Orthopedics', qualification: 'MBBS, MS (Orthopedics), MCh', exp: 22, loc: 'Chennai', dur: 30, cat: 'Orthopedic Consultation' },
    { name: 'Dr. Raghavendra Bhat', specialty: 'Orthopedics', qualification: 'MBBS, MS (Ortho), DNB', exp: 17, loc: 'Bangalore', dur: 45, cat: 'Orthopedic Consultation' },
    { name: 'Dr. Hemant Deshpande', specialty: 'Orthopedics', qualification: 'MBBS, MS (Orthopedics)', exp: 13, loc: 'Pune', dur: 30, cat: 'Orthopedic Consultation' },
    { name: 'Dr. Sandeep Aggarwal', specialty: 'Orthopedics', qualification: 'MBBS, D.Ortho, DNB', exp: 11, loc: 'Delhi', dur: 45, cat: 'Orthopedic Consultation' },

    // Physiotherapy
    { name: 'Dr. Preeti Ganguly', specialty: 'Physiotherapy', qualification: 'BPT, MPT (Musculoskeletal)', exp: 10, loc: 'Bangalore', dur: 45, cat: 'Physiotherapy' },
    { name: 'Dr. Anand Ramanathan', specialty: 'Physiotherapy', qualification: 'BPT, MPT (Sports Rehabilitation)', exp: 8, loc: 'Chennai', dur: 60, cat: 'Physiotherapy' },
    { name: 'Dr. Vinod Gaikwad', specialty: 'Physiotherapy', qualification: 'BPT, MPT (Neuro-Physiotherapy)', exp: 12, loc: 'Pune', dur: 45, cat: 'Physiotherapy' },
    { name: 'Dr. Bhavna Mehta', specialty: 'Physiotherapy', qualification: 'BPT, MIAP', exp: 9, loc: 'Mumbai', dur: 45, cat: 'Physiotherapy' },

    // Nutrition & Dietetics
    { name: 'Dr. Shilpa Venkat', specialty: 'Clinical Nutrition', qualification: 'M.Sc (Food & Nutrition), Ph.D, RD', exp: 11, loc: 'Hyderabad', dur: 45, cat: 'Nutrition Consultation' },
    { name: 'Dr. Nalini Viswanathan', specialty: 'Clinical Nutrition', qualification: 'M.Sc (Dietetics), CDE', exp: 14, loc: 'Coimbatore', dur: 30, cat: 'Nutrition Consultation' },
    { name: 'Dr. Gauri Shinde', specialty: 'Clinical Nutrition', qualification: 'Post Graduate Diploma in Clinical Nutrition', exp: 7, loc: 'Pune', dur: 45, cat: 'Nutrition Consultation' },

    // Mental Wellness / Psychiatry
    { name: 'Dr. Tarun Bharadwaj', specialty: 'Psychiatry & Wellness', qualification: 'MBBS, MD (Psychiatry)', exp: 15, loc: 'Delhi', dur: 60, cat: 'Mental Wellness Consultation' },
    { name: 'Dr. Shobhana Prasad', specialty: 'Clinical Psychology', qualification: 'M.Phil, Ph.D in Clinical Psychology', exp: 13, loc: 'Bangalore', dur: 45, cat: 'Mental Wellness Consultation' },
    { name: 'Dr. Kiranmoy Roy', specialty: 'Psychiatry & Wellness', qualification: 'MBBS, DPM, MD', exp: 18, loc: 'Mumbai', dur: 60, cat: 'Mental Wellness Consultation' },

    // Pediatrics
    { name: 'Dr. Geeta Natarajan', specialty: 'Pediatrics', qualification: 'MBBS, MD (Pediatrics), DCH', exp: 16, loc: 'Chennai', dur: 30, cat: 'Pediatric Consultation' },
    { name: 'Dr. Deepak Somani', specialty: 'Pediatrics', qualification: 'MBBS, DNB (Pediatrics)', exp: 10, loc: 'Delhi', dur: 30, cat: 'Pediatric Consultation' },
    { name: 'Dr. Lakshmi Narayanan', specialty: 'Pediatrics', qualification: 'MBBS, MD (Pediatrics)', exp: 14, loc: 'Coimbatore', dur: 30, cat: 'Pediatric Consultation' },

    // Ophthalmology
    { name: 'Dr. Venkatesh Murthy', specialty: 'Ophthalmology', qualification: 'MBBS, MS (Ophthalmology)', exp: 19, loc: 'Bangalore', dur: 30, cat: 'Ophthalmology Consultation' },
    { name: 'Dr. Pallavi Tiwari', specialty: 'Ophthalmology', qualification: 'MBBS, DNB (Ophthal), FICO', exp: 11, loc: 'Hyderabad', dur: 30, cat: 'Ophthalmology Consultation' }
  ];

  const providers = providerDefinitions.map((def, idx) => {
    const slug = def.name.toLowerCase().replace(/[^a-z0-9]/g, '.');
    const matchedServices = servicesByCategory[def.cat] || [services[0]];
    const assignedServiceIds = matchedServices.map((s) => s._id);

    return {
      _id: new mongoose.Types.ObjectId(),
      name: def.name,
      email: `${slug}@appointease.com`,
      phone: `+91 97${String(20000000 + idx).slice(0, 8)}`,
      specialty: def.specialty,
      qualification: def.qualification,
      experienceYears: def.exp,
      bio: `Renowned specialist in ${def.specialty} with ${def.exp} years of dedicated clinical practice in ${def.loc}. Committed to patient-centered care and evidence-based diagnosis.`,
      location: def.loc,
      serviceIds: assignedServiceIds,
      consultationDuration: def.dur,
      status: idx === 33 || idx === 34 ? 'INACTIVE' : 'ACTIVE' // 33 active, 2 inactive
    };
  });

  // -------------------------------------------------------------
  // 4. AVAILABILITY (Weekly recurring schedules for active providers)
  // -------------------------------------------------------------
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const availabilities = [];

  // Shift schedule configurations
  const shiftConfigs = [
    { start: '09:00', end: '13:00' }, // Morning Shift
    { start: '09:00', end: '17:00' }, // Full Day Shift
    { start: '10:00', end: '18:00' }, // Standard Shift
    { start: '14:00', end: '19:00' }, // Afternoon/Evening Shift
    { start: '08:30', end: '14:30' }  // Early Shift
  ];

  const activeProviders = providers.filter((p) => p.status === 'ACTIVE');

  // Map to index provider availability by day for quick lookup when scheduling appointments
  const providerAvailabilityMap = new Map();

  activeProviders.forEach((provider, pIdx) => {
    // Select 4 to 6 working days
    const workingDaysCount = 4 + (pIdx % 3); // 4, 5, or 6 days
    const selectedDays = daysOfWeek.slice(0, workingDaysCount);
    const shift = shiftConfigs[pIdx % shiftConfigs.length];

    if (!providerAvailabilityMap.has(provider._id.toString())) {
      providerAvailabilityMap.set(provider._id.toString(), []);
    }

    selectedDays.forEach((day) => {
      const avail = {
        _id: new mongoose.Types.ObjectId(),
        providerId: provider._id,
        dayOfWeek: day,
        startTime: shift.start,
        endTime: shift.end,
        slotDurationMinutes: provider.consultationDuration,
        isActive: true
      };

      availabilities.push(avail);
      providerAvailabilityMap.get(provider._id.toString()).push(avail);
    });
  });

  // -------------------------------------------------------------
  // 5. APPOINTMENTS (140 realistic past & future appointments)
  // -------------------------------------------------------------
  const appointments = [];
  const patientUsers = users.filter((u) => u.role === 'PATIENT');
  const bookedSlotsTracker = new Set(); // Key: `${providerId}_${dateString}_${startTime}`

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Reference date: Current simulation date
  const now = new Date('2026-09-12T12:00:00.000Z');

  // Helper to parse "HH:MM" into minutes
  const timeToMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  // Helper to format minutes into "HH:MM"
  const minutesToTime = (min) => {
    const h = String(Math.floor(min / 60)).padStart(2, '0');
    const m = String(min % 60).padStart(2, '0');
    return `${h}:${m}`;
  };

  let appointmentCounter = 1001;

  // We want ~140 appointments: ~80 historical (past 28 days), ~60 upcoming (next 21 days)
  // Generate candidate dates
  const dateOffsets = [];
  // Past dates: -28 to -1
  for (let i = -28; i <= -1; i++) {
    dateOffsets.push(i);
    if (i % 2 === 0) dateOffsets.push(i); // Give extra weight to recent past
  }
  // Upcoming dates: 1 to 21
  for (let i = 1; i <= 21; i++) {
    dateOffsets.push(i);
    if (i % 2 === 0) dateOffsets.push(i); // Extra weight
  }

  // Shuffle date offsets deterministically
  dateOffsets.sort((a, b) => (Math.sin(a * 17) > Math.sin(b * 17) ? 1 : -1));

  let offsetIdx = 0;
  let pCursor = 0;

  while (appointments.length < 145 && offsetIdx < dateOffsets.length * 3) {
    const offset = dateOffsets[offsetIdx % dateOffsets.length];
    offsetIdx++;

    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + offset);
    // Normalize time to midnight UTC for clean date comparisons
    targetDate.setUTCHours(0, 0, 0, 0);

    const dayName = dayNames[targetDate.getUTCDay()];
    if (dayName === 'Sunday') continue; // Sunday off for most demo schedules

    // Select provider round-robin
    const provider = activeProviders[pCursor % activeProviders.length];
    pCursor++;

    const providerAvails = providerAvailabilityMap.get(provider._id.toString()) || [];
    const matchingAvail = providerAvails.find((a) => a.dayOfWeek === dayName && a.isActive);

    if (!matchingAvail) continue; // Provider does not work on this day

    const startMin = timeToMinutes(matchingAvail.startTime);
    const endMin = timeToMinutes(matchingAvail.endTime);
    const duration = matchingAvail.slotDurationMinutes;

    // Calculate possible slots
    const possibleSlots = [];
    for (let m = startMin; m + duration <= endMin; m += duration) {
      possibleSlots.push({
        start: minutesToTime(m),
        end: minutesToTime(m + duration)
      });
    }

    if (possibleSlots.length === 0) continue;

    // Pick a slot based on pseudo-random hash
    const slotIdx = Math.abs(Math.floor(Math.sin(offset * 31 + pCursor * 7) * possibleSlots.length));
    const chosenSlot = possibleSlots[slotIdx % possibleSlots.length];

    const dateStr = targetDate.toISOString().split('T')[0];
    const slotKey = `${provider._id}_${dateStr}_${chosenSlot.start}`;

    if (bookedSlotsTracker.has(slotKey)) {
      continue; // Prevent duplicate appointment collision
    }

    bookedSlotsTracker.add(slotKey);

    // Pick a patient user
    const user = patientUsers[(appointments.length + offsetIdx) % patientUsers.length];

    // Pick a service from provider's serviceIds
    const serviceId = provider.serviceIds[appointments.length % provider.serviceIds.length];

    // Determine status:
    const isPast = offset < 0;
    let status = 'CONFIRMED';
    let cancellationReason = null;
    let cancelledAt = null;

    if (isPast) {
      // Historical distribution: COMPLETED (~75%), NO_SHOW (~15%), CANCELLED (~10%)
      const roll = (appointments.length * 13) % 100;
      if (roll < 75) {
        status = 'COMPLETED';
      } else if (roll < 90) {
        status = 'NO_SHOW';
      } else {
        status = 'CANCELLED';
        cancellationReason = 'Patient requested cancellation due to scheduling conflict';
        const cancelDate = new Date(targetDate);
        cancelDate.setDate(targetDate.getDate() - 1);
        cancelledAt = cancelDate;
      }
    } else {
      // Upcoming distribution: CONFIRMED (~90%), CANCELLED (~10%)
      const roll = (appointments.length * 19) % 100;
      if (roll < 90) {
        status = 'CONFIRMED';
      } else {
        status = 'CANCELLED';
        cancellationReason = 'Patient rescheduled to a later date';
        const cancelDate = new Date(now);
        cancelledAt = cancelDate;
      }
    }

    const reasons = [
      'Routine medical consultation and health checkup',
      'Follow-up visit for ongoing symptoms',
      'Consultation for preventive health evaluation',
      'Prescription renewal and diagnostic report discussion',
      'Initial consultation for specialist second opinion',
      'Chronic care management review'
    ];

    appointments.push({
      _id: new mongoose.Types.ObjectId(),
      appointmentId: `APT-2026-${appointmentCounter++}`,
      userId: user._id,
      providerId: provider._id,
      serviceId,
      appointmentDate: targetDate,
      startTime: chosenSlot.start,
      endTime: chosenSlot.end,
      status,
      reason: reasons[appointments.length % reasons.length],
      notes: status === 'COMPLETED' ? 'Consultation completed successfully. Follow-up advised if symptoms persist.' : '',
      cancellationReason,
      cancelledAt
    });
  }

  console.log(`[Seed Generator] Generated:`);
  console.log(`  - Users: ${users.length} (Patients: ${patientUsers.length}, Providers: 3, Admins: 2)`);
  console.log(`  - Services: ${services.length}`);
  console.log(`  - Providers: ${providers.length} (Active: ${activeProviders.length}, Inactive: 2)`);
  console.log(`  - Availabilities: ${availabilities.length}`);
  console.log(`  - Appointments: ${appointments.length}`);

  return {
    users,
    services,
    providers,
    availabilities,
    appointments
  };
};

module.exports = {
  generateSyntheticDataset
};
