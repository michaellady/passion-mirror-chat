import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Get user from auth header
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

    const { niche } = await req.json();
    
    console.log(`Starting Nimrobo session for user ${user.id} with niche: ${niche}`);

    // Create interview flow first
    const flowResponse = await fetch('https://app.ribbon.ai/be-api/v1/interview-flows', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NIMROBO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Passion Interview: ${niche}`,
        system_prompt: `You are a friendly interviewer helping discover someone's passion for "${niche}". 
Ask open-ended questions about how they discovered this interest, what specifically excites them about it, 
their favorite experiences or projects, who inspires them in this space, and what they'd love to explore next.
Keep it conversational, warm, and curious. Listen actively and ask follow-ups.
The goal is to understand their personality traits and passion level.
Keep the interview to about 3-5 minutes.`,
        questions: [
          `Tell me, how did you first discover your interest in ${niche}?`,
          `What specifically excites you most about ${niche}?`,
          `Can you share a favorite experience or project related to ${niche}?`,
          `Who inspires you in this space?`,
          `What would you love to explore next in ${niche}?`
        ]
      }),
    });

    if (!flowResponse.ok) {
      const errorText = await flowResponse.text();
      console.error('Ribbon API flow error:', errorText);
      throw new Error(`Ribbon API error: ${flowResponse.status}`);
    }

    const flowData = await flowResponse.json();
    console.log('Interview flow created:', flowData);

    // Create a session from the flow
    const sessionResponse = await fetch('https://app.ribbon.ai/be-api/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NIMROBO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        interview_flow_id: flowData.id,
      }),
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('Ribbon API session error:', errorText);
      throw new Error(`Ribbon API error: ${sessionResponse.status}`);
    }

    const sessionData = await sessionResponse.json();
    console.log('Session created:', sessionData);

    // Save session to database
    const { error: dbError } = await supabase.from('sessions').insert({
      user_id: user.id,
      nimrobo_session_id: sessionData.id,
      nimrobo_link: sessionData.session_url || sessionData.link || sessionData.url,
      status: 'pending',
    });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save session');
    }

    return new Response(JSON.stringify({
      session_id: sessionData.id,
      session_url: sessionData.session_url || sessionData.link || sessionData.url,
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
