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

    // Create Nimrobo session
    const nimroboResponse = await fetch('https://api.nimrobo.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NIMROBO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
        voice: 'alloy',
        max_duration: 300, // 5 minutes
      }),
    });

    if (!nimroboResponse.ok) {
      const errorText = await nimroboResponse.text();
      console.error('Nimrobo API error:', errorText);
      throw new Error(`Nimrobo API error: ${nimroboResponse.status}`);
    }

    const nimroboData = await nimroboResponse.json();
    console.log('Nimrobo session created:', nimroboData);

    // Save session to database
    const { error: dbError } = await supabase.from('sessions').insert({
      user_id: user.id,
      nimrobo_session_id: nimroboData.session_id,
      nimrobo_link: nimroboData.session_url || nimroboData.link,
      status: 'pending',
    });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save session');
    }

    return new Response(JSON.stringify({
      session_id: nimroboData.session_id,
      session_url: nimroboData.session_url || nimroboData.link,
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
