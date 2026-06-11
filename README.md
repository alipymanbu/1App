# 🚀 1App — 多平台内容聚合桌面客户端

> **一站式浏览 B站、小红书、抖音**，告别在多个 App 间反复切换的烦恼。

[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](LICENSE)

---

## ✨ 功能亮点

### 📺 B站（Bilibili）
- ✅ 扫码登录，持久化会话
- ✅ 推荐 / 关注 / 用户视频 / 收藏夹 多维度信息流
- ✅ **🎬 DASH 自适应流播放** — 支持画质切换、倍速播放、缓存加速
- ✅ 点赞、投币、收藏（含文件夹管理）
- ✅ 评论区浏览（热门/最新排序，查看回复）

### 📕 小红书（Xiaohongshu）
- ✅ 扫码登录，持久化会话
- ✅ 推荐 & 关注双信息流
- ✅ 图文笔记查看（图片浏览 + 评论区）
- ✅ 用户主页 & 笔记详情

### 🎵 抖音（Douyin）
- ✅ 扫码登录，持久化会话
- ✅ 推荐信息流（滚动加载）
- ✅ 用户主页展示

### 🛠 通用功能
- 🔄 平台间一键切换
- 📊 用户资料 & 统计数据
- 📁 自定义数据 / 缓存目录
- 🔍 诊断日志导出
- 🌙 隐私优先 — 所有数据本地存储，无遥测无后端

### 🎨 UI 设计
- **极简浅色风格** — 播放器外壳、侧边面板、弹窗统一为白色卡片设计，视觉清爽
- **毛玻璃遮罩** — 弹层使用半透明白色毛玻璃(`backdrop-blur`)，保留背景层次感
- **自适布局** — 播放器在小屏设备自动纵向堆叠，大屏并排显示
- **交互细节** — 控制条自动隐藏/显示、进度条悬停预览、快捷键支持

---

## 🖥 界面预览

> *（截图待补充）*

| 信息流 | 视频播放 | 图文笔记 |
|:---:|:---:|:---:|
| ![feed] | ![player] | ![note] |

---

## 🏗 技术栈

| 层级 | 技术 |
|:---|:---|
| 🖼 **桌面框架** | Electron 33 |
| ⚛️ **UI 框架** | React 18 + TypeScript 5 |
| 🎨 **样式** | Tailwind CSS 3 |
| 🏗 **构建工具** | electron-vite 2 + Vite 5 |
| 📦 **打包分发** | electron-builder 25（NSIS / DMG / AppImage） |
| 🎥 **视频播放** | dashjs 5（DASH 自适应流） |
| 🗄 **本地存储** | JSON 文件存储 |

---

## 📦 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/)（推荐）或 npm / yarn

### 安装 & 运行

```bash
# 克隆项目
git clone https://github.com/your-username/1app.git
cd 1app

# 安装依赖
pnpm install

# 启动开发模式（含热重载）
pnpm dev
```

### 构建分发版本

```bash
# 构建生产版本
pnpm build

# 打包为可分发安装包
pnpm exec electron-builder

# Windows → dist/*.exe（NSIS 安装包）
# macOS   → dist/*.dmg
# Linux   → dist/*.AppImage
```

---

## 🧪 代码质量

```bash
# 类型检查
pnpm typecheck

# Lint
pnpm lint
```

---

## 📁 项目结构

```
├── src/
│   ├── main/                 # Electron 主进程
│   │   ├── index.ts          # 应用入口
│   │   ├── window.ts         # 窗口管理
│   │   ├── ipc.ts            # IPC 通信（30+ 通道）
│   │   ├── database.ts       # 本地 JSON 存储
│   │   ├── sessions.ts       # 平台隔离会话
│   │   ├── videoProxy.ts     # DASH 视频代理 + 缓存
│   │   ├── rateLimiter.ts    # API 限流
│   │   ├── logger.ts         # 结构化日志
│   │   ├── dataRoot.ts       # 数据目录管理
│   │   ├── settings.ts       # 应用设置读写
│   │   └── platforms/        # 平台适配器
│   │       ├── bilibili.ts   # B站适配器
│   │       ├── xhs.ts        # 小红书适配器
│   │       └── douyin.ts     # 抖音适配器
│   ├── preload/
│   │   └── index.ts          # contextBridge 暴露 electronApi
│   ├── renderer/
│   │   └── src/
│   │       ├── App.tsx        # 根组件
│   │       ├── main.tsx       # React 入口
│   │       ├── pages/
│   │       │   ├── Home.tsx          # 主页（状态管理中心）
│   │       │   └── LoginView.tsx     # 登录页
│   │       ├── components/
│   │       │   ├── PlatformTabs.tsx       # 平台切换标签
│   │       │   ├── FeedGrid.tsx          # 信息流网格
│   │       │   ├── FeedCard.tsx          # 内容卡片
│   │       │   ├── UserCard.tsx          # 用户卡片
│   │       │   ├── FollowGrid.tsx        # 关注列表
│   │       │   ├── Pagination.tsx        # 分页组件
│   │       │   ├── VideoPlayerModal.tsx  # 视频播放器（DASH）
│   │       │   ├── BiliVideoSidePanel.tsx # B站侧边面板
│   │       │   ├── XhsNoteModal.tsx      # 图文笔记查看器
│   │       │   ├── CoinModal.tsx         # 投币弹窗
│   │       │   ├── FavoriteModal.tsx     # 收藏管理
│   │       │   ├── SettingsModal.tsx     # 设置弹窗
│   │       │   └── ErrorBoundary.tsx     # 错误边界
│   │       ├── styles/
│   │       │   └── globals.css           # 全局样式
│   │       └── utils/
│   │           └── rateLimit.ts          # 限流检测
│   └── shared/
│       ├── types.ts          # 共享类型定义
│       └── constants.ts      # 平台配置常量
├── package.json
├── electron.vite.config.ts
├── tailwind.config.js
└── tsconfig*.json
```

---

## ⚠️ 已知限制

- **小红书** 内容抓取依赖无头浏览器拦截网络请求，受平台反爬策略影响可能不稳定
- 目前**没有**单元测试 / E2E 测试覆盖
- 所有数据仅存储在本地，**无云同步**功能

---

## 🗺 路线图

- [ ] 抖音视频播放支持
- [ ] 多语言国际化（i18n）
- [ ] 搜索功能
- [ ] 稍后再看 / 收藏跨平台管理
- [ ] 自动化测试

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！在参与贡献前，请确保：

1. 代码通过类型检查（`pnpm typecheck`）
2. 遵循现有代码风格
3. 如有新功能，请先开 Issue 讨论

---

## 📄 License

[Apache 2.0](LICENSE) © lemonmindyes

---

<p align="center">Made with ❤️ for a unified content experience</p>
