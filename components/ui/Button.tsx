import React from 'react';
import GlassButton from './GlassButton';

// Re-exporting GlassButton as Button for backward compatibility
// but mapping the old props to the new system where possible.

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  return (
    <GlassButton
      variant={variant}
      className={className}
      {...props}
    >
      {children}
    </GlassButton>
  );
};

export default Button;
