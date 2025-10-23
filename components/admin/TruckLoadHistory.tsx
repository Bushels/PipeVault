import React, { useState } from 'react';
import type { TruckLoad } from '../../types';
import Card from '../ui/Card';

interface TruckLoadHistoryProps {
  truckLoads: TruckLoad[];
}

const TruckLoadHistory: React.FC<TruckLoadHistoryProps> = ({ truckLoads }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'DELIVERY' | 'PICKUP'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLoads = truckLoads.filter(load => {
    const matchesType = filterType === 'ALL' || load.type === filterType;
    const matchesSearch =
      searchTerm === '' ||
      load.truckingCompany.toLowerCase().includes(searchTerm.toLowerCase()) ||
      load.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      load.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const sortedLoads = [...filteredLoads].sort((a, b) =>
    new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime()
  );

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const calculateDuration = (arrival: string, departure?: string) => {
    if (!departure) return 'In Progress';
    const arrivalDate = new Date(arrival);
    const departureDate = new Date(departure);
    const durationMs = departureDate.getTime() - arrivalDate.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Truck Load History</h2>
          <p className="text-gray-400 text-sm mt-1">
            Complete log of all deliveries and pickups
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              filterType === 'ALL'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All ({truckLoads.length})
          </button>
          <button
            onClick={() => setFilterType('DELIVERY')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              filterType === 'DELIVERY'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Deliveries ({truckLoads.filter(l => l.type === 'DELIVERY').length})
          </button>
          <button
            onClick={() => setFilterType('PICKUP')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              filterType === 'PICKUP'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Pickups ({truckLoads.filter(l => l.type === 'PICKUP').length})
          </button>
        </div>
      </div>

      <div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by company, driver, or notes..."
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {sortedLoads.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No truck loads found</p>
            <p className="text-gray-500 text-sm mt-2">
              {filterType !== 'ALL' ? 'Try changing the filter' : 'Truck loads will appear here once logged'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedLoads.map(load => (
            <Card key={load.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        load.type === 'DELIVERY'
                          ? 'bg-blue-900/30 text-blue-400 border border-blue-700'
                          : 'bg-green-900/30 text-green-400 border border-green-700'
                      }`}
                    >
                      {load.type}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {formatDateTime(load.arrivalTime)}
                    </span>
                    {!load.departureTime && (
                      <span className="px-2 py-1 rounded bg-yellow-900/30 text-yellow-400 text-xs font-medium border border-yellow-700">
                        On-site
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Trucking Company</p>
                      <p className="text-gray-200 font-medium">{load.truckingCompany}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Driver</p>
                      <p className="text-gray-200 font-medium">
                        {load.driverName}
                        {load.driverPhone && (
                          <span className="text-gray-400 text-sm ml-2">({load.driverPhone})</span>
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Joints Count</p>
                      <p className="text-gray-200 font-medium">{load.jointsCount} joints</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Duration</p>
                      <p className="text-gray-200 font-medium">
                        {calculateDuration(load.arrivalTime, load.departureTime)}
                      </p>
                    </div>

                    {load.type === 'DELIVERY' && load.storageAreaId && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Storage Location</p>
                        <p className="text-gray-200 font-medium">{load.storageAreaId}</p>
                      </div>
                    )}

                    {load.type === 'PICKUP' && load.assignedWellName && (
                      <>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Well Name</p>
                          <p className="text-gray-200 font-medium">{load.assignedWellName}</p>
                        </div>
                        {load.assignedUWI && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">UWI</p>
                            <p className="text-gray-200 font-medium text-sm">{load.assignedUWI}</p>
                          </div>
                        )}
                      </>
                    )}

                    {load.relatedRequestId && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Related Request</p>
                        <p className="text-blue-400 font-medium">{load.relatedRequestId}</p>
                      </div>
                    )}

                    {load.relatedPipeIds && load.relatedPipeIds.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Related Pipes</p>
                        <p className="text-gray-400 text-sm">
                          {load.relatedPipeIds.length} pipe group{load.relatedPipeIds.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>

                  {load.notes && (
                    <div className="mt-4 pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                      <p className="text-gray-300 text-sm">{load.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Summary Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-bold text-blue-400">
              {truckLoads.filter(l => l.type === 'DELIVERY').length}
            </p>
            <p className="text-xs text-gray-500">Total Deliveries</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-400">
              {truckLoads.filter(l => l.type === 'PICKUP').length}
            </p>
            <p className="text-xs text-gray-500">Total Pickups</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-400">
              {truckLoads.filter(l => !l.departureTime).length}
            </p>
            <p className="text-xs text-gray-500">Currently On-site</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-400">
              {truckLoads.reduce((sum, l) => sum + l.jointsCount, 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Total Joints Handled</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TruckLoadHistory;
