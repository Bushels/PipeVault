/**
 * Load Timeline View Component
 *
 * Visual timeline showing trucking load lifecycle progression.
 * Displays milestone stages: NEW → APPROVED → IN_TRANSIT → COMPLETED
 * with dynamic status indicators and timestamps.
 *
 * Features:
 * - Color-coded milestone dots based on completion status
 * - Connector lines showing progression
 * - Responsive layout for mobile and desktop
 * - Animated completion indicators
 */

import React from 'react';
import type { TruckingLoad } from '../types';
import { formatDate } from '../utils/dateUtils';

interface LoadTimelineViewProps {
  load: TruckingLoad;
  direction?: 'INBOUND' | 'OUTBOUND';
}

interface MilestoneStage {
  key: string;
  label: string;
  icon: string;
  isActive: boolean;
  isCompleted: boolean;
  timestamp: string | null;
}

const LoadTimelineView: React.FC<LoadTimelineViewProps> = ({ load, direction = 'INBOUND' }) => {
  const loadData = load as any;

  // Define milestone stages based on load status
  const stages: MilestoneStage[] = [
    {
      key: 'NEW',
      label: 'Submitted',
      icon: '📝',
      isActive: load.status === 'NEW',
      isCompleted: ['APPROVED', 'IN_TRANSIT', 'COMPLETED'].includes(load.status),
      timestamp: loadData.created_at || null,
    },
    {
      key: 'APPROVED',
      label: 'Approved',
      icon: '✓',
      isActive: load.status === 'APPROVED',
      isCompleted: ['IN_TRANSIT', 'COMPLETED'].includes(load.status),
      timestamp: loadData.approved_at || null,
    },
    {
      key: 'IN_TRANSIT',
      label: direction === 'INBOUND' ? 'En Route to MPS' : 'En Route from MPS',
      icon: '🚛',
      isActive: load.status === 'IN_TRANSIT',
      isCompleted: load.status === 'COMPLETED',
      timestamp: loadData.in_transit_at || null,
    },
    {
      key: 'COMPLETED',
      label: direction === 'INBOUND' ? 'Delivered' : 'Picked Up',
      icon: '✓',
      isActive: load.status === 'COMPLETED',
      isCompleted: load.status === 'COMPLETED',
      timestamp: loadData.completed_at || null,
    },
  ];

  // Handle rejected loads
  if (load.status === 'REJECTED') {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-900/50 border-2 border-red-500 flex items-center justify-center text-xl">
            ✗
          </div>
          <div>
            <p className="text-sm font-semibold text-red-300">Load Rejected</p>
            <p className="text-xs text-red-400 mt-0.5">
              This load was not approved for processing
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline Container */}
      <div className="flex items-start gap-0">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;

          // Determine dot styling
          const dotClasses = stage.isCompleted
            ? 'bg-green-500 border-green-400 shadow-green-500/50'
            : stage.isActive
            ? 'bg-blue-500 border-blue-400 shadow-blue-500/50 animate-pulse'
            : 'bg-gray-700 border-gray-600';

          // Determine connector line styling
          const lineClasses = stage.isCompleted
            ? 'bg-green-500'
            : 'bg-gray-700';

          return (
            <div key={stage.key} className="flex-1 flex flex-col items-center">
              {/* Stage Container */}
              <div className="flex flex-col items-center w-full">
                {/* Milestone Dot with Connecting Line */}
                <div className="relative flex items-center justify-center w-full">
                  {/* Connecting Line (Left Half) */}
                  {index > 0 && (
                    <div className={`absolute left-0 right-1/2 h-0.5 ${lineClasses} transition-all duration-500`} />
                  )}

                  {/* Milestone Dot */}
                  <div
                    className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg shadow-lg transition-all duration-300 ${dotClasses}`}
                  >
                    {stage.icon}
                  </div>

                  {/* Connecting Line (Right Half) */}
                  {!isLast && (
                    <div className={`absolute left-1/2 right-0 h-0.5 ${lineClasses} transition-all duration-500`} />
                  )}
                </div>

                {/* Stage Label */}
                <div className="mt-3 text-center px-2">
                  <p
                    className={`text-xs font-semibold transition-colors ${
                      stage.isCompleted
                        ? 'text-green-300'
                        : stage.isActive
                        ? 'text-blue-300'
                        : 'text-gray-500'
                    }`}
                  >
                    {stage.label}
                  </p>
                  {stage.timestamp && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {formatDate(stage.timestamp)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Info */}
      <div className="mt-4 pt-4 border-t border-gray-700/50 grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <p className="text-gray-400 text-[10px] uppercase">Load Number</p>
          <p className="text-white font-semibold">#{loadData.sequence_number}</p>
        </div>
        {loadData.total_joints_planned && (
          <div className="bg-gray-800/50 rounded-lg p-2">
            <p className="text-gray-400 text-[10px] uppercase">Quantity</p>
            <p className="text-white font-semibold">
              {loadData.total_joints_completed
                ? `${loadData.total_joints_completed} / ${loadData.total_joints_planned}`
                : loadData.total_joints_planned}{' '}
              joints
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadTimelineView;
