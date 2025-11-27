import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  delay?: number;
}

const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className, 
  hoverEffect = false,
  delay = 0,
  ...props 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay, ease: "easeOut" }}
      className={cn(
        "glass-panel rounded-xl p-6 relative overflow-hidden",
        hoverEffect && "glass-panel-hover cursor-pointer",
        className
      )}
      {...props as any}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

export default GlassCard;
