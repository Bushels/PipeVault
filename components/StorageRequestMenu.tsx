/**
 * Storage Request Menu - Customer dashboard menu inside authenticated session
 */

import React, { useState, useEffect } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { PlusIcon, PackageIcon, TruckIcon, ChatIcon } from './icons/Icons';
import type { StorageRequest } from '../types';
import RequestSummaryPanel from './RequestSummaryPanel';
import { fetchWeather, getFallbackWeather } from '../services/weatherService';

interface StorageRequestMenuProps {
  companyName: string;
  hasActiveRequest: boolean;
  requests: StorageRequest[];
  currentUserEmail?: string;
  onSelectOption: (option: 'new-storage' | 'delivery-in' | 'delivery-out' | 'chat') => void;
  onArchiveRequest?: (request: StorageRequest, shouldArchive: boolean) => void | Promise<void>;
  archivingRequestId?: string | null;
  onScheduleDelivery?: (request: StorageRequest) => void;
}

const StorageRequestMenu: React.FC<StorageRequestMenuProps> = ({
  companyName,
  hasActiveRequest,
  requests,
  currentUserEmail,
  onSelectOption,
  onArchiveRequest,
  archivingRequestId,
  onScheduleDelivery,
}) => {
  const [weather, setWeather] = useState(getFallbackWeather());

  useEffect(() => {
    // Fetch weather data on component mount
    const loadWeather = async () => {
      const weatherData = await fetchWeather();
      if (weatherData) {
        setWeather(weatherData);
      }
    };

    loadWeather();
  }, []);
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Request Storage Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Your PipeVault Tiles</h2>
          <p className="text-sm text-gray-400">Manage your storage requests and chat with Roughneck</p>
        </div>
        <button
          onClick={() => onSelectOption('new-storage')}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          <PlusIcon className="h-5 w-5" />
          Request Storage
        </button>
      </div>

      {/* Tiles Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Cards */}
        {requests.length > 0 && (
          <RequestSummaryPanel
            heading=""
            description=""
            requests={requests}
            currentUserEmail={currentUserEmail}
            onArchiveRequest={onArchiveRequest}
            archivingRequestId={archivingRequestId}
            onScheduleDelivery={onScheduleDelivery}
          />
        )}

        {/* Roughneck AI Tile */}
        <div className="relative">
          {/* 3D Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 rounded-2xl blur-lg opacity-20"></div>

          <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden h-full">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

            {/* Status glow */}
            <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-orange-500 to-transparent"></div>

            <div className="relative p-6 space-y-5 h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-gray-700/50">
                <div className="w-12 h-12 bg-orange-600/30 rounded-full flex items-center justify-center shadow-lg">
                  <ChatIcon className="h-6 w-6 text-orange-300" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Roughneck</h3>
                  <p className="text-xs text-orange-100">Your AI Storage Expert</p>
                </div>
              </div>

              {/* Welcome Message or Status */}
              <div className="flex-1 space-y-4">
                <div className="bg-gradient-to-r from-orange-600/10 to-red-600/10 border border-orange-500/20 rounded-xl p-4">
                  <p className="text-sm text-gray-200 leading-relaxed">
                    {requests.length === 0
                      ? "Howdy partner! Welcome to PipeVault. I'm your Roughneck. If you wish to make a new Pipe Storage Request, hit the 'Request Storage' button up top. If you need anything else, just yell for me."
                      : `You've got ${requests.length} ${requests.length === 1 ? 'project' : 'projects'} in the yard. Need to schedule a delivery or check on something? Just ask.`
                    }
                  </p>
                </div>

                {/* Weather Quip */}
                <div className="bg-gray-800/50 border border-gray-700/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{weather.emoji}</span>
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                        Today's Weather - {weather.weatherDescription}
                      </p>
                      <p className="text-sm text-gray-300 italic">
                        "{weather.roughneckQuip}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Suggested Prompts */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">Quick commands:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onSelectOption('chat')}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-all hover:border-orange-500/50"
                    >
                      Show my pipe status
                    </button>
                    <button
                      onClick={() => onSelectOption('chat')}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-all hover:border-orange-500/50"
                    >
                      Schedule delivery
                    </button>
                    <button
                      onClick={() => onSelectOption('chat')}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-all hover:border-orange-500/50"
                    >
                      Storage options
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Input */}
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask Roughneck anything..."
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
                    onFocus={() => onSelectOption('chat')}
                  />
                  <button
                    onClick={() => onSelectOption('chat')}
                    className="px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                  >
                    <ChatIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageRequestMenu;


