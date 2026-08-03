# 心光 (Xinguang) v1.18.2

个人时间管理与记录应用，基于 React + TypeScript + Vite 构建，支持坚果云 WebDAV 同步。

## 功能特性

- 快速记录：支持自定义分类，无数量限制
- 四象限管理：按紧急/重要程度分类任务
- 热力图视图：可视化任务密度
- 坚果云同步：跨设备数据同步
- PWA 支持：可安装为离线应用
- 每日固定任务：自动生成念佛早课/晚课等固定任务

## 技术栈

- 前端：React 18 + TypeScript + Vite 6 + Tailwind CSS
- 状态管理：Zustand
- 后端：Node.js + Express
- 云存储：坚果云 WebDAV API
- PWA：vite-plugin-pwa

## 项目结构

time-summary-app/
- api/              后端服务 (server.js, worker.js)
- src/components/   React 组件
- src/hooks/        自定义 Hooks
- src/lib/          工具库
- src/pages/        页面
- src/types/        类型定义
- public/           静态资源
- dist/             构建产物

## 部署说明

1. 安装依赖：npm install
2. 开发模式：npm run dev
3. 构建生产版本：npm run build
4. 启动服务：node api/server.js

## 坚果云配置

1. 注册坚果云账号
2. 获取应用密码（账户设置 -> 安全选项 -> 第三方应用管理）
3. 在应用设置页面填入用户名、密码、同步目录

## 版本历史

- v1.18.2: 修复分类显示为 custom_xxx 的问题
- v1.18.1: 分类配置同步到坚果云
- v1.18: 自定义分类无数量限制
- v1.17: 四象限视图、热力图视图
- v1.16: 每日固定任务功能
- v1.12: AI 智能分析、编辑时间戳

## 作者

GitHub: etdjok (https://github.com/etdjok)
