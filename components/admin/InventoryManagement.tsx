import React, { useState } from 'react';
import { Pipe, Company } from '../../types';
import GlassCard from '../ui/GlassCard';
import GlassButton from '../ui/GlassButton';

interface InventoryManagementProps {
  inventory: Pipe[];
  companies: Company[];
}

const InventoryManagement: React.FC<InventoryManagementProps> = ({
  inventory,
  companies,
}) => {
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPerPage, setInventoryPerPage] = useState(50);

  // Calculate pagination
  const totalItems = inventory.length;
  const totalPages = Math.ceil(totalItems / inventoryPerPage);
  const startIndex = (inventoryPage - 1) * inventoryPerPage;
  const endIndex = startIndex + inventoryPerPage;
  const paginatedInventory = inventory.slice(startIndex, endIndex);

  // Generate page numbers to show (max 7: first, last, current, and 2 on each side)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (inventoryPage > 3) pages.push('...');
      for (let i = Math.max(2, inventoryPage - 1); i <= Math.min(totalPages - 1, inventoryPage + 1); i++) {
        pages.push(i);
      }
      if (inventoryPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold bg-linear-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent tracking-tight">Inventory</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} items
          </span>
          <select
            value={inventoryPerPage}
            onChange={e => {
              setInventoryPerPage(Number(e.target.value));
              setInventoryPage(1); // Reset to page 1 when changing per-page
            }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1 text-xs text-slate-300 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={200}>200 per page</option>
          </select>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-0.5 bg-linear-to-r from-emerald-600/30 via-teal-600/30 to-cyan-600/30 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition duration-500"></div>
        <GlassCard className="relative overflow-x-auto bg-linear-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl border-slate-700/50 shadow-2xl">
          <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 via-teal-500/5 to-cyan-500/5 rounded-xl"></div>
          <div className="relative">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700/50 bg-slate-800/30">
                <tr>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Pipe ID</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Company</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Reference ID</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Rack</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Well Name</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInventory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      No inventory items found
                    </td>
                  </tr>
                ) : (
                  paginatedInventory.map(pipe => (
                    <tr key={pipe.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-slate-400">{pipe.id}</td>
                      <td className="py-3 px-4 text-slate-300">
                        {companies.find(c => c.id === pipe.companyId)?.name || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-white font-medium">{pipe.referenceId}</td>
                      <td className="py-3 px-4 text-slate-400">{pipe.rackId || '-'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            pipe.status === 'IN_STORAGE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_5px_rgba(16,185,129,0.2)]'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_5px_rgba(59,130,246,0.2)]'
                          }`}
                        >
                          {pipe.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{pipe.assignedWellName || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <GlassButton
            onClick={() => setInventoryPage(prev => Math.max(1, prev - 1))}
            disabled={inventoryPage === 1}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm border border-slate-700"
          >
            Previous
          </GlassButton>

          {getPageNumbers().map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-slate-500">
                ...
              </span>
            ) : (
              <GlassButton
                key={page}
                onClick={() => setInventoryPage(page as number)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  inventoryPage === page
                    ? 'bg-indigo-600 text-white font-semibold shadow-[0_0_10px_rgba(99,102,241,0.4)]'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {page}
              </GlassButton>
            )
          )}

          <GlassButton
            onClick={() => setInventoryPage(prev => Math.min(totalPages, prev + 1))}
            disabled={inventoryPage === totalPages}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm border border-slate-700"
          >
            Next
          </GlassButton>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;
