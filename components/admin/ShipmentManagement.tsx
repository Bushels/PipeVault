import React, { useState } from 'react';
import { Shipment, Pipe, Company, ShipmentStatus } from '../../types';
import GlassCard from '../ui/GlassCard';
import GlassButton from '../ui/GlassButton';
import { formatDate, formatStatus } from '../../utils/dateUtils';
import { Search, Filter, Truck, Calendar, FileText, AlertCircle } from 'lucide-react';

interface ShipmentManagementProps {
  shipments: Shipment[];
  inventory: Pipe[];
  companies: Company[];
}

const ShipmentManagement: React.FC<ShipmentManagementProps> = ({
  shipments,
  inventory,
  companies,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'ALL'>('ALL');

  const filteredShipments = shipments.filter((shipment) => {
    const company = companies.find((c) => c.id === shipment.companyId);
    const companyName = company?.name.toLowerCase() || '';
    const referenceId = shipment.requestId.toLowerCase(); // Assuming requestId is used as reference for now, or we need to fetch request details
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch =
      companyName.includes(searchLower) ||
      referenceId.includes(searchLower) ||
      shipment.id.toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === 'ALL' || shipment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getCompany = (companyId: string) => companies.find((c) => c.id === companyId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Shipment Management</h2>
          <p className="text-slate-400 mt-1">Track and manage all inbound and outbound shipments.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search shipments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ShipmentStatus | 'ALL')}
            className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SCHEDULING">Scheduling</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 font-semibold">
              <tr>
                <th className="px-6 py-4">Shipment ID / Company</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Trucks</th>
                <th className="px-6 py-4">Schedule</th>
                <th className="px-6 py-4">Documents</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Truck className="w-8 h-8 opacity-50" />
                      <p>No shipments found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shipment) => {
                  const company = getCompany(shipment.companyId);
                  const totalTrucks = shipment.trucks?.length || 0;
                  const receivedTrucks = shipment.trucks?.filter((t) => t.status === 'RECEIVED').length || 0;
                  const docsCount = shipment.documents?.length || 0;

                  return (
                    <tr key={shipment.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-white">{company?.name || 'Unknown Company'}</span>
                          <span className="text-xs text-slate-500 font-mono">{shipment.id.slice(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          shipment.status === 'RECEIVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          shipment.status === 'IN_TRANSIT' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          shipment.status === 'SCHEDULED' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          shipment.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {formatStatus(shipment.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Truck className="w-4 h-4 text-slate-500" />
                          <span>{receivedTrucks} / {totalTrucks}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-2 text-slate-300">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span>{shipment.updatedAt ? formatDate(shipment.updatedAt) : '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-300">
                          <FileText className="w-4 h-4 text-slate-500" />
                          <span>{docsCount}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <GlassButton variant="secondary" className="text-xs">
                          View Details
                        </GlassButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};

export default ShipmentManagement;
