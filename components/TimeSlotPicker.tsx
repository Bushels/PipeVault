/**
 * Time Slot Picker Component
 * Allows customers to select delivery time slot with MPS receiving hours
 * MPS Hours: 7am-4pm weekdays
 * Off-hours surcharge: $450
 */

import React, { useState, useMemo } from 'react';
import Button from './ui/Button';

export interface TimeSlot {
  start: Date;
  end: Date;
  is_after_hours: boolean;
  surcharge_amount: number;
}

interface TimeSlotPickerProps {
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  blockedSlots?: string[]; // Array of ISO datetime strings for blocked slots
}

const MPS_RECEIVING_START = 7; // 7am
const MPS_RECEIVING_END = 16; // 4pm (16:00 in 24hr format)
const OFF_HOURS_SURCHARGE = 450;
const SLOT_DURATION_HOURS = 1; // Each delivery slot is 1 hour

/**
 * Check if a datetime is within MPS receiving hours (7am-4pm weekdays)
 */
const isWithinReceivingHours = (date: Date): boolean => {
  const day = date.getDay(); // 0=Sunday, 6=Saturday
  const hour = date.getHours();

  // Must be weekday (Monday-Friday)
  if (day === 0 || day === 6) return false;

  // Must be between 7am and 4pm
  return hour >= MPS_RECEIVING_START && hour < MPS_RECEIVING_END;
};

/**
 * Generate available time slots for next 14 days
 */
const generateTimeSlots = (blockedSlots: string[] = []): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const now = new Date();
  const blockedSet = new Set(blockedSlots);

  // Generate slots for next 14 days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    // Generate time slots throughout the day
    for (let hour = 6; hour <= 18; hour += SLOT_DURATION_HOURS) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setTime(slotStart.getTime() + SLOT_DURATION_HOURS * 60 * 60 * 1000);

      // Skip slots in the past
      if (slotStart < now) continue;

      // Check if slot is blocked
      if (blockedSet.has(slotStart.toISOString())) continue;

      const isAfterHours = !isWithinReceivingHours(slotStart);

      slots.push({
        start: slotStart,
        end: slotEnd,
        is_after_hours: isAfterHours,
        surcharge_amount: isAfterHours ? OFF_HOURS_SURCHARGE : 0
      });
    }
  }

  return slots;
};

/**
 * Format time slot for display
 */
const formatTimeSlot = (slot: TimeSlot): string => {
  const startTime = slot.start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const endTime = slot.end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `${startTime} - ${endTime}`;
};

/**
 * Format date for display
 */
const formatDate = (date: Date): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const slotDate = new Date(date);
  slotDate.setHours(0, 0, 0, 0);

  if (slotDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (slotDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
};

const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  selectedSlot,
  onSelectSlot,
  blockedSlots = []
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const allSlots = useMemo(() => generateTimeSlots(blockedSlots), [blockedSlots]);

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, TimeSlot[]> = {};

    allSlots.forEach(slot => {
      const dateKey = slot.start.toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(slot);
    });

    return grouped;
  }, [allSlots]);

  const dates = Object.keys(slotsByDate);

  // Auto-select first available date
  React.useEffect(() => {
    if (!selectedDate && dates.length > 0) {
      setSelectedDate(dates[0]);
    }
  }, [dates, selectedDate]);

  const slotsForSelectedDate = selectedDate ? slotsByDate[selectedDate] || [] : [];

  return (
    <div className="space-y-6">
      {/* MPS Hours Banner */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white mb-1">MPS Receiving Hours</h4>
            <p className="text-xs text-gray-300">
              <strong>Standard Hours:</strong> Monday-Friday, 7:00 AM - 4:00 PM
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Off-hours deliveries available with additional surcharge
            </p>
          </div>
        </div>
      </div>

      {/* Date Selection */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-3">
          Select Delivery Date
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {dates.map(dateKey => {
            const date = new Date(dateKey);
            const isSelected = selectedDate === dateKey;

            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDate(dateKey)}
                className={`
                  px-4 py-3 rounded-lg border-2 transition-all
                  ${isSelected
                    ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-indigo-500/50'
                  }
                `}
              >
                <div className="text-xs font-semibold">{formatDate(date)}</div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slot Selection */}
      {selectedDate && (
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-3">
            Select Time Slot
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {slotsForSelectedDate.map((slot, index) => {
              const isSelected = selectedSlot?.start.getTime() === slot.start.getTime();

              return (
                <button
                  key={index}
                  onClick={() => onSelectSlot(slot)}
                  className={`
                    relative px-4 py-4 rounded-lg border-2 transition-all text-left
                    ${isSelected
                      ? 'bg-indigo-600 border-indigo-500'
                      : slot.is_after_hours
                        ? 'bg-yellow-900/20 border-yellow-600/50 hover:border-yellow-500'
                        : 'bg-green-900/20 border-green-600/50 hover:border-green-500'
                    }
                  `}
                >
                  {/* Time */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">
                      {formatTimeSlot(slot)}
                    </span>
                    {!slot.is_after_hours ? (
                      <span className="text-xs px-2 py-0.5 bg-green-600/30 text-green-300 rounded-full border border-green-500/50">
                        Standard
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-yellow-600/30 text-yellow-300 rounded-full border border-yellow-500/50">
                        Off-hours
                      </span>
                    )}
                  </div>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Slot Summary */}
      {selectedSlot && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-bold text-white mb-2">Selected Time Slot</h4>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300">
                <strong>{formatDate(selectedSlot.start)}</strong> - {formatTimeSlot(selectedSlot)}
              </p>
              {selectedSlot.is_after_hours && (
                <p className="text-yellow-300 text-sm mt-1">
                  ⚠️ Off-hours surcharge: ${selectedSlot.surcharge_amount}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => onSelectSlot(null as any)}
              className="px-3 py-1 text-xs"
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeSlotPicker;
