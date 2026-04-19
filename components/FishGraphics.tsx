
import React from 'react';

export const FishSilhouette = ({ className = "", color = "currentColor" }) => (
  <svg 
    viewBox="0 0 200 100" 
    className={`${className} animate-swim`} 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M10 50 C 30 20, 80 10, 140 40 C 160 30, 180 20, 190 30 C 185 50, 185 50, 190 70 C 180 80, 160 70, 140 60 C 80 90, 30 80, 10 50 Z" 
      fill={color}
    />
    <path 
      d="M140 40 Q 130 50 140 60" 
      stroke="white" 
      strokeWidth="1" 
      strokeOpacity="0.3"
    />
    <circle cx="45" cy="45" r="3" fill="white" fillOpacity="0.5" />
  </svg>
);

export const OrangeFish = ({ className = "" }) => <FishSilhouette className={className} color="#F97316" />;
export const BlueFish = ({ className = "" }) => <FishSilhouette className={className} color="#3B82F6" />;
