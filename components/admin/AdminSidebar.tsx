import React from 'react';
import {
  HomeIcon,
  CheckCircleIcon,
  TruckIcon,
  BuildingIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../icons/Icons';
import SidebarGroup, { SidebarItem } from './SidebarGroup';

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: string;
  onNavigate: (section: string) => void;
  badges: {
    pendingApprovals: number;
    pendingLoads: number;
    approvedLoads: number;
    inTransitLoads: number;
    outboundLoads: number;
  };
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  collapsed,
  onToggle,
  activeSection,
  onNavigate,
  badges,
  mobileOpen = false,
  onMobileClose,
}) => {
  const sidebarGroups = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <HomeIcon className="w-5 h-5" />,
      items: [
        { id: 'overview', label: 'Overview' },
      ],
    },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: <CheckCircleIcon className="w-5 h-5" />,
      items: [
        {
          id: 'approvals',
          label: 'Pending Approvals',
          badge: badges.pendingApprovals,
          badgeColor: 'amber' as const,
        },
      ],
    },
    {
      id: 'logistics',
      label: 'Logistics Flow',
      icon: <TruckIcon className="w-5 h-5" />,
      items: [
        {
          id: 'pending-loads',
          label: 'Pending Loads',
          badge: badges.pendingLoads,
          badgeColor: 'amber' as const,
        },
        {
          id: 'approved-loads',
          label: 'Approved Loads',
          badge: badges.approvedLoads,
          badgeColor: 'blue' as const,
        },
        {
          id: 'in-transit',
          label: 'In Transit',
          badge: badges.inTransitLoads,
          badgeColor: 'emerald' as const,
        },
        {
          id: 'outbound-loads',
          label: 'Outbound',
          badge: badges.outboundLoads,
          badgeColor: 'blue' as const,
        },
      ],
    },
    {
      id: 'operations',
      label: 'Operations',
      icon: <BuildingIcon className="w-5 h-5" />,
      items: [
        { id: 'requests', label: 'All Requests' },
        { id: 'companies', label: 'Companies' },
        { id: 'inventory', label: 'Inventory' },
        { id: 'storage', label: 'Storage Yards' },
      ],
    },
    {
      id: 'docs-ai',
      label: 'Documents & AI',
      icon: <DocumentTextIcon className="w-5 h-5" />,
      items: [
        { id: 'shipments', label: 'Shipments' },
        { id: 'ai', label: 'AI Assistant' },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          fixed left-0 top-16 h-[calc(100vh-4rem)] z-50
          glass-panel border-l-0 border-y-0 rounded-none
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-16' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Collapse Toggle (Desktop Only) */}
        <button
          onClick={onToggle}
          className="
            absolute -right-3 top-6 z-50
            w-6 h-6 rounded-full
            bg-cyan-500 hover:bg-cyan-400
            shadow-[0_0_10px_rgba(6,182,212,0.5)]
            hidden lg:flex items-center justify-center
            transition-all duration-200
            text-black
          "
        >
          {collapsed ? (
            <ChevronRightIcon className="w-3 h-3" />
          ) : (
            <ChevronLeftIcon className="w-3 h-3" />
          )}
        </button>

        {/* Scrollable Content */}
        <div className="h-full overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <div className="space-y-2">
            {sidebarGroups.map((group) => (
              <SidebarGroup
                key={group.id}
                id={group.id}
                label={group.label}
                icon={group.icon}
                items={group.items}
                collapsed={collapsed && !mobileOpen} // Expand on mobile when open
                activeItem={activeSection}
                onNavigate={(id) => {
                  onNavigate(id);
                  if (mobileOpen && onMobileClose) onMobileClose();
                }}
              />
            ))}
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
