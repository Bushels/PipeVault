import React, { useState } from 'react';
import GlassCard from '../ui/GlassCard';
import GlassButton from '../ui/GlassButton';
import { BuildingIcon, XCircleIcon } from '../icons/Icons';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface StorageManagementProps {
  racks: any[];
  yards: any[];
  companies: any[];
  onRefresh: () => void;
}

const StorageManagement: React.FC<StorageManagementProps> = ({
  racks = [],
  yards = [],
  companies = [],
  onRefresh,
}) => {
  const [draggedCompany, setDraggedCompany] = useState<any | null>(null);
  const [isResetting, setIsResetting] = useState<string | null>(null);

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, company: any) => {
    setDraggedCompany(company);
    e.dataTransfer.setData('companyId', company.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Handle drop on rack
  const handleDrop = async (e: React.DragEvent, rack: any) => {
    e.preventDefault();
    const companyId = e.dataTransfer.getData('companyId');
    
    if (!companyId) return;

    // If rack is already occupied, confirm overwrite
    if (rack.company_id && rack.company_id !== companyId) {
      if (!window.confirm('This rack is already assigned to another company. Overwrite?')) {
        return;
      }
    }

    try {
      // @ts-ignore - Database types are outdated, these columns exist
      const { error } = await supabase
        .from('racks')
        .update({ 
          company_id: companyId,
          status: 'OCCUPIED',
          updated_at: new Date().toISOString()
        })
        .eq('id', rack.id);

      if (error) throw error;
      toast.success('Rack assigned successfully');
      onRefresh();
    } catch (err) {
      console.error('Error assigning rack:', err);
      toast.error('Failed to assign rack');
    }
    setDraggedCompany(null);
  };

  // Handle reset rack
  const handleResetRack = async (rackId: string) => {
    if (!window.confirm('Are you sure you want to reset this rack? This will clear the assigned company and utilization.')) {
      return;
    }

    setIsResetting(rackId);
    try {
      // @ts-ignore - Database types are outdated, these columns exist
      const { error } = await supabase
        .from('racks')
        .update({
          company_id: null,
          status: 'AVAILABLE',
          utilization_percentage: 0,
          current_joints: 0,
          current_length_ft: 0,
          current_weight_lbs: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', rackId);

      if (error) throw error;
      toast.success('Rack reset successfully');
      onRefresh();
    } catch (err) {
      console.error('Error resetting rack:', err);
      toast.error('Failed to reset rack');
    } finally {
      setIsResetting(null);
    }
  };

  // Group racks by yard
  const racksByYard = yards.reduce((acc: any, yard: any) => {
    acc[yard.id] = racks.filter((r: any) => r.yard_id === yard.id);
    return acc;
  }, {});

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)]">
      {/* Company Sidebar (Draggable Sources) */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
        <GlassCard className="p-4 flex-1 overflow-hidden flex flex-col bg-slate-900/80 backdrop-blur-xl border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <BuildingIcon className="w-5 h-5 text-indigo-400" />
            Companies
          </h3>
          <div className="overflow-y-auto pr-2 space-y-2 flex-1 scrollbar-thin scrollbar-thumb-slate-700">
            {companies.map((company) => (
              <div
                key={company.id}
                draggable
                onDragStart={(e) => handleDragStart(e, company)}
                className="
                  p-3 rounded-lg border border-slate-700/50 bg-slate-800/40 
                  hover:bg-indigo-900/20 hover:border-indigo-500/50 
                  cursor-grab active:cursor-grabbing transition-all
                  group backdrop-blur-sm
                "
              >
                <div className="font-medium text-slate-200 group-hover:text-indigo-300 transition-colors">{company.name}</div>
                <div className="text-xs text-slate-500 mt-1">{company.domain || 'No domain'}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700/50 text-xs text-slate-400 text-center">
            Drag companies onto racks to assign
          </div>
        </GlassCard>
      </div>

      {/* Yards & Racks Map (Drop Targets) */}
      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 space-y-8">
        {yards.map((yard) => (
          <div key={yard.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <span className="w-2 h-8 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>
                {yard.name}
                <span className="text-sm font-normal text-slate-400 ml-2">
                  ({yard.location_code})
                </span>
              </h2>
              <div className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
                {racksByYard[yard.id]?.length || 0} Racks
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {racksByYard[yard.id]?.map((rack: any) => {
                const assignedCompany = companies.find(c => c.id === rack.company_id);
                const isOccupied = !!rack.company_id;
                const utilization = rack.utilization_percentage || 0;

                return (
                  <div
                    key={rack.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, rack)}
                    className={`
                      relative p-4 rounded-xl border transition-all duration-300 backdrop-blur-sm
                      ${isOccupied 
                        ? 'bg-slate-800/60 border-slate-600/50 shadow-lg' 
                        : 'bg-slate-900/20 border-slate-800 border-dashed hover:border-indigo-500/50 hover:bg-indigo-500/10'
                      }
                    `}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="font-mono text-lg font-bold text-white">
                        {rack.name}
                      </div>
                      {isOccupied && (
                        <button
                          onClick={() => handleResetRack(rack.id)}
                          disabled={isResetting === rack.id}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1 rounded hover:bg-rose-500/10"
                          title="Reset Rack"
                        >
                          <XCircleIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {isOccupied ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs border border-indigo-500/30">
                            {assignedCompany?.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">
                              {assignedCompany?.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              Assigned
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Utilization</span>
                            <span className={utilization > 90 ? 'text-rose-400' : 'text-emerald-400'}>{utilization}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,0,0,0.3)] ${
                                utilization > 90 ? 'bg-rose-500' :
                                utilization > 70 ? 'bg-amber-500' :
                                'bg-emerald-500'
                              }`}
                              style={{ width: `${utilization}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 flex items-center justify-center text-slate-600 text-sm font-medium border-2 border-dashed border-slate-800 rounded-lg">
                        Drop Company Here
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StorageManagement;
