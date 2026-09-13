import React from 'react';
import { Heart, Shield } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700">AppointEase</span>
            <span>&bull;</span>
            <span>Smart Appointment Booking Platform</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <Shield className="w-3.5 h-3.5 text-teal-600 mr-1" />
              Double-Booking Prevention Engine Architecture
            </span>
            <span>&bull;</span>
            <span>Hiring Assignment Task 3</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
