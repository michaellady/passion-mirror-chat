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

    // Check session status with Nimrobo API
    const nimroboResponse = await fetch(
      `https://app.nimroboai.com/api/v1/sessions/${session.nimrobo_session_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${NIMROBO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // If 404, session may not have started yet
    if (nimroboResponse.status === 404) {
      console.log('Session not found in Nimrobo - user may not have started yet');
      return new Response(JSON.stringify({
        status: 'pending',
        message: 'Waiting for interview to start'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!nimroboResponse.ok) {
      const errorText = await nimroboResponse.text();
      console.error('Nimrobo API error:', nimroboResponse.status, errorText);
      throw new Error(`Nimrobo API error: ${nimroboResponse.status}`);
    }

    const nimroboData = await nimroboResponse.json();
    console.log('Nimrobo session data:', JSON.stringify(nimroboData));

    // Extract status and transcript
    const nimroboStatus = nimroboData.status || nimroboData.state || 'unknown';
    const transcript = nimroboData.transcript || nimroboData.transcription || null;
    
    // Map Nimrobo status to our status
    let newStatus: string;
    if (nimroboStatus === 'completed' || nimroboStatus === 'finished' || nimroboStatus === 'ended') {
      newStatus = 'completed';
    } else if (nimroboStatus === 'in_progress' || nimroboStatus === 'active' || nimroboStatus === 'started') {
      newStatus = 'active';
    } else if (nimroboStatus === 'failed' || nimroboStatus === 'error') {
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
