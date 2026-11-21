import { isNativeApp } from "@/lib/platform";
import { capacitorNotificationAdapter } from "@/reminders/notifications/capacitor";
import type { NotificationAdapter } from "@/reminders/notifications/types";
import { webNotificationAdapter } from "@/reminders/notifications/web";

export type {
  NotificationAdapter,
  PermissionState,
  ScheduleNotificationInput,
} from "@/reminders/notifications/types";

export function getNotificationAdapter(): NotificationAdapter {
  return isNativeApp() ? capacitorNotificationAdapter : webNotificationAdapter;
}
