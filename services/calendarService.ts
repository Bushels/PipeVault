export interface DockAppointmentEvent {
  shipmentId: string;
  truckId: string;
  companyName: string;
  referenceId: string;
  slotStart: string;
  slotEnd: string;
  afterHours: boolean;
}

export interface CalendarReminder {
  offsetMinutes: number;
  label: string;
}

export interface CalendarSyncResult {
  eventId: string;
  reminders: CalendarReminder[];
}

/**
 * Schedules a dock appointment in the connected calendar system.
 * This is a stub implementation that simply logs intent so the UI
 * can be wired up before Outlook integration is completed.
 */
export const scheduleDockAppointment = async (
  event: DockAppointmentEvent,
): Promise<CalendarSyncResult> => {
  const eventId = `OUTLOOK-STUB-${event.truckId}-${Date.now()}`;

  console.log('[CalendarService] Syncing dock appointment to Outlook (stub)', {
    ...event,
    eventId,
  });

  return {
    eventId,
    reminders: [
      { offsetMinutes: 24 * 60, label: '24 hours before' },
      { offsetMinutes: 60, label: '1 hour before' },
    ],
  };
};

