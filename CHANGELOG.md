# Changelog

## 0.0.1 (2026-06-11)

### Features

- **多平台聚合**: 支持 Bilibili、小红书、抖音三个平台的内容浏览与聚合
- **推荐流**: 各平台推荐内容列表展示，支持分页与换一批刷新
- **视频播放**: 基于 dash.js 的 B站视频播放器，支持清晰度切换、倍速、全屏、键盘快捷键
- **用户系统**: 各平台独立登录/登出，用户资料展示
- **互动操作**: 点赞、投币、收藏（含收藏夹管理）、分享
- **UP主视频**: 关注列表浏览，UP主视频分页查看
- **关注动态**: 基于偏移量的关注动态分页加载
- **评论系统**: 视频评论查看（最热/最新排序），回复展开与翻页
- **内容缓存**: 视频分片缓存（LRU），CDN 备用回源与 IPv4 降级
- **数据管理**: 数据目录选择/迁移/重置，视频缓存清理
- **日志系统**: 结构化日志记录、自动轮转、诊断包导出、日志清理
- **限流保护**: 各平台 API 请求限流机制
- **小红书笔记**: 笔记详情弹窗展示

### Tests

- **主进程测试**: 覆盖 dataRoot, database, ipc, logger, preload, sessions, videoProxy, window 等模块
- **平台测试**: Bilibili、小红书、抖音各平台 API 适配层测试
- **渲染进程测试**: 覆盖全部 17 个组件/页面，含 VideoPlayerModal(100 条)、Home(73 条)、BiliVideoSidePanel(57 条)
- **覆盖率**: main 套件 Lines 97.49%, renderer 套件 Lines 95.66%, Functions 93.24%

### Infrastructure

- Electron + React + TypeScript + Tailwind CSS 技术栈
- Vitest 测试框架 + @testing-library/react + jsdom
- electron-vite 构建工具
- electron-builder 打包
