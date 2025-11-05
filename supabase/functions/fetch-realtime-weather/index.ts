import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const TOMORROW_API_KEY = Deno.env.get('TOMORROW_API_KEY');
const TOMORROW_BASE_URL = 'https://api.tomorrow.io/v4';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!TOMORROW_API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const requestBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const location =
      typeof requestBody?.location === 'string' && requestBody.location.length > 0
        ? requestBody.location
        : '51.0447,-114.0719';
    const url = `${TOMORROW_BASE_URL}/weather/realtime?location=${location}&units=metric&apikey=${TOMORROW_API_KEY}`;

    const response = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } });

    if (!response.ok) {
      throw new Error(`Tomorrow.io API error: ${response.statusText}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
