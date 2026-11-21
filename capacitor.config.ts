import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.questcheckin.twa",
  appName: "小目标闯关",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
