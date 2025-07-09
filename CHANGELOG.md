# 更新日志

## [1.0.1] - 2025-01-09

### 🐛 修复

- **修复 DXT 兼容性问题**: 替换 `Bun.sleep()` 为跨平台的 `setTimeout()` 实现
  - 解决了在 Claude Desktop 中使用 DXT 扩展时出现的 "Bun is not defined" 错误
  - 现在 DXT 扩展可以在 Node.js 环境中正常运行
  - 保持了与 Bun 开发环境的兼容性

### 🔧 改进

- 添加了跨平台的 sleep 函数实现
- 更新了作者信息为 Kayu Tse
- 改进了错误诊断工具

### 📚 文档

- 添加了 `TROUBLESHOOTING.md` - 详细的问题排查指南
- 添加了 `DXT_EXECUTION_GUIDE.md` - DXT 执行方式说明
- 添加了诊断工具：`npm run diagnose`

## [1.0.0] - 2025-01-09

### ✨ 新功能

- **DXT 扩展支持**: 完整的 Desktop Extension 打包和分发
  - 一键安装体验，类似浏览器扩展
  - 用户友好的配置界面
  - 自动依赖管理

### 🛠️ 工具

- `npm run build:dxt` - 构建 DXT 扩展
- `npm run test:dxt` - 验证 DXT 文件
- `npm run demo:dxt` - 查看 DXT 执行演示
- `npm run diagnose` - 诊断 MCP 连接问题

### 📦 核心功能

- **Confluence 集成**: 完整的 Confluence REST API 支持
- **多种传输方式**: stdio, SSE, streamable-http
- **9 个工具**:
  - `get_page` - 获取页面内容
  - `search_pages` - 搜索页面
  - `get_spaces` - 获取空间列表
  - `create_page` - 创建新页面
  - `update_page` - 更新页面
  - `get_comments` - 获取评论
  - `add_comment` - 添加评论
  - `get_attachments` - 获取附件
  - `add_attachment` - 添加附件

### 🔧 技术特性

- TypeScript 支持
- 内容清理和 AI 优化
- 速率限制保护
- 错误处理和重试机制
- 跨平台兼容性

### 📋 兼容性

- **运行时**: Node.js >= 16.0.0
- **平台**: Windows, macOS, Linux
- **客户端**: Claude Desktop >= 0.10.0

---

## 使用说明

### 安装 DXT 扩展

1. 下载 `confluence-mcp.dxt` 文件
2. 双击文件在 Claude Desktop 中安装
3. 配置 Confluence API Token 和 Base URL
4. 开始使用！

### 开发环境

```bash
# 安装依赖
bun install

# 开发模式
bun run dev

# 构建项目
bun run build

# 构建 DXT 扩展
npm run build:dxt
```

### 故障排除

如果遇到问题，请：

1. 运行诊断工具：`npm run diagnose`
2. 查看 `TROUBLESHOOTING.md`
3. 提交 Issue 到 GitHub

---

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License - 详见 [LICENCE](LICENCE) 文件
