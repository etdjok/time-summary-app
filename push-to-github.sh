#!/bin/bash
# 心光项目 - 推送到 GitHub 脚本
# 在 Git Bash 中运行: bash push-to-github.sh

set -e

echo "========================================="
echo "  心光项目 - 推送到 GitHub"
echo "========================================="
echo ""

# 进入项目目录
cd "$(dirname "$0")"

# 检查是否有 main 分支，没有则创建
if git show-ref --verify --quiet refs/heads/main; then
  echo "切换到 main 分支..."
  git checkout main
else
  echo "创建 main 分支..."
  git checkout -b main
fi

echo ""
echo "添加文件到暂存区..."
git add -A

echo ""
echo "提交更改..."
git commit -m "心光 v1.0: 快速记录、分类管理、时间汇总、坚果云同步"

echo ""
echo "推送到 GitHub..."
git push -u origin main

echo ""
echo "========================================="
echo "  推送成功！"
echo "  仓库地址: https://github.com/etdjok/time-summary-app"
echo "========================================="
echo ""
echo "在其他电脑获取代码:"
echo "  git clone https://github.com/etdjok/time-summary-app.git"
echo ""
