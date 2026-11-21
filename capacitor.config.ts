import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.wanglin.questcheckin",
  appName: "共同的努力",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
