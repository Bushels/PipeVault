
import React, { useState } from 'react';
import type { Pipe } from '../types';
import { PipeIcon } from './icons/Icons';
import { calculateDaysInStorage, formatDate, formatDuration, formatStatus, getStatusColor } from '../utils/dateUtils';

interface InventoryDisplayProps {
  inventory: Pipe[];
  showAllColumns?: boolean; // For admin view to show more details
}

const InventoryDisplay: React.FC<InventoryDisplayProps> = ({ inventory, showAllColumns = false }) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'IN_STORAGE' | 'PICKED_UP'>('ALL');

  const filteredInventory = inventory.filter(pipe => {
    if (filterStatus === 'ALL') return true;
    return pipe.status === filterStatus;
  });

  if (inventory.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-gray-600 rounded-lg">
        <PipeIcon className="mx-auto h-12 w-12 text-gray-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-300">No Inventory</h3>
        <p className="mt-1 text-sm text-gray-500">Your stored pipes will appear here once your request is complete.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            filterStatus === 'ALL'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All ({inventory.length})
        </button>
        <button
          onClick={() => setFilterStatus('IN_STORAGE')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            filterStatus === 'IN_STORAGE'
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          In Storage ({inventory.filter(p => p.status === 'IN_STORAGE').length})
        </button>
        <button
          onClick={() => setFilterStatus('PICKED_UP')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            filterStatus === 'PICKED_UP'
              ? 'bg-gray-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Picked Up ({inventory.filter(p => p.status === 'PICKED_UP').length})
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-300 sm:pl-6">Status</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Type</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Grade</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">O.D. (in)</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Weight (lb/ft)</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Quantity</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Drop-off Date</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Days in Storage</th>
              {showAllColumns && (
                <>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Storage Area</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Well Assignment</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-gray-900">
            {filteredInventory.map((pipe) => {
              const daysInStorage = calculateDaysInStorage(pipe.dropOffTimestamp, pipe.pickUpTimestamp);
              return (
                <tr key={pipe.id} className="hover:bg-gray-800/50">
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(pipe.status)}`}>
                      {formatStatus(pipe.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-white">{pipe.type}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{pipe.grade}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{pipe.outerDiameter.toFixed(3)}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{pipe.weight.toFixed(2)}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{pipe.quantity}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                    {pipe.dropOffTimestamp ? formatDate(pipe.dropOffTimestamp) : 'N/A'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    {pipe.status === 'PICKED_UP' ? (
                      <span className="text-gray-500">{formatDuration(daysInStorage)} (completed)</span>
                    ) : (
                      <span className="text-blue-400 font-medium">{formatDuration(daysInStorage)}</span>
                    )}
                  </td>
                  {showAllColumns && (
                    <>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">
                        {pipe.storageAreaId || 'N/A'}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-300">
                        {pipe.assignedWellName ? (
                          <div>
                            <div className="font-medium text-green-400">{pipe.assignedWellName}</div>
                            {pipe.assignedUWI && <div className="text-xs text-gray-500">{pipe.assignedUWI}</div>}
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary stats */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-2xl font-bold text-blue-400">
            {inventory.filter(p => p.status === 'IN_STORAGE').reduce((sum, p) => sum + p.quantity, 0)}
          </p>
          <p className="text-xs text-gray-500">Joints in Storage</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-400">
            {inventory.filter(p => p.status === 'PICKED_UP').reduce((sum, p) => sum + p.quantity, 0)}
          </p>
          <p className="text-xs text-gray-500">Joints Picked Up</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-400">
            {inventory.filter(p => p.status === 'IN_STORAGE').length}
          </p>
          <p className="text-xs text-gray-500">Active Pipe Groups</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-purple-400">
            {inventory.filter(p => p.status === 'IN_STORAGE').length > 0
              ? Math.round(
                  inventory
                    .filter(p => p.status === 'IN_STORAGE')
                    .reduce((sum, p) => sum + calculateDaysInStorage(p.dropOffTimestamp), 0) /
                    inventory.filter(p => p.status === 'IN_STORAGE').length
                )
              : 0}
          </p>
          <p className="text-xs text-gray-500">Avg Days in Storage</p>
        </div>
      </div>
    </div>
  );
};

export default InventoryDisplay;
