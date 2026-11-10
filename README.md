# learningharness

本地学习台。第一版做三件事：保存资料、按资料回答问题、用 SM-2 复习卡片。提问走本机的 `@ppeng/agent-loop`。

## 参考了什么

只记录这次查到的事实，不给推荐等级。

- `amosblomqvist/learnharness`：本地项目、资料、导师对话、知识图、闪卡、测验、学习计划和间隔重复。这份代码在 `/home/shinemo/learnharness`，本项目不复制它。
- `khoj-ai/khoj`：GitHub 34822 stars。个人 AI，能检索自己的文档，可自托管。这里取“答案要能回到本地资料”。
- `lfnovo/open-notebook`：GitHub 25355 stars。开源的 NotebookLM 替代，资料、对话、笔记、播客。这里取“回答要受资料约束，并标出来源”。
- Anki 的 SM-2：评分 0 到 5，记住间隔、简易度和到期时间。这次没有去拉 Anki 的 star 数。

知识图、测验、学习计划和播客这一版没有做。

## 用法

```bash
npm install
export LEARNINGHARNESS_API_KEY=...
node src/cli.js add-source --title "SM-2" --text "SM-2 uses ease, interval and repetitions."
node src/cli.js retrieve ease
node src/cli.js add-card --source SOURCE_ID --front "What does SM-2 store?" --back "ease, interval, repetitions"
node src/cli.js due
node src/cli.js grade CARD_ID 4
node src/cli.js ask "What does SM-2 store?"
```

`ask` 需要 `LEARNINGHARNESS_API_KEY`。默认模型地址是 `http://100.77.149.48:3425`，路径由程序自己加 `/v1/chat/completions`，不要把 `/v1` 写进 base URL。模型默认 `grok/grok-4.7`。密钥不要写进仓库。

资料库在 `data/library.json`，或 `LEARNINGHARNESS_HOME` 指向的目录。
