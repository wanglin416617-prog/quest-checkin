import type {
  NotificationAdapter,
  PermissionState,
  ScheduleNotificationInput,
} from "@/reminders/notifications/types";

function notificationApi(): typeof Notification | undefined {
  return typeof Notification === "undefined" ? undefined : Notification;
}

export const webNotificationAdapter: NotificationAdapter = {
  kind: "web",

  isSupported(): boolean {
    return notificationApi() !== undefined;
  },

  async checkPermissions(): Promise<PermissionState> {
    const api = notificationApi();
    if (!api) {
      return "unsupported";
    }
    if (api.permission === "granted") {
      return "granted";
    }
    if (api.permission === "denied") {
      return "denied";
    }
    return "prompt";
  },

  async requestPermissions(): Promise<PermissionState> {
    const api = notificationApi();
    if (!api) {
      return "unsupported";
    }
    const result = await api.requestPermission();
    if (result === "granted") {
      return "granted";
    }
    if (result === "denied") {
      return "denied";
    }
    return "prompt";
  },

  async schedule(_input: ScheduleNotificationInput): Promise<void> {
    // Web pages cannot reliably fire exact alarms when the app is closed.
    // In-app scheduling and catch-up prompts live in scheduler.ts.
  },

  async cancel(_ids: number[]): Promise<void> {
    // No-op: the Web Notification API has no persistent scheduled notifications.
  },
};
