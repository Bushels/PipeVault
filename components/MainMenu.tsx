import React from 'react';
import Card from './ui/Card';

export type TileAction = 'new-request' | 'inquiry' | 'schedule-delivery' | 'request-pickup';

interface MainMenuProps {
  onTileClick: (action: TileAction) => void;
  customerName?: string;
}

interface MenuTile {
  id: TileAction;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const tiles: MenuTile[] = [
  {
    id: 'new-request',
    title: 'New Storage Request',
    description: 'Submit a new pipe storage request',
    icon: '📝',
    color: 'from-blue-500 to-blue-700',
  },
  {
    id: 'inquiry',
    title: 'Ask AI',
    description: 'Get answers about your storage and inventory',
    icon: '💬',
    color: 'from-green-500 to-green-700',
  },
  {
    id: 'schedule-delivery',
    title: 'Schedule Delivery',
    description: 'Schedule pipe delivery to MPS',
    icon: '🚚',
    color: 'from-purple-500 to-purple-700',
  },
  {
    id: 'request-pickup',
    title: 'Request Pickup',
    description: 'Request pipe pickup from MPS',
    icon: '📦',
    color: 'from-orange-500 to-orange-700',
  },
];

const MainMenu: React.FC<MainMenuProps> = ({ onTileClick, customerName }) => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white">
            PipeVault
          </h1>
          {customerName && (
            <p className="mt-2 text-gray-400">Welcome back, {customerName}!</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold text-white mb-3">
            What would you like to do?
          </h2>
          <p className="text-gray-400">
            Choose an option below to get started
          </p>
        </div>

        {/* 4-Tile Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              onClick={() => onTileClick(tile.id)}
              className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-500"
            >
              <div className={`bg-gradient-to-br ${tile.color} p-8 h-full min-h-[200px] flex flex-col items-center justify-center text-center`}>
                {/* Icon */}
                <div className="text-6xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                  {tile.icon}
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-white mb-2">
                  {tile.title}
                </h3>

                {/* Description */}
                <p className="text-gray-100 text-sm opacity-90">
                  {tile.description}
                </p>

                {/* Hover Effect Overlay */}
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
              </div>
            </button>
          ))}
        </div>

        {/* Help Text */}
        <div className="mt-12 text-center">
          <Card className="max-w-2xl mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-3">
                Need Help?
              </h3>
              <p className="text-gray-400 mb-4">
                Our AI assistant is here to help you through every step of the process.
                If you get stuck or have questions, don't hesitate to reach out!
              </p>
              <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors duration-200">
                Contact Support
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto py-6 px-4 sm:px-6 lg:px-8 bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
          <p>PipeVault - AI-Powered Storage Inventory System</p>
          <p className="mt-1">© {new Date().getFullYear()} MPS. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
