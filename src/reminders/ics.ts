import ical, { ICalAlarmType, ICalCalendarMethod, ICalEventRepeatingFreq } from "ical-generator";

export interface IcsReminderInput {
  id: string;
  title: string;
  hour: number;
  minute: number;
  timeZone?: string;
  /** First occurrence date in the local timezone. */
  startDate: Date;
}

export function exportDailyRemindersIcs(
  reminders: IcsReminderInput[],
  options: { calendarName?: string; timeZone?: string } = {},
): string {
  const timeZone = options.timeZone ?? "Asia/Shanghai";
  const calendar = ical({
    name: options.calendarName ?? "小目标闯关",
    method: ICalCalendarMethod.PUBLISH,
    timezone: timeZone,
    prodId: { company: "quest-checkin", product: "小目标闯关", language: "ZH" },
  });

  for (const reminder of reminders) {
    const start = new Date(reminder.startDate);
    start.setHours(reminder.hour, reminder.minute, 0, 0);
    const end = new Date(start.getTime() + 30 * 60_000);

    calendar.createEvent({
      id: reminder.id,
      start,
      end,
      summary: reminder.title,
      timezone: reminder.timeZone ?? timeZone,
      repeating: {
        freq: ICalEventRepeatingFreq.DAILY,
      },
      alarms: [
        {
          type: ICalAlarmType.display,
          trigger: 0,
        },
      ],
    });
  }

  return calendar.toString();
}
