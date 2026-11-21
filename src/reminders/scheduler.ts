export interface DailyReminder {
  id: string;
  title: string;
  hour: number;
  minute: number;
}

export interface MissedReminder extends DailyReminder {
  scheduledAt: Date;
  overdueMinutes: number;
}

function scheduledOnDay(reminder: DailyReminder, day: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    reminder.hour,
    reminder.minute,
    0,
    0,
  );
}

/**
 * Reminders that were due after the last time the app was opened and before `now`.
 * Used for in-app catch-up prompts.
 */
export function findMissedReminders(
  reminders: DailyReminder[],
  now: Date,
  lastOpenedAt: Date,
): MissedReminder[] {
  const missed: MissedReminder[] = [];
  for (const reminder of reminders) {
    const dueToday = scheduledOnDay(reminder, now);
    const dueYesterday = scheduledOnDay(
      reminder,
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
    );
    for (const due of [dueYesterday, dueToday]) {
      if (due.getTime() <= lastOpenedAt.getTime()) {
        continue;
      }
      if (due.getTime() > now.getTime()) {
        continue;
      }
      missed.push({
        ...reminder,
        scheduledAt: due,
        overdueMinutes: Math.floor((now.getTime() - due.getTime()) / 60_000),
      });
    }
  }
  return missed.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}
