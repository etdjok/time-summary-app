# 心光 - 多电脑同步指南

## 一、项目结构

```
心光/
├── src/            # 前端代码（React + TypeScript）
├── api/            # 后端代码（Express 代理）
├── public/         # 静态资源（图标、manifest）
├── dist/           # 构建产物（不提交到 Git）
├── .trae/documents/ # 项目文档（PRD、技术架构）
└── package.json    # 依赖配置
```

## 二、在另一台电脑上获取项目

### 前提条件
1. 安装 Node.js 18+（https://nodejs.org）
2. 安装 Git（https://git-scm.com）
3. 安装 TRAE（用于开发）

### 步骤

```bash
# 1. 克隆项目
git clone https://github.com/etdjok/time-summary-app.git

# 2. 进入项目目录
cd time-summary-app

# 3. 安装依赖
npm install

# 4. 构建前端
npm run build

# 5. 启动服务器
node api/server.js
```

打开浏览器访问 `http://localhost:3001` 即可使用。

## 三、日常开发同步流程

### 电脑 A（开发后推送）
```bash
# 1. 构建最新代码
npm run build

# 2. 提交并推送
git add -A
git commit -m "描述你的修改"
git push
```

### 电脑 B/C（拉取最新代码）
```bash
# 1. 拉取最新代码
git pull

# 2. 安装依赖（如果有新依赖）
npm install

# 3. 重新构建
npm run build

# 4. 重启服务器
node api/server.js
```

## 四、数据同步

笔记数据通过坚果云自动同步，不需要手动操作：
- `Chat.md` - 收集箱记录
- `Later.md` - 待办事项
- `journal/YYYY.MM.md` - 日记

在任意设备上写入的内容，坚果云客户端会自动同步到所有安装了坚果云的电脑。

## 五、服务器部署（小米6）

将后端部署到小米6手机上，实现 24 小时不间断运行：

### 小米6 上操作
1. 安装 Termux（F-Droid 版本）
2. 在 Termux 中执行：
   ```bash
   pkg install nodejs git
   git clone https://github.com/etdjok/time-summary-app.git
   cd time-summary-app
   npm install
   npm run build
   node api/server.js
   ```

### 其他设备访问
- 同一 WiFi：`http://小米6的IP:3001`
- 外网访问：通过内网穿透工具（如 ngrok、frp）

## 六、常见问题

### Q: git push 失败（SSL 错误）？
A: 国内网络问题，多试几次，或使用代理。

### Q: npm install 很慢？
A: 使用国内镜像：`npm config set registry https://registry.npmmirror.com`

### Q: 其他电脑看不到 TRAE 对话记录？
A: TRAE 对话保存在本地，不跨设备同步。关键信息请写入项目文档（.trae/documents/）。
