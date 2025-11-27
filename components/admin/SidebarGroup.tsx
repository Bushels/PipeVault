import React, { useState } from 'react';
import { ChevronRightIcon, ExpandIcon, CollapseIcon } from '../icons/Icons';

export interface SidebarItem {
  id: string;
  label: string;
  badge?: number;
  badgeColor?: 'amber' | 'emerald' | 'blue' | 'rose';
  onClick?: () => void;
}

interface SidebarGroupProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: SidebarItem[];
  collapsed: boolean;
  activeItem?: string;
  onNavigate: (id: string) => void;
}

const SidebarGroup: React.FC<SidebarGroupProps> = ({
  label,
  icon,
  items,
  collapsed,
  activeItem,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  // If the sidebar is collapsed, this group is just an icon button (tooltip logic would go here)
  // But for this design, we might want to show the group icon and maybe a flyout menu on hover?
  // For simplicity in this shell, if sidebar is collapsed, we just show the group icon.
  // If items are clicked, we navigate.

  if (collapsed) {
    return (
      <div className="relative group py-3 px-2 flex justify-center">
        <div className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer">
          {icon}
        </div>
        {/* Tooltip / Flyout could be added here */}
      </div>
    );
  }

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </div>
        <div className={`transform transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
          <ChevronRightIcon className="w-3 h-3" />
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="mt-1 space-y-0.5 px-2">
          {items.map((item) => {
            const isActive = activeItem === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-400 font-medium border border-indigo-500/20'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 hover:pl-4'
                }`}
              >
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.badgeColor === 'amber'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : item.badgeColor === 'emerald'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : item.badgeColor === 'rose'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SidebarGroup;
