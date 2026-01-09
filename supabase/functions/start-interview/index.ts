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

    // Create instant voice link using Nimrobo API
    const nimroboResponse = await fetch('https://app.nimroboai.com/api/v1/instant-voice-links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NIMROBO_API_KEY}`,
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
        landingPageInfo: 'Share your passion with our AI interviewer. This conversation will help us understand what makes you unique.',
        timeLimitMinutes: 5,
      }),
    });

    if (!nimroboResponse.ok) {
      const errorText = await nimroboResponse.text();
      console.error('Nimrobo API error:', nimroboResponse.status, errorText);
      throw new Error(`Nimrobo API error: ${nimroboResponse.status} - ${errorText}`);
    }

    const nimroboData = await nimroboResponse.json();
    console.log('Nimrobo session created:', nimroboData);

    // Extract the voice link from response
    const linkObj = nimroboData.links?.[0] ?? nimroboData.voiceLinks?.[0] ?? nimroboData.voice_links?.[0];
    if (!linkObj) {
      throw new Error('No voice link returned from Nimrobo');
    }

    const sessionUrl: string | null =
      linkObj.url ??
      linkObj.link ??
      (linkObj.token ? `https://app.nimroboai.com/link/${linkObj.token}` : null);

    if (!sessionUrl) {
      console.error('Nimrobo link object missing URL/token:', linkObj);
      throw new Error('Nimrobo response missing a usable session URL');
    }

    const sessionId: string = linkObj.id ?? linkObj.token;

    // Save session to database
    const { error: dbError } = await supabase.from('sessions').insert({
      user_id: user.id,
      nimrobo_session_id: sessionId,
      nimrobo_link: sessionUrl,
      status: 'pending',
    });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save session');
    }

    return new Response(JSON.stringify({
      session_id: sessionId,
      session_url: sessionUrl,
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
