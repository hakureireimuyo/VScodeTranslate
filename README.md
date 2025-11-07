# DocTranslate - 悬浮文档翻译插件

**DocTranslate** 是一款在 VSCode 中提供文档内容翻译的插件。当你在代码文件中悬停时，它会自动翻译文档内容并显示翻译结果，支持翻译原文与译文的切换。

![alt text](assets/README/img.gif)

## 特性

- 在 VSCode 中悬浮显示翻译内容
- 支持切换显示原文与译文
- 支持重新翻译功能
- 使用自定义翻译 API（默认集成阿里百炼 API）
- 支持缓存翻译结果并自动清理过期缓存

## 注意事项

- 翻译完成后，需要将鼠标移开，然后重新悬浮到对应的位置，才会显示翻译结果。
- 翻译接口需要有一定流量消耗，请合理使用。
- 目前仅支持 openai 的请求格式，需要其他厂商接口的大模型请自行实现
- 厂商 base_url 一般是以 `/v1` 结尾，如 `https://api.openai.com/v1`

## 安装

1. 打开 VSCode 编辑器
2. 前往 [Visual Studio Marketplace](https://marketplace.visualstudio.com/) 搜索 `DocTranslate`
3. 点击 **安装**

或者，你也可以通过命令行直接安装插件：

```bash
ext install doctranslate.doctranslate
````

---

## 配置

在安装完插件后，你需要配置翻译接口相关的参数。打开 VSCode 设置，搜索 `hoverTranslator`，你会看到以下配置项：

* **hoverTranslator.baseURL**: 翻译 API 接口地址，默认使用阿里百炼的接口。
* **hoverTranslator.apiKey**: 你的翻译 API 密钥。
* **hoverTranslator.model**: 使用的翻译模型，默认 `qwen3-next-80b-a3b-instruct`。
* **hoverTranslator.promptTemplate**: 翻译提示模板，默认提示格式为 `请将以下文本翻译为中文：\n${content}`。

你可以根据需要修改这些配置项，以适应不同的翻译接口和需求。

---

## 使用方法

### 启用悬浮翻译

1. 在 VSCode 编辑器中，打开一个文件并悬停在其中的文本上。
2. 插件将自动获取文本并展示翻译结果。如果缓存中已有该文本的翻译，插件将直接显示缓存内容。

### 切换显示模式

点击悬浮窗口中的 **显示译文** 或 **显示原文** 按钮，可以在原文和翻译内容之间切换显示。

### 重新翻译

如果翻译结果不准确或者需要更新翻译内容，可以点击悬浮窗口中的 **重新翻译** 按钮。该按钮会重新请求翻译接口获取新的翻译结果。

---

## 开发

### 本地开发和测试

1. 克隆该仓库到本地并安装依赖：

   ```bash
   git clone https://github.com/your-username/doctranslate.git
   cd doctranslate
   pnpm install
   ```

2. 使用以下命令进行编译：

   ```bash
   pnpm run compile
   ```

3. 启动调试：

   打开 VSCode，按 `F5` 运行插件，你可以在新窗口中调试插件。

### 构建和打包

使用 `vsce` 工具将插件打包：

```bash
vsce package
```

然后你可以在 Visual Studio Marketplace 上发布你的插件，或者通过 `.vsix` 文件进行安装。

---

## 常见问题

### 1. **如何配置翻译接口？**

在 VSCode 设置中，你可以配置翻译接口的地址、API 密钥以及其他相关设置。确保你已正确填写这些信息，才能使插件正常工作。

### 2. **为什么翻译结果有时为空？**

如果翻译接口没有返回有效的翻译，可能是接口出错或网络问题。你可以查看插件输出日志，检查是否有错误提示。

---

## 许可证

本插件遵循 MIT 许可证，详细信息请查看 [LICENSE](LICENSE) 文件。

---

## 贡献

如果你有任何建议或问题，欢迎提交 [Issues](https://github.com/your-username/doctranslate/issues)。如果你希望为项目做出贡献，可以提交 [Pull Requests](https://github.com/your-username/doctranslate/pulls)。
