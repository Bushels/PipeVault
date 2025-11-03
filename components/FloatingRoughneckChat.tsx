/**
 * Floating Roughneck Chat - Overlay chat interface accessible via floating button
 * Designed for low-friction access without taking up dashboard real estate
 */

import React, { useState, useEffect } from 'react';
import { HardhatIcon, ChatIcon } from './icons/Icons';
import { fetchWeather, getFallbackWeather } from '../services/weatherService';
import type { StorageRequest } from '../types';

interface FloatingRoughneckChatProps {
  requests: StorageRequest[];
  onOpenChat: () => void;
}

const FloatingRoughneckChat: React.FC<FloatingRoughneckChatProps> = ({
  requests,
  onOpenChat,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [weather, setWeather] = useState(getFallbackWeather());

  useEffect(() => {
    // Fetch weather data using user's geolocation
    const loadWeather = async () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const weatherData = await fetchWeather(latitude, longitude);
            if (weatherData) {
              setWeather(weatherData);
            }
          },
          async (error) => {
            console.log('Geolocation denied, using MPS location (Calgary):', error.message);
            const weatherData = await fetchWeather();
            if (weatherData) {
              setWeather(weatherData);
            }
          }
        );
      } else {
        const weatherData = await fetchWeather();
        if (weatherData) {
          setWeather(weatherData);
        }
      }
    };

    loadWeather();
  }, []);

  const toggleChat = () => {
    if (!isOpen) {
      // Opening the overlay - trigger full chat
      onOpenChat();
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-50 group"
        aria-label="Open Roughneck Chat"
      >
        {/* Glow effect */}
        <div className="absolute -inset-2 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>

        {/* Button */}
        <div className="relative w-16 h-16 bg-gradient-to-br from-orange-600 to-red-600 rounded-full shadow-2xl flex items-center justify-center transform transition-all duration-200 group-hover:scale-110">
          <HardhatIcon className="h-8 w-8 text-white" />

          {/* Notification badge for new users or important status */}
          {requests.length === 0 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">!</span>
            </div>
          )}
        </div>
      </button>

      {/* Quick Preview Tooltip (shows on hover) */}
      <div className="fixed bottom-6 right-24 z-40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-gray-900 border border-orange-500/30 rounded-lg shadow-xl p-3 max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <HardhatIcon className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-bold text-white">Roughneck</span>
          </div>
          <p className="text-xs text-gray-300">
            {requests.length === 0
              ? "Need help getting started? Click to chat!"
              : `${requests.length} ${requests.length === 1 ? 'project' : 'projects'} in the yard. Click for status.`
            }
          </p>
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
            <span>{weather.emoji}</span>
            <span>{weather.temperature}°C</span>
          </div>
        </div>
      </div>

      {/* Chat Overlay (full screen) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-white transition-colors"
            aria-label="Close chat"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Chat Interface */}
          <div className="relative w-full max-w-4xl h-[80vh] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 rounded-2xl blur-lg opacity-20"></div>

            <div className="relative h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-3 p-6 border-b border-gray-700/50 bg-gray-900/50">
                <div className="w-12 h-12 bg-orange-600/30 rounded-full flex items-center justify-center">
                  <HardhatIcon className="h-6 w-6 text-orange-300" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">Roughneck</h2>
                  <p className="text-xs text-orange-200">Your AI Storage Expert</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Live Weather</p>
                  <div className="flex items-center gap-1 text-sm text-gray-300">
                    <span>{weather.emoji}</span>
                    <span>{weather.temperature}°C</span>
                  </div>
                </div>
              </div>

              {/* Weather Quip Banner */}
              <div className="px-6 py-3 bg-gray-800/30 border-b border-gray-700/30">
                <p className="text-sm text-gray-300 italic">
                  "{weather.roughneckQuip}"
                </p>
              </div>

              {/* Chat Content - This will be replaced with actual chat when user clicks */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="bg-gradient-to-r from-orange-600/10 to-red-600/10 border border-orange-500/20 rounded-xl p-5">
                  <p className="text-sm text-gray-200 leading-relaxed">
                    {requests.length === 0
                      ? "Howdy partner! Welcome to PipeVault. I'm your Roughneck. If you wish to make a new Pipe Storage Request, hit the 'Request Storage' button. If you need anything else, just ask away."
                      : `You've got ${requests.length} ${requests.length === 1 ? 'project' : 'projects'} in the yard. Need to schedule a delivery, check on something, or extend storage? Just ask.`
                    }
                  </p>
                </div>

                {/* Suggested Prompts */}
                <div>
                  <p className="text-xs text-gray-500 mb-3">Quick commands:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button className="px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 text-left transition-all hover:border-orange-500/50">
                      📊 Show my pipe status
                    </button>
                    <button className="px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 text-left transition-all hover:border-orange-500/50">
                      🚛 Schedule delivery
                    </button>
                    <button className="px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 text-left transition-all hover:border-orange-500/50">
                      📦 Storage options
                    </button>
                    <button className="px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 text-left transition-all hover:border-orange-500/50">
                      ⏰ Extend storage
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Input */}
              <div className="p-6 border-t border-gray-700/50 bg-gray-900/50">
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Ask Roughneck anything..."
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                  />
                  <button className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2">
                    <ChatIcon className="h-5 w-5" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingRoughneckChat;
