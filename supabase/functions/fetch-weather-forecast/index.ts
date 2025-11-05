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
    const url = `${TOMORROW_BASE_URL}/weather/forecast?location=${location}&timesteps=1h&units=metric&apikey=${TOMORROW_API_KEY}`;

    const response = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } });

    if (!response.ok) {
      throw new Error(`Tomorrow.io API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Find significant upcoming weather events (e.g., snow)
    const upcomingSnow = data.timelines.hourly
      .slice(0, 24) // Only look at the next 24 hours
      .find(hour => hour.values.snowAccumulation > 0);

    let forecastSummary = null;
    if (upcomingSnow) {
      forecastSummary = {
        snowAccumulation: upcomingSnow.values.snowAccumulation,
        temperature: upcomingSnow.values.temperature,
        startTime: upcomingSnow.time,
      };
    }

    return new Response(JSON.stringify({ forecast: forecastSummary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
