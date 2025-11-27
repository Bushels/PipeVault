import React, { useState, useEffect } from 'react';
import { Yard, Rack, RackReservation } from '../../types';
import { supabase } from '../../lib/supabase';
import Spinner from '../ui/Spinner';

interface RackSelectorProps {
  yards: Yard[];
  startDate: string;
  endDate: string;
  requiredJoints: number;
  onSelectionChange: (selectedRackIds: string[], capacity: number) => void;
  initialSelectedRacks?: string[];
}

export const RackSelector: React.FC<RackSelectorProps> = ({
  yards,
  startDate,
  endDate,
  requiredJoints,
  onSelectionChange,
  initialSelectedRacks = []
}) => {
  const [reservations, setReservations] = useState<RackReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRacks, setSelectedRacks] = useState<string[]>(initialSelectedRacks);

  useEffect(() => {
    fetchReservations();
  }, [startDate, endDate]);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      // Fetch reservations that overlap with the requested period
      const { data, error } = await supabase
        .from('rack_reservations')
        .select('*')
        .eq('status', 'ACTIVE')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

      if (error) throw error;
      setReservations(data || []);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRackAvailability = (rack: Rack) => {
    const rackReservations = reservations.filter(r => r.rack_id === rack.id);
    const totalReserved = rackReservations.reduce((sum, res) => sum + res.reserved_joints, 0);
    const available = Math.max(0, rack.capacity - totalReserved);
    
    return {
      available,
      totalReserved,
      reservations: rackReservations
    };
  };

  const calculateSelectedCapacity = (racks: string[]) => {
    return racks.reduce((sum, rackId) => {
      const rack = yards.flatMap(y => y.areas).flatMap(a => a.racks).find(r => r.id === rackId);
      if (!rack) return sum;
      const { available } = getRackAvailability(rack);
      return sum + available;
    }, 0);
  };

  const handleToggleRack = (rackId: string) => {
    const newSelection = selectedRacks.includes(rackId)
      ? selectedRacks.filter(id => id !== rackId)
      : [...selectedRacks, rackId];
    
    setSelectedRacks(newSelection);
    const capacity = calculateSelectedCapacity(newSelection);
    onSelectionChange(newSelection, capacity);
  };

  if (loading) return (
    <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
      <Spinner size="lg" />
      <p>Checking availability...</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {yards.map(yard => (
          <div key={yard.id} className="space-y-2">
            <h4 className="font-medium text-slate-300 sticky top-0 bg-slate-900/95 py-2 z-10 backdrop-blur-md border-b border-slate-800/50 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></span>
              {yard.name}
            </h4>
            {yard.areas.map(area => (
              <div key={area.id} className="pl-4 border-l border-slate-700/50 ml-1">
                <h5 className="text-xs uppercase tracking-wide text-slate-500 mb-2 font-semibold">{area.name}</h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {area.racks.map(rack => {
                    const { available, totalReserved } = getRackAvailability(rack);
                    const isSelected = selectedRacks.includes(rack.id);
                    const isFull = available <= 0;
                    
                    return (
                      <button
                        key={rack.id}
                        onClick={() => !isFull && handleToggleRack(rack.id)}
                        disabled={isFull}
                        className={`
                          relative p-2 rounded-lg border text-left transition-all duration-200 group
                          ${isSelected 
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                            : isFull 
                              ? 'bg-slate-800/40 border-slate-700/30 text-slate-600 cursor-not-allowed opacity-60' 
                              : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/80 hover:border-slate-600 hover:shadow-lg hover:shadow-indigo-500/10'
                          }
                        `}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-sm">{rack.name}</span>
                          {isSelected && <span className="text-emerald-400 text-xs font-bold">✓</span>}
                        </div>
                        <div className="mt-1 text-xs space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Cap:</span>
                            <span className="font-mono">{rack.capacity}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Avail:</span>
                            <span className={`font-mono ${available < rack.capacity ? 'text-amber-400 font-medium' : 'text-emerald-400'}`}>
                              {available}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-700/30">
                            <span>Phys: {rack.occupied || 0}</span>
                            {rack.occupied > totalReserved && (
                              <span className="text-amber-500 animate-pulse" title="Physical occupancy exceeds reserved amount">⚠</span>
                            )}
                          </div>
                        </div>
                        {totalReserved > 0 && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_5px_rgba(245,158,11,0.5)] ring-2 ring-slate-900" title="Partially reserved" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
