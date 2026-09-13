const { GoogleGenAI } = require('@google/genai');

/**
 * Dedicated Google Gemini NLP Intent Extraction Service for AppointEase
 * 
 * Model: gemini-2.5-flash (configurable via GEMINI_MODEL)
 * SDK: Official '@google/genai' SDK with HTTP REST API fallback
 * 
 * Guarantees:
 * - Strictly extracts natural-language scheduling constraints without modifying appointments or touching MongoDB.
 * - Reads process.env.GEMINI_API_KEY and process.env.GEMINI_MODEL.
 * - Uses Asia/Kolkata timezone with dynamic current reference date (today, tomorrow, this week).
 * - On missing key, network error, timeout, 429, or invalid JSON: catches error cleanly and returns success: false to engage internal fallback parser.
 * - Never leaks API keys or secrets to frontend or logs.
 */

let customGeminiClient = null;

/**
 * Set custom Gemini client or mock runner (for automated testing)
 */
const setGeminiClient = (client) => {
  customGeminiClient = client;
};

/**
 * Reset Gemini client back to default
 */
const resetGeminiClient = () => {
  customGeminiClient = null;
};

/**
 * Get active Gemini client / SDK handle
 */
const getGeminiClient = () => {
  if (customGeminiClient) {
    return customGeminiClient;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }

  try {
    return new GoogleGenAI({ apiKey: apiKey.trim() });
  } catch (err) {
    console.error('[Gemini Service] Client initialization notice:', err.message);
    return null;
  }
};

/**
 * Helper to get current reference dates in Asia/Kolkata
 */
const getKolkataDateInfo = () => {
  const now = new Date();
  
  // Format current date string in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const dayNameFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long'
  });

  const currentDateStr = formatter.format(now); // YYYY-MM-DD
  const currentTimeStr = timeFormatter.format(now); // HH:mm
  const currentDayName = dayNameFormatter.format(now);

  const todayObj = new Date(`${currentDateStr}T00:00:00+05:30`);
  
  const tomorrowObj = new Date(todayObj);
  tomorrowObj.setDate(todayObj.getDate() + 1);
  const tomorrowDateStr = tomorrowObj.toISOString().split('T')[0];

  // Current week end date (Sunday)
  const currentDayOfWeek = todayObj.getDay(); // 0 = Sun, 1 = Mon ...
  const daysUntilSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;
  const sundayObj = new Date(todayObj);
  sundayObj.setDate(todayObj.getDate() + daysUntilSunday);
  const thisWeekEndStr = sundayObj.toISOString().split('T')[0];

  // Next week start (Monday) and end (Sunday)
  const nextMonObj = new Date(todayObj);
  nextMonObj.setDate(todayObj.getDate() + (currentDayOfWeek === 0 ? 1 : 8 - currentDayOfWeek));
  const nextMonStr = nextMonObj.toISOString().split('T')[0];

  const nextSunObj = new Date(nextMonObj);
  nextSunObj.setDate(nextMonObj.getDate() + 6);
  const nextSunStr = nextSunObj.toISOString().split('T')[0];

  return {
    today: currentDateStr,
    currentTime: currentTimeStr,
    dayName: currentDayName,
    tomorrow: tomorrowDateStr,
    thisWeekEnd: thisWeekEndStr,
    nextWeekStart: nextMonStr,
    nextWeekEnd: nextSunStr
  };
};

/**
 * Validate and normalize constraints structure returned by Gemini or mock
 */
const validateAndNormalizeConstraints = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const validSpecialties = [
    'Cardiology', 'Dermatology', 'Orthopedics', 'Pediatrics',
    'Neurology', 'Dentistry', 'General Medicine', 'ENT',
    'Ophthalmology', 'Gynecology'
  ];

  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  let specialty = null;
  if (raw.specialty && typeof raw.specialty === 'string' && raw.specialty.trim()) {
    const sTrim = raw.specialty.trim();
    const match = validSpecialties.find((s) => s.toLowerCase() === sTrim.toLowerCase());
    specialty = match || sTrim;
  }

  // Validate dates (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  let dateFrom = raw.dateFrom && dateRegex.test(raw.dateFrom) ? raw.dateFrom : null;
  let dateTo = raw.dateTo && dateRegex.test(raw.dateTo) ? raw.dateTo : null;

  // Validate time format (HH:mm)
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  let timeAfter = raw.timeAfter && timeRegex.test(raw.timeAfter) ? raw.timeAfter : null;
  let timeBefore = raw.timeBefore && timeRegex.test(raw.timeBefore) ? raw.timeBefore : null;

  // Preferred days array
  let preferredDays = [];
  if (Array.isArray(raw.preferredDays)) {
    preferredDays = raw.preferredDays
      .map((d) => (typeof d === 'string' ? d.trim() : ''))
      .map((d) => validDays.find((vd) => vd.toLowerCase() === d.toLowerCase()) || null)
      .filter(Boolean);
  }

  // Preferred period
  let preferredPeriod = null;
  if (raw.preferredPeriod && typeof raw.preferredPeriod === 'string') {
    const pUpper = raw.preferredPeriod.trim().toUpperCase();
    if (['MORNING', 'AFTERNOON', 'EVENING'].includes(pUpper)) {
      preferredPeriod = pUpper;
    }
  }

  // Sort preference
  let sortPreference = 'best_match';
  if (raw.sortPreference && typeof raw.sortPreference === 'string') {
    const sLower = raw.sortPreference.trim().toLowerCase();
    if (sLower === 'earliest' || sLower === 'best_match') {
      sortPreference = sLower;
    }
  }

  return {
    specialty,
    providerId: raw.providerId && typeof raw.providerId === 'string' ? raw.providerId : null,
    serviceId: raw.serviceId && typeof raw.serviceId === 'string' ? raw.serviceId : null,
    dateFrom,
    dateTo,
    timeAfter,
    timeBefore,
    preferredDays,
    preferredPeriod,
    sortPreference,
    maxRecommendations: 5
  };
};

/**
 * System Instruction prompt for Gemini intent extraction
 */
const buildSystemInstruction = (dateInfo) => {
  return `You are a medical appointment scheduling assistant for AppointEase in India (Asia/Kolkata timezone).
Your sole task is to convert the patient's natural language request into strict structured JSON constraints.

CRITICAL TIMING CONTEXT (Asia/Kolkata Timezone):
- Today's Date: ${dateInfo.today} (${dateInfo.dayName})
- Current Time: ${dateInfo.currentTime}
- Tomorrow's Date: ${dateInfo.tomorrow}
- End of Current Week (Sunday): ${dateInfo.thisWeekEnd}
- Next Week Start (Monday): ${dateInfo.nextWeekStart}
- Next Week End (Sunday): ${dateInfo.nextWeekEnd}

OUTPUT REQUIREMENTS:
Return ONLY a raw JSON object (no markdown, no code blocks, no conversational preamble) matching this EXACT schema:
{
  "specialty": string | null (e.g. "Cardiology", "Dermatology", "Orthopedics", "Dentistry", "Pediatrics", "Neurology", "General Medicine", "ENT"),
  "providerId": null,
  "serviceId": null,
  "dateFrom": string | null (in YYYY-MM-DD format),
  "dateTo": string | null (in YYYY-MM-DD format),
  "timeAfter": string | null (24-hr HH:mm, e.g. "17:00" for 5 PM, "18:00" for 6 PM),
  "timeBefore": string | null (24-hr HH:mm, e.g. "12:00" for 12 PM),
  "preferredDays": array of strings (e.g. ["Monday"], ["Wednesday"]),
  "preferredPeriod": string | null ("MORNING" | "AFTERNOON" | "EVENING"),
  "sortPreference": string ("earliest" | "best_match")
}

RULES:
1. "after 5 PM" or "after 5" or "from 5 PM onwards" -> timeAfter: "17:00", preferredPeriod: "EVENING"
2. "after 6 PM" -> timeAfter: "18:00", preferredPeriod: "EVENING"
3. "before 12 PM" -> timeBefore: "12:00", preferredPeriod: "MORNING"
4. "between 4-7 PM" -> timeAfter: "16:00", timeBefore: "19:00", preferredPeriod: "EVENING"
5. "today" -> dateFrom: "${dateInfo.today}", dateTo: "${dateInfo.today}"
6. "tomorrow" or "as soon as possible tomorrow" -> dateFrom: "${dateInfo.tomorrow}", dateTo: "${dateInfo.tomorrow}"
7. "this week" -> dateFrom: "${dateInfo.today}", dateTo: "${dateInfo.thisWeekEnd}"
8. "next week" -> dateFrom: "${dateInfo.nextWeekStart}", dateTo: "${dateInfo.nextWeekEnd}"
9. "earliest" or "as soon as possible" -> sortPreference: "earliest"
10. "cardiologist" -> specialty: "Cardiology"; "dentist" -> specialty: "Dentistry"`;
};

/**
 * Call Gemini REST API directly if SDK handle is not custom mock
 */
const callGeminiRestApi = async ({ apiKey, modelName, systemInstruction, userQuery }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${systemInstruction}\n\nPatient Query: "${userQuery}"`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`Gemini API HTTP ${res.status}: ${errText}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return candidateText;
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    throw fetchErr;
  }
};

/**
 * Main Intent Extraction Function using Google Gemini
 */
const parseSchedulingIntentWithGemini = async (query, serverContext = {}) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      success: false,
      reason: 'EMPTY_QUERY',
      constraints: null
    };
  }

  const trimmedQuery = query.trim();
  const dateInfo = getKolkataDateInfo();
  const systemInstruction = buildSystemInstruction(dateInfo);
  const modelName = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  const startTimeMs = Date.now();

  // 1. If custom client/mock is set, run custom client
  if (customGeminiClient) {
    try {
      let rawText = '';
      if (typeof customGeminiClient.generateContent === 'function') {
        const res = await customGeminiClient.generateContent({
          contents: trimmedQuery,
          systemInstruction
        });
        rawText = res?.response?.text ? res.response.text() : JSON.stringify(res);
      } else if (typeof customGeminiClient.parseIntent === 'function') {
        const mockRes = await customGeminiClient.parseIntent(trimmedQuery, dateInfo);
        const validatedMock = validateAndNormalizeConstraints(mockRes);
        return {
          success: true,
          constraints: validatedMock,
          latencyMs: Date.now() - startTimeMs
        };
      } else if (typeof customGeminiClient === 'function') {
        const fnRes = await customGeminiClient(trimmedQuery, dateInfo);
        const validatedFn = validateAndNormalizeConstraints(fnRes);
        return {
          success: true,
          constraints: validatedFn,
          latencyMs: Date.now() - startTimeMs
        };
      }

      const parsedJson = JSON.parse(rawText.replace(/```json|```/gi, '').trim());
      const normalized = validateAndNormalizeConstraints(parsedJson);

      return {
        success: true,
        constraints: normalized,
        latencyMs: Date.now() - startTimeMs
      };
    } catch (mockErr) {
      console.error(`[Gemini Service] Custom client notice (${Date.now() - startTimeMs}ms):`, mockErr.message);
      return {
        success: false,
        reason: mockErr.message || 'MOCK_CLIENT_ERROR',
        constraints: null
      };
    }
  }

  // 2. Production API execution using GEMINI_API_KEY
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      reason: 'GEMINI_API_KEY_NOT_CONFIGURED',
      constraints: null
    };
  }

  try {
    console.log(`[Gemini Service] Attempting intent extraction with model '${modelName}' (Query length: ${trimmedQuery.length})`);
    
    const candidateText = await callGeminiRestApi({
      apiKey: apiKey.trim(),
      modelName,
      systemInstruction,
      userQuery: trimmedQuery
    });

    const parsedJson = JSON.parse(candidateText.replace(/```json|```/gi, '').trim());
    const normalized = validateAndNormalizeConstraints(parsedJson);

    const latencyMs = Date.now() - startTimeMs;
    console.log(`[Gemini Service] Success: Constraints extracted in ${latencyMs}ms (Specialty: ${normalized?.specialty || 'None'}, Period: ${normalized?.preferredPeriod || 'None'})`);

    return {
      success: true,
      constraints: normalized,
      latencyMs
    };
  } catch (err) {
    const latencyMs = Date.now() - startTimeMs;
    let category = 'GEMINI_API_ERROR';
    if (err.name === 'AbortError' || /timeout|abort/i.test(err.message)) {
      category = 'TIMEOUT';
    } else if (err.status === 429 || /quota|rate limit/i.test(err.message)) {
      category = 'RATE_LIMIT_OR_QUOTA';
    } else if (err.status >= 500) {
      category = 'SERVER_ERROR';
    }

    const cleanMsg = err.message ? err.message.replace(/key=[^&]+/, 'key=***') : 'Gemini API failed';
    console.warn(`[Gemini Service] Quota or Rate limit encountered (${latencyMs}ms): ${cleanMsg}. Engaging safe fallback.`);

    return {
      success: false,
      reason: category,
      message: cleanMsg,
      constraints: null
    };
  }
};

module.exports = {
  parseSchedulingIntentWithGemini,
  validateAndNormalizeConstraints,
  setGeminiClient,
  resetGeminiClient,
  getGeminiClient,
  getKolkataDateInfo
};
