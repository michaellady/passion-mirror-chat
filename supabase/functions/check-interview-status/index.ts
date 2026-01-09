import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NIMROBO_API_KEY = Deno.env.get('NIMROBO_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!NIMROBO_API_KEY) {
      throw new Error('NIMROBO_API_KEY is not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid or expired token');
    }

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
        message: 'No active interview session found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Checking Nimrobo session ${session.nimrobo_session_id} for user ${user.id}`);

    // Check session status with Nimrobo API - using correct endpoint format
    const statusResponse = await fetch(
      `https://app.nimroboai.com/api/v1/session/status?sessionId=${session.nimrobo_session_id}&type=instant`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${NIMROBO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // If 404, session may not have started yet
    if (statusResponse.status === 404) {
      console.log('Session not found in Nimrobo - user may not have started yet');
      return new Response(JSON.stringify({
        status: 'pending',
        message: 'Waiting for interview to start'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Nimrobo status API error:', statusResponse.status, errorText);
      throw new Error(`Nimrobo API error: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    console.log('Nimrobo status data:', JSON.stringify(statusData));

    // Check if session has completed (completedAt is set)
    const isCompleted = statusData.completedAt || statusData.status === 'completed' || statusData.status === 'ended';
    const isActive = statusData.status === 'in_progress' || statusData.status === 'active' || statusData.status === 'started';
    const isFailed = statusData.status === 'failed' || statusData.status === 'error';

    let newStatus: string;
    let transcript: string | null = null;

    if (isCompleted) {
      newStatus = 'completed';
      
      // Fetch transcript from separate endpoint
      console.log('Session completed, fetching transcript...');
      const transcriptResponse = await fetch(
        `https://app.nimroboai.com/api/v1/session/transcript?sessionId=${session.nimrobo_session_id}&type=instant`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${NIMROBO_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (transcriptResponse.ok) {
        const transcriptData = await transcriptResponse.json();
        console.log('Transcript data received:', JSON.stringify(transcriptData).slice(0, 500));
        
        // Parse the transcript - it may be a JSON object with conversation entries
        if (transcriptData.transcript) {
          if (typeof transcriptData.transcript === 'string') {
            transcript = transcriptData.transcript;
          } else if (Array.isArray(transcriptData.transcript)) {
            // Convert conversation array to readable transcript
            transcript = transcriptData.transcript
              .filter((entry: { role?: string; content?: string }) => entry.role === 'user' || entry.role === 'assistant')
              .map((entry: { role?: string; content?: string }) => `${entry.role}: ${entry.content}`)
              .join('\n');
          } else {
            transcript = JSON.stringify(transcriptData.transcript);
          }
        }
      } else {
        console.error('Failed to fetch transcript:', await transcriptResponse.text());
      }
    } else if (isActive) {
      newStatus = 'active';
    } else if (isFailed) {
      newStatus = 'failed';
    } else {
      newStatus = 'pending';
    }

    // Update session in database
    const updateData: Record<string, unknown> = { status: newStatus };
    if (transcript) {
      updateData.transcript = transcript;
    }
    if (newStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', session.id);

    if (updateError) {
      console.error('Session update error:', updateError);
    }

    return new Response(JSON.stringify({
      status: newStatus,
      transcript: transcript,
      session_id: session.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
