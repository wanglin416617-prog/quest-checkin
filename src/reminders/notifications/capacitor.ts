import { LocalNotifications } from "@capacitor/local-notifications";
import type {
  NotificationAdapter,
  PermissionState,
  ScheduleNotificationInput,
} from "@/reminders/notifications/types";

function mapPermission(value: string | undefined): PermissionState {
  if (value === "granted") {
    return "granted";
  }
  if (value === "denied") {
    return "denied";
  }
  if (value === "prompt" || value === "prompt-with-rationale") {
    return "prompt";
  }
  return "unsupported";
}

export const capacitorNotificationAdapter: NotificationAdapter = {
  kind: "capacitor",

  isSupported(): boolean {
    return true;
  },

  async checkPermissions(): Promise<PermissionState> {
    const status = await LocalNotifications.checkPermissions();
    return mapPermission(status.display);
  },

  async requestPermissions(): Promise<PermissionState> {
    const status = await LocalNotifications.requestPermissions();
    return mapPermission(status.display);
  },

  async schedule(input: ScheduleNotificationInput): Promise<void> {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: input.id,
          title: input.title,
          body: input.body,
          schedule: {
            on: { hour: input.hour, minute: input.minute },
            allowWhileIdle: true,
          },
        },
      ],
    });
  },

  async cancel(ids: number[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  },
};
