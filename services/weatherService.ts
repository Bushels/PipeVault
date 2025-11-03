import { supabase } from '../lib/supabase';

interface WeatherData {
  temperature: number;
  temperatureUnit: 'C' | 'F';
  weatherCode: number;
  weatherDescription: string;
  emoji: string;
  roughneckQuip: string;
}

interface WeatherForecast {
  snowAccumulation: number;
  temperature: number;
  startTime: string;
}

// Weather code to description mapping (Tomorrow.io weather codes)
const weatherCodeMap: Record<number, { description: string; emoji: string }> = {
  0: { description: 'Unknown', emoji: '🌫️' },
  1000: { description: 'Clear', emoji: '☀️' },
  1100: { description: 'Mostly Clear', emoji: '🌤️' },
  1101: { description: 'Partly Cloudy', emoji: '⛅' },
  1102: { description: 'Mostly Cloudy', emoji: '☁️' },
  1001: { description: 'Cloudy', emoji: '☁️' },
  2000: { description: 'Fog', emoji: '🌫️' },
  2100: { description: 'Light Fog', emoji: '🌫️' },
  4000: { description: 'Drizzle', emoji: '🌦️' },
  4001: { description: 'Rain', emoji: '🌧️' },
  4200: { description: 'Light Rain', emoji: '🌦️' },
  4201: { description: 'Heavy Rain', emoji: '🌧️' },
  5000: { description: 'Snow', emoji: '🌨️' },
  5001: { description: 'Flurries', emoji: '🌨️' },
  5100: { description: 'Light Snow', emoji: '🌨️' },
  5101: { description: 'Heavy Snow', emoji: '❄️' },
  6000: { description: 'Freezing Drizzle', emoji: '🌨️' },
  6001: { description: 'Freezing Rain', emoji: '🌨️' },
  6200: { description: 'Light Freezing Rain', emoji: '🌨️' },
  6201: { description: 'Heavy Freezing Rain', emoji: '🌨️' },
  7000: { description: 'Ice Pellets', emoji: '🌨️' },
  7101: { description: 'Heavy Ice Pellets', emoji: '🌨️' },
  7102: { description: 'Light Ice Pellets', emoji: '🌨️' },
  8000: { description: 'Thunderstorm', emoji: '⛈️' },
};

// Roughneck quips based on weather conditions
const generateRoughneckQuip = (temp: number, weatherCode: number): string => {
  const quips = {
    cold: [
      `Geez, it's ${temp}°C today. Cold enough to freeze the balls off a pool table.`,
      `${temp}°C? That's colder than a well digger's backside. Bundle up out there.`,
      `At ${temp}°C, I've seen pipes freeze faster than my ex's heart. Stay warm, partner.`,
      `${temp}°C... Sometimes I wonder why we live here. But then I remember - the money's good.`,
    ],
    hot: [
      `Whew, ${temp}°C today. Hot enough to melt steel. Stay hydrated out there.`,
      `${temp}°C? That's hotter than a billy goat in a pepper patch. Take it easy.`,
      `At ${temp}°C, you could fry an egg on the pipe rack. Don't forget your sunscreen.`,
    ],
    mild: [
      `Not bad today at ${temp}°C. Pretty decent weather for the yard work.`,
      `${temp}°C - can't complain about that. Good day to get some work done.`,
      `${temp}°C today. Weather's cooperating for once. Let's make the most of it.`,
    ],
    snow: [
      `Looks like we got some snow coming. Hope the trucks can make it through.`,
      `Snow in the forecast. Nothing stops the oil patch, but drive safe out there.`,
      `Another snowstorm. At least the white stuff makes the yard look prettier for a minute.`,
    ],
    rain: [
      `Rainy day ahead. The mud's gonna be thick, so watch your step.`,
      `Rain's coming down. Good day to catch up on paperwork, I suppose.`,
    ],
  };

  // Determine which category based on weather and temperature
  if ([5000, 5001, 5100, 5101].includes(weatherCode)) {
    return quips.snow[Math.floor(Math.random() * quips.snow.length)];
  }
  if ([4000, 4001, 4200, 4201].includes(weatherCode)) {
    return quips.rain[Math.floor(Math.random() * quips.rain.length)];
  }
  if (temp < -5) {
    return quips.cold[Math.floor(Math.random() * quips.cold.length)];
  }
  if (temp > 25) {
    return quips.hot[Math.floor(Math.random() * quips.hot.length)];
  }
  return quips.mild[Math.floor(Math.random() * quips.mild.length)];
};

/**
 * Fetches current weather data from Tomorrow.io API via a Supabase Edge Function
 * Default location: Calgary, Alberta (MPS location)
 */
export const fetchWeather = async (
  latitude: number = 51.0447,
  longitude: number = -114.0719
): Promise<WeatherData | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-realtime-weather', {
      body: { location: `${latitude},${longitude}` },
    });

    if (error) throw error;

    const temp = Math.round(data.data.values.temperature);
    const weatherCode = data.data.values.weatherCode;
    const weatherInfo = weatherCodeMap[weatherCode] || weatherCodeMap[0];

    return {
      temperature: temp,
      temperatureUnit: 'C',
      weatherCode,
      weatherDescription: weatherInfo.description,
      emoji: weatherInfo.emoji,
      roughneckQuip: generateRoughneckQuip(temp, weatherCode),
    };
  } catch (error) {
    console.error('Failed to fetch real-time weather:', error);
    return null;
  }
};

/**
 * Fetches weather forecast data from Tomorrow.io API via a Supabase Edge Function
 */
export const fetchWeatherForecast = async (
  latitude: number = 51.0447,
  longitude: number = -114.0719
): Promise<WeatherForecast | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-weather-forecast', {
      body: { location: `${latitude},${longitude}` },
    });

    if (error) throw error;
    
    return data.forecast;
  } catch (error) {
    console.error('Failed to fetch weather forecast:', error);
    return null;
  }
};

/**
 * Returns a fallback weather quip when API is unavailable
 */
export const getFallbackWeather = (): WeatherData => {
  return {
    temperature: -10,
    temperatureUnit: 'C',
    weatherCode: 5000,
    weatherDescription: 'Snow',
    emoji: '🌨️',
    roughneckQuip: "Geez, looks like it's about -10°C today, and about 20 cm of snow coming tomorrow. Sometimes I wonder why we live here.",
  };
};
