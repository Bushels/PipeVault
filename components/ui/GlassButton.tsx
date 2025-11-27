import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}) => {
  
  const variants = {
    primary: "bg-cyan-500/20 border-cyan-500/50 text-cyan-100 hover:bg-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]",
    secondary: "bg-slate-800/50 border-slate-600/50 text-slate-200 hover:bg-slate-700/60 hover:border-slate-500/50",
    danger: "bg-red-500/20 border-red-500/50 text-red-100 hover:bg-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]",
    ghost: "bg-transparent border-transparent hover:bg-slate-800/30 text-slate-400 hover:text-slate-200",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
    icon: "h-10 w-10 p-2 flex items-center justify-center",
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      className={cn(
        "relative inline-flex items-center justify-center rounded-lg border backdrop-blur-md transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props as any}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      
      {/* Shine effect on hover for primary variant */}
      {variant === 'primary' && !disabled && !isLoading && (
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-lg">
          <div className="absolute top-0 -left-full h-full w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-white/10 to-transparent group-hover:animate-shine" />
        </div>
      )}
    </motion.button>
  );
};

export default GlassButton;
