# Confluence MCP DXT 扩展构建指南

本文档说明如何构建和使用 Confluence MCP 的 DXT 扩展。

## 前置要求

- **Node.js** (>= 16.0.0)
- **Bun** (用于构建项目)

## 构建步骤

```bash
# 构建项目并创建 DXT 文件
npm run build:dxt
```

这个命令会：

- 构建 TypeScript 项目到 `dist/` 目录
- 创建临时构建目录 `dxt-build/`
- 复制必要的文件（manifest.json, dist/, package.json 等）
- 安装生产依赖
- 创建 ZIP 压缩包并重命名为 `.dxt`
- 清理临时文件

## 文件结构

构建完成后，DXT 文件包含以下结构：

```text
confluence-mcp.dxt (ZIP 文件)
├── manifest.json          # DXT 扩展清单
├── package.json           # Node.js 包信息
├── README.md              # 项目说明
├── LICENCE                # 许可证
├── dist/                  # 编译后的 JavaScript 文件
│   ├── index.js           # 主入口点
│   ├── index-multi.js     # 多传输入口点
│   └── ...                # 其他编译文件
└── node_modules/          # 生产依赖
    └── ...
```

## 安装和使用

### 在 Claude Desktop 中安装

1. 双击 `confluence-mcp.dxt` 文件
2. 在安装向导中配置：
   - **Confluence API Token**: 您的个人访问令牌
   - **Confluence Base URL**: 您的 Confluence 实例 URL
3. 完成安装后即可使用所有 Confluence 工具

## 分发

构建完成的 `confluence-mcp.dxt` 文件可以：

1. 直接分享给用户进行安装
2. 通过 GitHub Releases 分发
3. 上传到内部文件服务器

## 更新扩展

要更新扩展：

1. 更新 `package.json` 和 `manifest.json` 中的版本号
2. 重新构建 DXT 文件：`npm run build:dxt`
3. 用户需要重新安装新版本
