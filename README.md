# 心光 (Xinguang) v2.1

个人时间管理与记录应用，基于 React + TypeScript + Vite 构建，支持坚果云 WebDAV 同步与端到端加密。

## 功能特性

- 快速记录：支持自定义分类，无数量限制
- 编辑记录：编辑时自动另起一行，带时间戳标记
- 四象限管理：按紧急/重要程度分类任务
- 热力图视图：可视化任务密度
- 坚果云同步：跨设备数据同步
- PWA 支持：可安装为离线应用
- 每日固定任务：自动生成念佛早课/晚课等固定任务
- 无日期条目：支持无日期条目的创建、删除和编辑
- AI 智能分析：自动汇总周期数据，生成分析报告和计划建议
- AI 对话助手：支持多会话管理、流式响应、安全过滤
- 敏感信息保护：自动脱敏密码、手机号等敏感数据

## 技术栈

- 前端：React 18 + TypeScript + Vite 6 + Tailwind CSS
- 状态管理：Zustand
- 后端：Node.js + Express
- 云存储：坚果云 WebDAV API
- 加密：@noble/ciphers + @noble/hashes（WebCrypto 降级兼容）
- PWA：vite-plugin-pwa

## 项目结构

```
time-summary-app/
├── api/              后端服务 (server.js)
├── src/
│   ├── components/   React 组件
│   ├── hooks/        自定义 Hooks
│   ├── lib/          工具库
│   ├── pages/        页面
│   └── types/        类型定义
├── public/           静态资源
└── dist/             构建产物
```

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装与运行

```bash
# 1. 克隆项目
git clone https://github.com/etdjok/time-summary-app-805.git
cd time-summary-app-805

# 2. 安装依赖
npm install

# 3. 开发模式（同时启动前端和后端）
npm run dev

# 4. 生产构建
npm run build

# 5. 启动生产服务
npm start
```

### 在另一台电脑上运行

1. **确保已安装 Node.js**（推荐版本 18 或更高）
   - 访问 https://nodejs.org 下载 LTS 版本
   - 安装完成后验证：`node --version`

2. **克隆或下载项目**
   ```bash
   git clone https://github.com/etdjok/time-summary-app-805.git
   # 或者直接下载 ZIP 文件解压
   ```

3. **安装依赖**
   ```bash
   cd time-summary-app-805
   npm install
   ```

4. **启动应用**
   - 开发模式：`npm run dev`
   - 生产模式：`npm run build && npm start`

5. **访问应用**
   - 浏览器打开：http://localhost:5173（开发模式）或 http://localhost:3001（生产模式）
   - 默认密码：`xinguang2026`

6. **配置坚果云**
   - 注册坚果云账号
   - 获取应用密码（账户设置 → 安全选项 → 第三方应用管理）
   - 在应用设置页面填入用户名、密码、同步目录

### 常见问题

**Q: 启动后密码错误？**
A: 后端服务（3001端口）需要同时运行。开发模式下 `npm run dev` 会自动启动。

**Q: 如何修改默认密码？**
A: 登录后进入设置 → 修改密码。或编辑 `api/password.json` 文件。

**Q: 数据存储在哪里？**
A: 数据存储在坚果云的 files.md 文件中，本地只缓存分类配置。

**Q: 如何同步多台设备？**
A: 在每台设备上配置相同的坚果云账号和同步路径即可。

## 部署说明

### Windows 环境

```bash
# 构建生产版本
npm run build

# 启动服务
node api/server.js

# 设置开机自启（可选）
# 使用 PM2: npm install -g pm2 && pm2 start api/server.js
```

### Linux/macOS 环境

```bash
# 构建生产版本
npm run build

# 启动服务
node api/server.js

# 后台运行
nohup node api/server.js > app.log 2>&1 &
```

### 使用 PM2 部署（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start api/server.js --name "heartlight"

# 设置开机自启
pm2 startup
pm2 save

# 常用命令
pm2 list          # 查看状态
pm2 logs          # 查看日志
pm2 restart       # 重启
pm2 stop          # 停止
```

## AI 对话配置

1. 在应用中点击「AI 分析」→「配置 AI」
2. 选择 AI 服务商（支持自定义）
3. 填入 API Key、API Endpoint、模型名称
4. 配置信息将加密存储在浏览器本地

### 支持的 AI 服务商

- 自定义：任何兼容 OpenAI API 的服务
- 配置保存在本地，不会上传到服务器

## 坚果云配置

1. 注册坚果云账号 (https://www.jianguoyun.com)
2. 获取应用密码（账户设置 → 安全选项 → 第三方应用管理）
3. 在应用设置页面填入：
   - 用户名（坚果云账号）
   - 应用密码（不是登录密码）
   - 同步路径（默认：/笔记）

## 版本历史

- v2.1 (2026-08-16)
  - 完整移植端到端加密系统（主密钥 + AES-256-GCM + PBKDF2）
  - 坚果云凭据加密存储，笔记内容加密上传
  - 登录会话解锁密码、登出自动清除会话密钥
  - 修复 SW 注册竞态，取消注册即刷新

- v1.20.1 (2026-08-15)
  - 恢复码只弹一次：首次开启加密展示，确认后不再重复
  - 恢复密钥云端备份：换机/清缓存后可用恢复码找回
  - 云端检测防覆盖：防止重新设置加密导致旧数据不可读
  - 忘记密码云端恢复：恢复码 + 新密码从云端恢复主密钥
  - 修改加密密码：主密钥不变，数据不受影响
  - 已启用加密摘要页：加密状态、会话解锁、云端备份一目了然
  - 修复恢复密码后再次保存被拦截的问题

- v1.20.0 (2026-08-13)
  - 主密钥架构：256 位主密钥 + PBKDF2 派生
  - 密码不落盘，会话密钥仅存内存
  - 24 位恢复码机制，忘记密码可重置
  - 坚果云凭据改用主密钥加密存储

- v1.19 (2026-08-13)
  - 坚果云端到端加密（AES-256-GCM + PBKDF2）
  - 一键迁移历史文件、跨设备同步、密文标记头

- v1.18.8 (2026-08-07)
  - 实现 AI 对话流式响应，支持打字机效果
  - 多会话管理，支持创建、切换、删除对话
  - AI 回复安全过滤，防止敏感信息泄露
  - 后端代理 API，加密存储 AI 配置
  - 支持流式/非流式响应切换

- v1.18.5 (2026-08-06)
  - 编辑记录时自动另起一行，带日期时间标记
  - 修复无日期条目无法删除和编辑的问题
  - 修复分类标签显示 custom_ 前缀问题
  - 优化分类标签显示与同步

- v1.18.4
  - 确保 addEntry 始终写入 @cat 标记
  - updateEntry 保留分类信息

- v1.18.2: 修复分类显示为 custom_xxx 的问题
- v1.18.1: 分类配置同步到坚果云
- v1.18: 自定义分类无数量限制
- v1.17: 四象限视图、热力图视图
- v1.16: 每日固定任务功能
- v1.12: AI 智能分析、编辑时间戳

## 作者

GitHub: etdjok (https://github.com/etdjok)

## 许可证

MIT License

