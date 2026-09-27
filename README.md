# 本地 AI 选型雷达

面向中文用户的 Apple Silicon 本地大模型选型站。用户选择 Mac 型号、用途和侧重点后，可查看适配模型、估算速度、内存压力、Ollama 启动命令和来源链接。

## 本地运行

```bash
npm run verify
npm run serve
```

然后访问 `http://localhost:4173`。

## 构建输出

`npm run build` 会生成 `dist/`，包括：

- 可交互首页；
- Apple Silicon 硬件页和四类用途详情页；
- 所有模型家族详情页；
- 数据方法、授权说明、`sitemap.xml`、`robots.txt` 和 `llms.txt`；
- 供首页离线交互使用的预计算推荐数据。

构建是确定性的：相同源数据和配置会生成相同文件。正式部署前可指定站点地址：

```bash
SITE_ORIGIN=https://你的域名.example npm run build
```

## 数据边界

- 页面中的“估算”来自 ModelFit 推荐引擎，受模型大小、量化、芯片带宽、统一内存和设备散热模型影响。
- `data/measured-benchmarks.json` 只接收真实运行结果。没有实测记录时，页面会明确显示“暂无实测”，不会用估算数据冒充测试结果。
- 新增实测时至少记录设备、芯片、内存、模型、运行时、上下文长度、输出速度和采集时间。

## 记录本机实测

本机已运行 Ollama 时，可执行：

```bash
npm run benchmark -- hermes3:latest
npm run verify
```

脚本先预热模型，再用固定中文提示连续运行三次，将中位解码速度写入 `data/measured-benchmarks.json`。可用 `BENCH_CONTEXT` 和 `BENCH_RUNS` 调整上下文长度与次数；站点只把这里的记录标为“本机实测”。

## 更新数据

执行 `npm run sync` 会同时读取 ModelFit GitHub 数据快照和官方 Dataset API。脚本检查许可、字段、模型数量、本地/云端条目与家族数量，全部一致才替换本地数据；构建失败会自动恢复旧快照。GitHub Pages 工作流每天北京时间 03:17 检查一次，并且只有验证通过才部署新版本。

## 上线

仓库按 GitHub 用户主页站点设计，发布仓库名应为 `<GitHub用户名>.github.io`。推送到 `main` 后，Pages 工作流自动构建并上线；推荐排序不会读取或根据推广佣金变化。

## 授权与署名

推荐引擎代码采用 MIT License；模型数据集采用 CC BY 4.0。详见 [NOTICE.md](./NOTICE.md) 和 [vendor/modelfit/LICENSE](./vendor/modelfit/LICENSE)。
