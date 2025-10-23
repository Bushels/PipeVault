import React, { useState, useMemo } from 'react';
import type { AdminSession, StorageRequest, Company, Yard, YardArea, Rack, RequestStatus, TruckLoad, Pipe } from '../../types';
import AdminHeader from './AdminHeader';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { ChevronLeftIcon } from '../icons/Icons';
import TruckLoadHistory from './TruckLoadHistory';
import TruckReceiving from './TruckReceiving';

// --- UTILITY FUNCTIONS ---
const getCompanyName = (companyId: string, companies: Company[]) => {
    return companies.find(c => c.id === companyId)?.name || 'Unknown Company';
};

const getRequiredJoints = (request: StorageRequest): number => {
    return request.requestDetails?.totalJoints || 0;
};

// --- SUB-COMPONENTS ---
const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            active ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'
        }`}
    >
        {children}
    </button>
);

const YardStatusView: React.FC<{ yards: Yard[] }> = ({ yards }) => {
    const [expandedYards, setExpandedYards] = useState<string[]>([]);
    const [expandedAreas, setExpandedAreas] = useState<string[]>([]);

    const toggleYard = (yardId: string) => {
        setExpandedYards(prev => prev.includes(yardId) ? prev.filter(id => id !== yardId) : [...prev, yardId]);
    };
    const toggleArea = (areaId: string) => {
        setExpandedAreas(prev => prev.includes(areaId) ? prev.filter(id => id !== areaId) : [...prev, areaId]);
    };

    return (
        <Card>
            <h2 className="text-xl font-bold text-white mb-4">Yard Capacity Overview (by Total Length)</h2>
            <div className="space-y-4">
                {yards.map(yard => {
                    const totalCapacity = yard.areas.reduce((acc, area) => acc + area.racks.reduce((a, r) => a + r.capacityMeters, 0), 0);
                    const totalOccupied = yard.areas.reduce((acc, area) => acc + area.racks.reduce((a, r) => a + r.occupiedMeters, 0), 0);
                    const percentage = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;
                    const isYardExpanded = expandedYards.includes(yard.id);

                    return (
                        <div key={yard.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleYard(yard.id)}>
                                <div className="flex-grow">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                             <ChevronLeftIcon className={`w-5 h-5 transition-transform ${isYardExpanded ? '-rotate-90' : ''}`} />
                                            {yard.name}
                                        </h3>
                                        <span className="text-sm text-gray-400 font-mono">{totalOccupied.toFixed(0)} / {totalCapacity.toFixed(0)} meters</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-3">
                                        <div className="bg-red-600 h-3 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                                    </div>
                                </div>
                            </div>
                            {isYardExpanded && (
                                <div className="pl-6 mt-4 space-y-3">
                                    {yard.areas.map(area => {
                                        const areaCapacity = area.racks.reduce((acc, r) => acc + r.capacityMeters, 0);
                                        const areaOccupied = area.racks.reduce((acc, r) => acc + r.occupiedMeters, 0);
                                        const areaPercentage = areaCapacity > 0 ? (areaOccupied / areaCapacity) * 100 : 0;
                                        const isAreaExpanded = expandedAreas.includes(area.id);

                                        return (
                                            <div key={area.id}>
                                                <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleArea(area.id)}>
                                                     <div className="flex-grow">
                                                        <div className="flex justify-between items-baseline mb-1">
                                                            <h4 className="font-medium flex items-center gap-2">
                                                                <ChevronLeftIcon className={`w-4 h-4 transition-transform ${isAreaExpanded ? '-rotate-90' : ''}`} />
                                                                {area.name} Area
                                                            </h4>
                                                            <span className="text-xs text-gray-400 font-mono">{areaOccupied.toFixed(0)} / {areaCapacity.toFixed(0)} meters</span>
                                                        </div>
                                                        <div className="w-full bg-gray-600 rounded-full h-2">
                                                            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${areaPercentage}%` }}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                {isAreaExpanded && (
                                                    <div className="pl-6 mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                                        {area.racks.map(rack => (
                                                            <div key={rack.id} className="bg-gray-900 p-2 rounded-md text-center">
                                                                <p className="text-sm font-semibold">{rack.name}</p>
                                                                <p className="text-xs font-mono text-gray-400">{rack.occupied} / {rack.capacity} joints</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

const PendingRequestCard: React.FC<{
    request: StorageRequest;
    companyName: string;
    yards: Yard[];
    onApprove: (requestId: string, assignedRackIds: string[], requiredJoints: number) => void;
    onReject: (requestId: string, reason: string) => void;
}> = ({ request, companyName, yards, onApprove, onReject }) => {
    const [selectedRackIds, setSelectedRackIds] = useState<string[]>([]);
    const requiredJoints = useMemo(() => getRequiredJoints(request), [request]);

    const allRacks = useMemo(() => yards.flatMap(y => y.areas.flatMap(a => a.racks.map(r => ({
        ...r,
        yardName: y.name,
        areaName: a.name,
        available: r.capacity - r.occupied,
    })))), [yards]);

    const suggestedRacks = useMemo(() => {
        if (requiredJoints === 0) return [];
        
        const availableRacks = allRacks
            .filter(r => r.available > 0)
            // Prioritize Yard A (Open Storage)
            .sort((a, b) => {
                if (a.id.startsWith('A-') && !b.id.startsWith('A-')) return -1;
                if (!a.id.startsWith('A-') && b.id.startsWith('A-')) return 1;
                return b.available - a.available; // Then by most available space
            });

        let jointsNeeded = requiredJoints;
        const suggestions = [];
        for (const rack of availableRacks) {
            if (jointsNeeded <= 0) break;
            suggestions.push(rack.id);
            jointsNeeded -= rack.available;
        }
        return suggestions;
    }, [requiredJoints, allRacks]);

    React.useEffect(() => {
        setSelectedRackIds(suggestedRacks);
    }, [suggestedRacks]);

    const handleToggleRack = (rackId: string) => {
        setSelectedRackIds(prev => 
            prev.includes(rackId) ? prev.filter(id => id !== rackId) : [...prev, rackId]
        );
    };

    const handleReject = () => {
        const reason = window.prompt("Please provide a reason for rejecting this request:");
        if (reason && reason.trim() !== '') {
            onReject(request.id, reason);
        } else if (reason !== null) { // prompt was not cancelled
            alert("A reason is required to reject a request.");
        }
    };

    const totalSelectedCapacity = selectedRackIds.reduce((acc, rackId) => {
        const rack = allRacks.find(r => r.id === rackId);
        return acc + (rack?.available || 0);
    }, 0);
    
    const canFulfill = totalSelectedCapacity >= requiredJoints;
    const details = request.requestDetails;
    if (!details) return null;

    return (
        <Card className="flex flex-col md:flex-row gap-6">
            <div className="flex-grow space-y-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-bold text-white">{details.companyName} - {request.referenceId}</h3>
                        <p className="text-sm text-gray-400">Contact: {details.fullName} ({request.userId})</p>
                    </div>
                    <div className="text-right">
                        <p className="font-mono text-xl text-red-500">{requiredJoints} joints</p>
                        <p className="text-xs text-gray-400">Required</p>
                    </div>
                </div>
                <div className="bg-gray-700/50 p-3 rounded-md border border-gray-600 text-sm">
                    <p className="font-semibold mb-2">AI Summary:</p>
                    <p className="text-gray-300 whitespace-pre-wrap">{request.approvalSummary}</p>
                </div>
                <div>
                     <p className="text-sm font-medium text-gray-300 mb-2">Assign Storage (Suggested in <span className="text-red-400">Red</span>):</p>
                     <div className="max-h-40 overflow-y-auto bg-gray-900 p-2 rounded-md border border-gray-700 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                         {allRacks.filter(r => r.available > 0.1 || selectedRackIds.includes(r.id)).map(rack => (
                             <label key={rack.id} className={`flex items-center gap-2 p-2 rounded-md text-xs cursor-pointer ${selectedRackIds.includes(rack.id) ? 'bg-indigo-600' : 'bg-gray-800'}`}>
                                 <input type="checkbox" checked={selectedRackIds.includes(rack.id)} onChange={() => handleToggleRack(rack.id)} className="form-checkbox bg-gray-700 border-gray-500 text-indigo-500 focus:ring-indigo-500" />
                                 <div>
                                     <span className={`font-bold ${suggestedRacks.includes(rack.id) ? 'text-red-400' : 'text-white'}`}>{rack.id}</span>
                                     <span className="block text-gray-400">{(rack.available)} free</span>
                                 </div>
                             </label>
                         ))}
                     </div>
                     <div className={`text-xs mt-2 text-right ${canFulfill ? 'text-green-400' : 'text-yellow-400'}`}>
                        Selected Capacity: {totalSelectedCapacity} joints / {requiredJoints} joints
                    </div>
                </div>
            </div>
            <div className="flex-shrink-0 flex flex-row md:flex-col justify-end md:justify-start gap-2">
                <Button variant="danger" onClick={handleReject} className="w-full md:w-auto">Reject</Button>
                <Button onClick={() => onApprove(request.id, selectedRackIds, requiredJoints)} disabled={!canFulfill} className="w-full md:w-auto">Approve</Button>
            </div>
        </Card>
    );
};


// --- MAIN COMPONENT ---
interface AdminDashboardProps {
  session: AdminSession;
  onLogout: () => void;
  requests: StorageRequest[];
  companies: Company[];
  yards: Yard[];
  inventory: Pipe[];
  truckLoads: TruckLoad[];
  approveRequest: (requestId: string, assignedRackIds: string[], requiredJoints: number) => void;
  rejectRequest: (requestId: string, reason: string) => void;
  addTruckLoad: (truckLoad: Omit<TruckLoad, 'id'>, pipes?: Omit<Pipe, 'id'>[]) => void;
  pickUpPipes: (pipeIds: string[], uwi: string, wellName: string, truckLoadId?: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  session,
  onLogout,
  requests,
  companies,
  yards,
  inventory,
  truckLoads,
  approveRequest,
  rejectRequest,
  addTruckLoad,
  pickUpPipes,
}) => {
    const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'yards' | 'trucks'>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | RequestStatus>('ALL');
    const [showTruckReceiving, setShowTruckReceiving] = useState(false);
    
    const pendingRequests = requests.filter(r => r.status === 'PENDING');
    
    const sortedRequests = useMemo(() => 
        [...requests].sort((a, b) => new Date(b.requestDetails?.storageStartDate || 0).getTime() - new Date(a.requestDetails?.storageStartDate || 0).getTime()), 
    [requests]);

    const filteredRequests = useMemo(() => {
        return sortedRequests.filter(req => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = searchLower === '' ||
                (req.referenceId || '').toLowerCase().includes(searchLower) ||
                (req.requestDetails?.companyName || '').toLowerCase().includes(searchLower) ||
                (req.requestDetails?.fullName || '').toLowerCase().includes(searchLower) ||
                (req.userId || '').toLowerCase().includes(searchLower);

            const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [sortedRequests, searchTerm, statusFilter]);

    const renderContent = () => {
        switch (activeTab) {
            case 'pending':
                return (
                    <div className="space-y-6">
                        {pendingRequests.length > 0 ? (
                            pendingRequests.map(req => (
                                <PendingRequestCard 
                                    key={req.id}
                                    request={req}
                                    companyName={getCompanyName(req.companyId, companies)}
                                    yards={yards}
                                    onApprove={approveRequest}
                                    onReject={rejectRequest}
                                />
                            ))
                        ) : (
                            <Card className="text-center py-12">
                                <h3 className="text-lg font-medium">No Pending Requests</h3>
                                <p className="text-gray-400 mt-1">All incoming storage requests have been handled.</p>
                            </Card>
                        )}
                    </div>
                );
            case 'all':
                return (
                     <Card className="overflow-hidden">
                        <div className="flex flex-col sm:flex-row gap-4 mb-4">
                            <input 
                                type="text" 
                                placeholder="Search by company, ref ID, contact..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full sm:w-2/3 bg-gray-800 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value as any)}
                                className="w-full sm:w-1/3 bg-gray-800 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Approved</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="DRAFT">Draft</option>
                            </select>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-700">
                                <thead className="bg-gray-800">
                                    <tr>
                                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-300 sm:pl-6">Status</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Customer / Project</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Item Details</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Quantity</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Storage Dates</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Trucking</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-300">Location / Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800 bg-gray-900">
                                    {filteredRequests.map(req => {
                                        const details = req.requestDetails;
                                        const statusColors = {
                                            PENDING: 'bg-yellow-500/20 text-yellow-400',
                                            APPROVED: 'bg-green-500/20 text-green-400',
                                            COMPLETED: 'bg-blue-500/20 text-blue-400',
                                            REJECTED: 'bg-red-500/20 text-red-400',
                                            DRAFT: 'bg-gray-500/20 text-gray-400'
                                        };
                                        return (
                                            <tr key={req.id} className="hover:bg-gray-800/50">
                                                <td className="py-4 pl-4 pr-3 text-sm font-medium sm:pl-6">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[req.status]}`}>
                                                        {req.status}
                                                    </span>
                                                </td>
                                                 <td className="px-3 py-4 text-sm text-gray-300 whitespace-nowrap">
                                                    <div className="font-semibold text-white">{details?.companyName || getCompanyName(req.companyId, companies)}</div>
                                                    <div className="text-gray-400">{req.referenceId}</div>
                                                    <div className="text-gray-500 text-xs mt-1">{details?.fullName} ({req.userId})</div>
                                                </td>
                                                <td className="px-3 py-4 text-sm text-gray-300 whitespace-nowrap">
                                                    <div className="font-semibold text-white">{details?.itemType === 'Other' ? details.itemTypeOther : details?.itemType}</div>
                                                    {details?.casingSpec && (
                                                        <div className="text-gray-400 text-xs mt-1 font-mono">
                                                            OD: {details.casingSpec.size_in}" | Wt: {details.casingSpec.weight_lbs_ft}#
                                                        </div>
                                                    )}
                                                    <div className="text-gray-400 text-xs mt-1">
                                                        Grade: {details?.grade === 'Other' ? details.gradeOther : details?.grade} | Conn: {details?.connection === 'Other' ? details.connectionOther : details?.connection}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-sm text-center text-white font-mono">{getRequiredJoints(req) || 'N/A'}</td>
                                                <td className="px-3 py-4 text-sm text-gray-300 whitespace-nowrap">{details?.storageStartDate} to {details?.storageEndDate}</td>
                                                <td className="px-3 py-4 text-sm text-gray-300 capitalize">{req.truckingInfo?.truckingType}</td>
                                                <td className="px-3 py-4 text-sm text-gray-300 max-w-xs truncate">{req.assignedLocation || req.rejectionReason || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                     </Card>
                );
            case 'yards':
                return <YardStatusView yards={yards} />;
            case 'trucks':
                return <TruckLoadHistory truckLoads={truckLoads} />;
        }
    };

    const handleTruckLoadSubmit = (truckLoad: Omit<TruckLoad, 'id'>, pipes?: Omit<Pipe, 'id'>[]) => {
        const newTruckLoad = addTruckLoad(truckLoad, pipes);

        // If it's a pickup, update the pipe status
        if (truckLoad.type === 'PICKUP' && truckLoad.assignedUWI && truckLoad.assignedWellName) {
            pickUpPipes(truckLoad.relatedPipeIds, truckLoad.assignedUWI, truckLoad.assignedWellName, newTruckLoad.id);
        }
    };
    
    return (
        <div className="flex flex-col min-h-screen">
            <AdminHeader session={session} onLogout={onLogout} />
            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                    <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-lg">
                        <TabButton active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>Pending ({pendingRequests.length})</TabButton>
                        <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')}>All Requests</TabButton>
                        <TabButton active={activeTab === 'trucks'} onClick={() => setActiveTab('trucks')}>Truck Loads</TabButton>
                        <TabButton active={activeTab === 'yards'} onClick={() => setActiveTab('yards')}>Yard Status</TabButton>
                    </div>
                </div>
                {renderContent()}

                {/* Floating Action Button for Truck Receiving */}
                <button
                    onClick={() => setShowTruckReceiving(true)}
                    className="fixed bottom-8 right-8 bg-red-600 hover:bg-red-700 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg transition-all hover:scale-110 z-40"
                    title="Log Truck Load"
                >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>

                {/* Truck Receiving Modal */}
                {showTruckReceiving && (
                    <TruckReceiving
                        requests={requests}
                        inventory={inventory}
                        yards={yards}
                        onSubmit={handleTruckLoadSubmit}
                        onClose={() => setShowTruckReceiving(false)}
                    />
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;