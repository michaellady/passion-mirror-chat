import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function tokenFromLink(nimroboLink: string | null): string | null {
  if (!nimroboLink) return null;
  const match = nimroboLink.match(/\/link\/([^/?#]+)/);
  return match?.[1] ?? null;
}

// List all instant voice links to find the one we created and check its status
async function listInstantVoiceLinks(baseUrl: string, apiKey: string) {
  const url = `${baseUrl}/api/v1/instant-voice-links`;
  return fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

async function fetchStatus(baseUrl: string, apiKey: string, sessionId: string) {
  const url = `${baseUrl}/api/v1/session/status?sessionId=${encodeURIComponent(sessionId)}&type=instant`;
  return fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

async function fetchTranscript(baseUrl: string, apiKey: string, sessionId: string) {
  const url = `${baseUrl}/api/v1/session/transcript?sessionId=${encodeURIComponent(sessionId)}&type=instant`;
  return fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeTranscript(transcript: unknown): string | null {
  if (!transcript) return null;
  if (typeof transcript === 'string') return transcript;
  if (Array.isArray(transcript)) {
    return transcript
      .filter((e: any) => e?.role && e?.content)
      .map((e: any) => `${e.role}: ${e.content}`)
      .join('\n');
  }
  return JSON.stringify(transcript);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NIMROBO_API_KEY = Deno.env.get('NIMROBO_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!NIMROBO_API_KEY) throw new Error('NIMROBO_API_KEY is not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) throw new Error('Invalid or expired token');

    // Get the user's latest pending/active session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      console.error('Session fetch error:', sessionError);
      throw new Error('Failed to fetch session');
    }

    if (!session) {
      return new Response(JSON.stringify({
        status: 'no_session',
        message: 'No active interview session found',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = 'https://app.nimroboai.com';
    const linkToken = tokenFromLink(session.nimrobo_link);
    const storedLinkId = session.nimrobo_session_id;

    console.log(`Checking interview for user ${user.id}, linkId=${storedLinkId}, token=${linkToken}`);

    // Step 1: List all instant voice links to find the matching one
    const linksResponse = await listInstantVoiceLinks(baseUrl, NIMROBO_API_KEY);
    
    if (!linksResponse.ok) {
      const errorText = await linksResponse.text();
      console.error('Failed to list links:', linksResponse.status, errorText);
      throw new Error(`Failed to list Nimrobo links: ${linksResponse.status}`);
    }

    const linksData = await linksResponse.json();
    console.log(`Found ${linksData.links?.length || 0} instant voice links`);

    // Find the matching link by id or token
    const matchingLink = linksData.links?.find((link: any) => 
      link.id === storedLinkId || link.token === linkToken || link.token === storedLinkId
    );

    if (!matchingLink) {
      console.log('No matching link found in Nimrobo');
      return new Response(JSON.stringify({
        status: 'pending',
        message: 'Link not found - it may have expired',
        debug: { storedLinkId, linkToken, availableLinks: linksData.links?.length || 0 }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Matching link found:', JSON.stringify(matchingLink));

    // Check link status: "active" = not started, "used" = session started/completed
    const linkStatus = matchingLink.status;
    
    if (linkStatus === 'active') {
      // Link hasn't been used yet - user hasn't started the interview
      return new Response(JSON.stringify({
        status: 'pending',
        message: 'Waiting for you to start the interview',
        linkStatus: 'active',
        debug: { linkId: matchingLink.id, token: matchingLink.token }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (linkStatus === 'expired' || linkStatus === 'cancelled') {
      return new Response(JSON.stringify({
        status: 'failed',
        message: `Link has ${linkStatus}`,
        linkStatus,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Link status is "used" - a session was started
    // Now we need to find the actual sessionId. Try using the link id as sessionId
    // The sessionId for instant links is often the same as the link id
    const candidateSessionIds = [
      matchingLink.id, 
      matchingLink.token,
      matchingLink.sessionId, // in case it's returned
      matchingLink.lastSessionId, // in case it's returned
    ].filter(Boolean);

    console.log('Link is used, trying session IDs:', candidateSessionIds);

    let statusData: any | null = null;
    let usedSessionId: string | null = null;

    for (const candidate of candidateSessionIds) {
      const statusResponse = await fetchStatus(baseUrl, NIMROBO_API_KEY, candidate);

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

    // If we still can't find status but link is "used", report as active (in progress)
    if (!statusData) {
      console.log('Link is used but session status not found yet - interview may be in progress');
      
      // Update our session to active since the link was used
      await supabase
        .from('sessions')
        .update({ status: 'active' })
        .eq('id', session.id);

      return new Response(JSON.stringify({
        status: 'active',
        message: 'Interview in progress...',
        linkStatus: 'used',
        debug: { triedSessionIds: candidateSessionIds }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // We have status data - check if completed
    const rawStatus = statusData.status;
    const isCompleted = Boolean(statusData.completedAt) || rawStatus === 'completed' || rawStatus === 'ended' || rawStatus === 'finished';
    const isActive = rawStatus === 'in_progress' || rawStatus === 'active' || rawStatus === 'started';
    const isFailed = rawStatus === 'failed' || rawStatus === 'error';

    let newStatus: string;
    let transcript: string | null = null;

    if (isCompleted) {
      newStatus = 'completed';

      console.log(`Session completed (id=${usedSessionId}), fetching transcript...`);
      const transcriptResponse = await fetchTranscript(baseUrl, NIMROBO_API_KEY, usedSessionId!);

      if (transcriptResponse.ok) {
        const transcriptData = await transcriptResponse.json();
        console.log('Transcript data received:', JSON.stringify(transcriptData).slice(0, 500));
        transcript = normalizeTranscript(transcriptData?.transcript);
      } else {
        console.error('Transcript fetch failed:', transcriptResponse.status, await transcriptResponse.text());
      }
    } else if (isActive) {
      newStatus = 'active';
    } else if (isFailed) {
      newStatus = 'failed';
    } else {
      newStatus = 'active'; // Default to active if link is used
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (transcript) updateData.transcript = transcript;
    if (newStatus === 'completed') updateData.completed_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', session.id);

    if (updateError) console.error('Session update error:', updateError);

    return new Response(JSON.stringify({
      status: newStatus,
      transcript,
      session_id: session.id,
      nimrobo_link_id: matchingLink.id,
      nimrobo_session_id: usedSessionId,
      linkStatus,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
