import { query, queryOne } from './db.js';

const NIMROBO_API_KEY = process.env.NIMROBO_API_KEY;
const NIMROBO_BASE_URL = 'https://app.nimroboai.com';

interface StartInterviewInput {
  niche: string;
}

interface Session {
  id: string;
  user_id: string;
  nimrobo_session_id: string | null;
  nimrobo_link: string | null;
  status: string;
  transcript: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function handleStartInterview(
  userId: string,
  input: StartInterviewInput
): Promise<{ session_id?: string; session_url?: string; error?: string }> {
  const { niche } = input;

  if (!NIMROBO_API_KEY) {
    return { error: 'NIMROBO_API_KEY is not configured' };
  }

  console.log(`Starting Nimrobo session for user ${userId} with niche: ${niche}`);

  // Create instant voice link using Nimrobo API
  const nimroboResponse = await fetch(`${NIMROBO_BASE_URL}/api/v1/instant-voice-links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NIMROBO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      labels: [`Passion Interview: ${niche}`],
      expiryPreset: '1_day',
      prompt: `You are a friendly interviewer helping discover someone's passion for "${niche}".
Ask open-ended questions about:
- How they discovered this interest
- What specifically excites them about it
- Their favorite experiences or projects
- Who inspires them in this space
- What they'd love to explore next

Keep it conversational, warm, and curious. Listen actively and ask follow-ups.
The goal is to understand their personality traits and passion level.
Keep the interview to about 3-5 minutes.`,
      landingPageTitle: `Let's Talk About ${niche}`,
      landingPageInfo:
        'Share your passion with our AI interviewer. This conversation will help us understand what makes you unique.',
      timeLimitMinutes: 5,
    }),
  });

  if (!nimroboResponse.ok) {
    const errorText = await nimroboResponse.text();
    console.error('Nimrobo API error:', nimroboResponse.status, errorText);
    return { error: `Nimrobo API error: ${nimroboResponse.status} - ${errorText}` };
  }

  const nimroboData = await nimroboResponse.json();
  console.log('Nimrobo session created:', nimroboData);

  // Extract the voice link from response
  const linkObj =
    nimroboData.links?.[0] ?? nimroboData.voiceLinks?.[0] ?? nimroboData.voice_links?.[0];
  if (!linkObj) {
    return { error: 'No voice link returned from Nimrobo' };
  }

  const sessionUrl: string | null =
    linkObj.url ??
    linkObj.link ??
    (linkObj.token ? `${NIMROBO_BASE_URL}/link/${linkObj.token}` : null);

  if (!sessionUrl) {
    console.error('Nimrobo link object missing URL/token:', linkObj);
    return { error: 'Nimrobo response missing a usable session URL' };
  }

  const sessionId: string = linkObj.id ?? linkObj.token;

  // Save session to database
  await query(
    `INSERT INTO sessions (user_id, nimrobo_session_id, nimrobo_link, status)
     VALUES ($1, $2, $3, 'pending')`,
    [userId, sessionId, sessionUrl]
  );

  return {
    session_id: sessionId,
    session_url: sessionUrl,
  };
}

function tokenFromLink(nimroboLink: string | null): string | null {
  if (!nimroboLink) return null;
  const match = nimroboLink.match(/\/link\/([^/?#]+)/);
  return match?.[1] ?? null;
}

async function listInstantVoiceLinks() {
  return fetch(`${NIMROBO_BASE_URL}/api/v1/instant-voice-links`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${NIMROBO_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
}

async function fetchStatus(sessionId: string) {
  const url = `${NIMROBO_BASE_URL}/api/v1/session/status?sessionId=${encodeURIComponent(sessionId)}&type=instant`;
  return fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${NIMROBO_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
}

async function fetchTranscript(sessionId: string) {
  const url = `${NIMROBO_BASE_URL}/api/v1/session/transcript?sessionId=${encodeURIComponent(sessionId)}&type=instant`;
  return fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${NIMROBO_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeTranscript(transcript: unknown): string | null {
  if (!transcript) return null;
  if (typeof transcript === 'string') return transcript;
  if (Array.isArray(transcript)) {
    return transcript
      .filter((e: { role?: string; content?: string }) => e?.role && e?.content)
      .map((e: { role: string; content: string }) => `${e.role}: ${e.content}`)
      .join('\n');
  }
  return JSON.stringify(transcript);
}

export async function handleCheckInterviewStatus(userId: string): Promise<{
  status: string;
  message?: string;
  transcript?: string | null;
  session_id?: string;
  nimrobo_link_id?: string;
  nimrobo_session_id?: string | null;
  linkStatus?: string;
  debug?: unknown;
  error?: string;
}> {
  if (!NIMROBO_API_KEY) {
    return { status: 'error', error: 'NIMROBO_API_KEY is not configured' };
  }

  // Get the user's latest pending/active session
  const session = await queryOne<Session>(
    `SELECT * FROM sessions
     WHERE user_id = $1 AND status IN ('pending', 'active')
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (!session) {
    return {
      status: 'no_session',
      message: 'No active interview session found',
    };
  }

  const linkToken = tokenFromLink(session.nimrobo_link);
  const storedLinkId = session.nimrobo_session_id;

  console.log(`Checking interview for user ${userId}, linkId=${storedLinkId}, token=${linkToken}`);

  // Step 1: List all instant voice links to find the matching one
  const linksResponse = await listInstantVoiceLinks();

  if (!linksResponse.ok) {
    const errorText = await linksResponse.text();
    console.error('Failed to list links:', linksResponse.status, errorText);
    return { status: 'error', error: `Failed to list Nimrobo links: ${linksResponse.status}` };
  }

  const linksData = await linksResponse.json();
  console.log(`Found ${linksData.links?.length || 0} instant voice links`);

  // Find the matching link by id or token
  interface NimroboLink {
    id: string;
    token?: string;
    status?: string;
    sessionId?: string;
    lastSessionId?: string;
  }

  const matchingLink = linksData.links?.find(
    (link: NimroboLink) =>
      link.id === storedLinkId || link.token === linkToken || link.token === storedLinkId
  );

  if (!matchingLink) {
    console.log('No matching link found in Nimrobo');
    return {
      status: 'pending',
      message: 'Link not found - it may have expired',
      debug: { storedLinkId, linkToken, availableLinks: linksData.links?.length || 0 },
    };
  }

  console.log('Matching link found:', JSON.stringify(matchingLink));

  // Check link status
  const linkStatus = matchingLink.status;

  if (linkStatus === 'active') {
    return {
      status: 'pending',
      message: 'Waiting for you to start the interview',
      linkStatus: 'active',
      debug: { linkId: matchingLink.id, token: matchingLink.token },
    };
  }

  if (linkStatus === 'expired' || linkStatus === 'cancelled') {
    return {
      status: 'failed',
      message: `Link has ${linkStatus}`,
      linkStatus,
    };
  }

  // Link status is "used" - a session was started
  const candidateSessionIds = [
    matchingLink.id,
    matchingLink.token,
    matchingLink.sessionId,
    matchingLink.lastSessionId,
  ].filter(Boolean) as string[];

  console.log('Link is used, trying session IDs:', candidateSessionIds);

  let statusData: { status?: string; completedAt?: string } | null = null;
  let usedSessionId: string | null = null;

  for (const candidate of candidateSessionIds) {
    const statusResponse = await fetchStatus(candidate);

    if (statusResponse.status === 404) {
      console.log(`Status 404 for sessionId candidate: ${candidate}`);
      continue;
    }

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Nimrobo status API error:', statusResponse.status, errorText);
      continue;
    }

    statusData = await statusResponse.json();
    usedSessionId = candidate;
    console.log(`Found session status with id ${candidate}:`, JSON.stringify(statusData));
    break;
  }

  // If we can't find status but link is "used", report as active
  if (!statusData) {
    console.log('Link is used but session status not found yet - interview may be in progress');

    await query(`UPDATE sessions SET status = 'active' WHERE id = $1`, [session.id]);

    return {
      status: 'active',
      message: 'Interview in progress...',
      linkStatus: 'used',
      debug: { triedSessionIds: candidateSessionIds },
    };
  }

  // We have status data - check if completed
  const rawStatus = statusData.status;
  const isCompleted =
    Boolean(statusData.completedAt) ||
    rawStatus === 'completed' ||
    rawStatus === 'ended' ||
    rawStatus === 'finished';
  const isActive = rawStatus === 'in_progress' || rawStatus === 'active' || rawStatus === 'started';
  const isFailed = rawStatus === 'failed' || rawStatus === 'error';

  let newStatus: string;
  let transcript: string | null = null;

  if (isCompleted) {
    newStatus = 'completed';

    console.log(`Session completed (id=${usedSessionId}), fetching transcript...`);
    const transcriptResponse = await fetchTranscript(usedSessionId!);

    if (transcriptResponse.ok) {
      const transcriptData = await transcriptResponse.json();
      console.log('Transcript data received:', JSON.stringify(transcriptData).slice(0, 500));
      transcript = normalizeTranscript(transcriptData?.transcript);
    } else {
      console.error(
        'Transcript fetch failed:',
        transcriptResponse.status,
        await transcriptResponse.text()
      );
    }
  } else if (isActive) {
    newStatus = 'active';
  } else if (isFailed) {
    newStatus = 'failed';
  } else {
    newStatus = 'active';
  }

  const updateValues: unknown[] = [newStatus, session.id];
  let updateQuery = 'UPDATE sessions SET status = $1';
  let paramIndex = 3;

  if (transcript) {
    updateQuery += `, transcript = $${paramIndex}`;
    updateValues.push(transcript);
    paramIndex++;
  }
  if (newStatus === 'completed') {
    updateQuery += `, completed_at = NOW()`;
  }
  updateQuery += ' WHERE id = $2';

  await query(updateQuery, updateValues);

  return {
    status: newStatus,
    transcript,
    session_id: session.id,
    nimrobo_link_id: matchingLink.id,
    nimrobo_session_id: usedSessionId,
    linkStatus,
  };
}
