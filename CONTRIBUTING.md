# 贡献指南

感谢你参与「小目标闯关」。

## 开发流程

1. 使用 Node.js 26 与 pnpm 12。
2. 从 `main` 拉出短生命周期分支（建议 `feat/...` 或 `fix/...`）。
3. 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)，例如 `feat(domain): add streak multiplier cap`。仓库用 commitlint 检查。
4. 通过 Pull Request 合入 `main`。PR 必须通过 CI：lint、typecheck、许可证检查、单测（含覆盖率）、build。

## 代码约定

- 业务规则只放在 `src/domain` 与 `src/goalTypes`，保持纯函数，并补上 Vitest 单测。
- 体重以千克（kg）存储；金额以整数分存储。单位换算只写在 `src/domain/units.ts`。
- UI 不要直接操作 Dexie 表，走 `src/db` 仓储。
- 平台通知走 `src/reminders/notifications` 适配层，不要在功能模块里直接依赖 Capacitor。

## 依赖与许可证

新增依赖必须是宽松许可证（MIT、Apache-2.0、ISC、BSD 等）。**禁止**引入 GPL、AGPL、LGPL 或其变体。提交前请运行：

```bash
pnpm license-check
```

白名单配置在 `.license-compliancerc.json`。说明：

- `MPL-2.0`：Vite 8 的传递依赖 `lightningcss` 使用 Mozilla Public License 2.0。这是文件级弱 copyleft，不是 GPL / AGPL / LGPL。
- `spdx-ranges` 被排除：它只被 `license-compliance` 自己依赖，许可证为 `(MIT AND CC-BY-3.0)`（两项均已在白名单中）。该工具无法把这个 AND 表达式识别为合规，故单独排除，而不是放宽红线。

若工具报告未知许可证，先核对上游 LICENSE，再在 PR 里说明是否加入白名单，禁止无说明放行。

## 安全

不要提交密钥、token、`.env`、keystore、`local.properties`、`google-services.json`、用户备份或个人数据。
