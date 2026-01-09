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

    // We currently store the *link id* in nimrobo_session_id.
    // Some Nimrobo endpoints treat the *token* as the sessionId, so we try both.
    const linkToken = tokenFromLink(session.nimrobo_link);
    const candidateIds = [session.nimrobo_session_id, linkToken].filter(Boolean) as string[];

    console.log(`Checking Nimrobo identifiers for user ${user.id}:`, candidateIds);

    let statusData: any | null = null;
    let usedSessionId: string | null = null;

    for (const candidate of candidateIds) {
      const statusResponse = await fetchStatus(baseUrl, NIMROBO_API_KEY, candidate);

      if (statusResponse.status === 404) {
        console.log(`Status 404 for candidate ${candidate}`);
        continue;
      }

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('Nimrobo status API error:', statusResponse.status, errorText);
        throw new Error(`Nimrobo API error: ${statusResponse.status}`);
      }

      statusData = await statusResponse.json();
      usedSessionId = candidate;
      break;
    }

    if (!statusData || !usedSessionId) {
      return new Response(JSON.stringify({
        status: 'pending',
        message: 'Waiting for interview to start',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Nimrobo status data:', JSON.stringify(statusData));

    const rawStatus = statusData.status;
    const isCompleted = Boolean(statusData.completedAt) || rawStatus === 'completed' || rawStatus === 'ended' || rawStatus === 'finished';
    const isActive = rawStatus === 'in_progress' || rawStatus === 'active' || rawStatus === 'started';
    const isFailed = rawStatus === 'failed' || rawStatus === 'error';

    let newStatus: string;
    let transcript: string | null = null;

    if (isCompleted) {
      newStatus = 'completed';

      console.log(`Session completed (id=${usedSessionId}), fetching transcript...`);
      const transcriptResponse = await fetchTranscript(baseUrl, NIMROBO_API_KEY, usedSessionId);

      if (transcriptResponse.ok) {
        const transcriptData = await transcriptResponse.json();
        transcript = normalizeTranscript(transcriptData?.transcript);
      } else {
        console.error('Transcript fetch failed:', transcriptResponse.status, await transcriptResponse.text());
      }
    } else if (isActive) {
      newStatus = 'active';
    } else if (isFailed) {
      newStatus = 'failed';
    } else {
      newStatus = 'pending';
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
      nimrobo_session_id: session.nimrobo_session_id,
      nimrobo_used_session_id: usedSessionId,
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
