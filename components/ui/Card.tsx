import React from 'react';
import GlassCard from './GlassCard';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', hoverEffect = false }) => {
  return (
    <GlassCard className={className} hoverEffect={hoverEffect}>
      {children}
    </GlassCard>
  );
};

export default Card;
