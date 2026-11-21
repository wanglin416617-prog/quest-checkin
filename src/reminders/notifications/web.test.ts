import { afterEach, describe, expect, it, vi } from "vitest";
import { webNotificationAdapter } from "@/reminders/notifications/web";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("webNotificationAdapter", () => {
  it("reports unsupported when the Notification API is missing", async () => {
    vi.stubGlobal("Notification", undefined);
    expect(webNotificationAdapter.kind).toBe("web");
    expect(webNotificationAdapter.isSupported()).toBe(false);
    expect(await webNotificationAdapter.checkPermissions()).toBe("unsupported");
    expect(await webNotificationAdapter.requestPermissions()).toBe("unsupported");
    await expect(
      webNotificationAdapter.schedule({
        id: 1,
        title: "午餐",
        body: "到点了",
        hour: 12,
        minute: 0,
      }),
    ).resolves.toBeUndefined();
    await expect(webNotificationAdapter.cancel([1])).resolves.toBeUndefined();
  });

  it("maps Notification.permission values", async () => {
    class FakeNotification {
      static permission = "granted";
      static requestPermission = vi.fn(async () => "granted");
    }
    vi.stubGlobal("Notification", FakeNotification);
    expect(webNotificationAdapter.isSupported()).toBe(true);
    expect(await webNotificationAdapter.checkPermissions()).toBe("granted");

    FakeNotification.permission = "denied";
    expect(await webNotificationAdapter.checkPermissions()).toBe("denied");

    FakeNotification.permission = "default";
    expect(await webNotificationAdapter.checkPermissions()).toBe("prompt");
    expect(await webNotificationAdapter.requestPermissions()).toBe("granted");
    expect(FakeNotification.requestPermission).toHaveBeenCalledOnce();
  });
});
