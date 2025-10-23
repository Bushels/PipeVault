
import React from 'react';
import type { Pipe } from '../types';
import { PipeIcon } from './icons/Icons';

interface InventoryDisplayProps {
  inventory: Pipe[];
}

const InventoryDisplay: React.FC<InventoryDisplayProps> = ({ inventory }) => {
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
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-800">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-300 sm:pl-6">Type</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Grade</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">O.D. (in)</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Weight (lb/ft)</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Length (ft)</th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Quantity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-gray-900">
          {inventory.map((pipe) => (
            <tr key={pipe.id} className="hover:bg-gray-800/50">
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">{pipe.type}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{pipe.grade}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{pipe.outerDiameter.toFixed(3)}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{pipe.weight.toFixed(2)}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{pipe.length}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{pipe.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default InventoryDisplay;
