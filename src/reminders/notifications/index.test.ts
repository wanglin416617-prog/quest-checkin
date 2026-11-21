import { describe, expect, it, vi } from "vitest";
import { getNotificationAdapter } from "@/reminders/notifications";

vi.mock("@/lib/platform", () => ({
  isNativeApp: () => false,
}));

describe("getNotificationAdapter", () => {
  it("uses the web adapter when not running inside Capacitor", () => {
    const adapter = getNotificationAdapter();
    expect(adapter.kind).toBe("web");
  });
});
