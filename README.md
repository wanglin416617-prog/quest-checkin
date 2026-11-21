# 小目标闯关（quest-checkin）

把自律变成闯关游戏：每天打卡小目标，攒积分换你自己定的奖励。

本仓库是 **PWA + 安卓 APK** 的应用骨架。数据只存在用户自己的设备上（IndexedDB），不注册、不登录。奖励全部是虚拟积分，不涉及真实支付或银行连接。

## 技术栈

- React 19 + TypeScript 6 + Vite 8
- vite-plugin-pwa（Workbox）
- Dexie（IndexedDB）
- Capacitor 8（安卓本地通知）
- 日历导出：ical-generator（RFC 5545，含 RRULE / VALARM）

## 环境要求

- Node.js 26（Active LTS）
- pnpm 12（仓库已通过 `packageManager` 字段锁定 12.21.0，推荐用 Corepack）

```bash
corepack enable
corepack prepare pnpm@12.21.0 --activate
pnpm install
```

## 常用命令

```bash
pnpm dev             # 本地开发
pnpm lint            # ESLint
pnpm typecheck       # tsc --noEmit
pnpm test            # Vitest 单测
pnpm test:coverage   # 单测 + 覆盖率
pnpm license-check   # 依赖许可证白名单（禁止 GPL / AGPL / LGPL）
pnpm build           # 生产构建
pnpm preview         # 预览生产构建
```

## PWA 与安卓

- 用支持的移动浏览器打开生产构建并「添加到主屏幕」，首次打开后核心功能应可离线使用。
- 纯网页无法在应用关闭时可靠地准点提醒。安卓用户建议安装 APK（Capacitor 本地通知）；iOS 可用导出的 `.ics` 交由系统日历提醒。
- 调试包由 CI 的 `android.yml` 构建并上传 artifact。签名密钥不进入本仓库，正式签名在本地完成。
- 本应用暂不上应用商店。

## 许可证

[MIT](./LICENSE) © 2026 wanglin416617-prog

贡献方式见 [CONTRIBUTING.md](./CONTRIBUTING.md)。Habitica、Loop Habit Tracker 等 GPL 项目只借鉴公开产品思路，不拷贝其代码或素材。
