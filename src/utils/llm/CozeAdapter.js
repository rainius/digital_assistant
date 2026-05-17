/**
 * LLM (Large Language Model) 适配器
 * 负责：向大模型发送对话、解析 SSE 数据流、触发打字机效果回调
 */
export class CozeAdapter {
  /**
   * @param {Object} config - 包含 apiUrl, apiKey, botId 等配置
   */
  constructor(config) {
    // 如果你要换成本地的 Dify，只需在实例化时把 apiUrl 换成 Dify 的地址即可
    this.apiUrl = config.apiUrl || 'https://api.coze.cn/v3/chat';
    this.apiKey = config.apiKey;
    this.botId = config.botId;
    this.userId = config.userId || '12345';
  }

  /**
   * 流式对话请求 (Stream Chat)
   * @param {string} text - 用户输入的文本
   * @param {Function} onChunk - 收到大模型增量输出时的回调 (用于更新UI打字机)
   * @param {Function} onComplete - 大模型输出结束时的回调 (用于触发语音合成)
   */
  async streamChat(text, onChunk, onComplete) {
    // 组装请求体 (以下为 Coze 格式。若用 Dify 或 OpenAI 标准格式，在此处修改)
    const requestBody = {
      bot_id: this.botId,
      user_id: this.userId,
      stream: true, // 核心：开启流式传输
      additional_messages: [{ role: 'user', content: text, content_type: 'text', type: 'question' }]
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    // 获取可读数据流阅读器
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8'); // 用于将二进制流解码为中文字符串
    let currentEventType = ""; // 记录当前读取到的事件类型
    let accumulatedContent = ""; // 累积的完整回复内容

    // 无限循环读取流数据，直到 done 为 true
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 解析当前的数据块，按换行符分割为多行
      const lines = decoder.decode(value, { stream: true }).split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue; // 过滤空行

        // 1. 捕获事件标识 (例如: event: conversation.message.delta)
        if (trimmed.startsWith('event:')) {
          currentEventType = trimmed.replace('event:', '').trim();
        }
        // 2. 捕获数据体 (例如: data: {"content": "你好"})
        else if (trimmed.startsWith('data:') && currentEventType) {
          const dataStr = trimmed.replace('data:', '').trim();

          // [DONE] 是标准的 SSE 流结束信号
          if (dataStr === '[DONE]') break;

          try {
            const data = JSON.parse(dataStr);

            // 分支 A: 如果是正在输出内容的“增量事件”
            if (currentEventType === 'conversation.message.delta' && data.type === 'answer' && data.content) {
              accumulatedContent += data.content;
              onChunk(data.content); // 抛出增量内容，UI 收到后拼接到聊天框里
            }
            // 分支 B: 如果是对话“完成事件”
            else if (currentEventType === 'conversation.message.completed' && data.type === 'verbose') {
              // 此时大模型已经想完了，把完整句子抛出去，触发下一步的 TTS 合成
              onComplete(accumulatedContent);
            }
          } catch (e) {
            // 忽略非 JSON 格式或截断导致的解析错误
          }
        }
      }
    }
  }
}