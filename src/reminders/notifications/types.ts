export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

export interface ScheduleNotificationInput {
  id: number;
  title: string;
  body: string;
  hour: number;
  minute: number;
}

export interface NotificationAdapter {
  readonly kind: "web" | "capacitor";
  isSupported(): boolean;
  checkPermissions(): Promise<PermissionState>;
  requestPermissions(): Promise<PermissionState>;
  schedule(input: ScheduleNotificationInput): Promise<void>;
  cancel(ids: number[]): Promise<void>;
}
