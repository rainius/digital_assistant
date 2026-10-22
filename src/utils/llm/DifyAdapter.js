export class DifyAdapter {
  constructor(config) {
    console.log('Dify配置参数：', config);
    this.apiUrl = config.apiUrl || 'http://127.0.0.1/v1/chat-messages';
    this.apiKey = config.apiKey;
    this.userId = config.userId || 'digital-human-user';
    this.conversationId = null;
  }

  async streamChat(text, onChunk, onComplete) {
    const requestBody = {
      inputs: {},
      query: text,
      response_mode: "streaming",
      user: this.userId
    };

    if (this.conversationId) requestBody.conversation_id = this.conversationId;

    console.log('Dify请求参数：', this.apiUrl);
    console.log('Dify key：', this.apiKey);
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(requestBody)
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedContent = "";
    let streamCompleted = false;  // 防重复调用 onComplete

    let isReading = true;
    while (isReading) {
      const { done, value } = await reader.read();
      if (done) {
        isReading = false;
        if (!streamCompleted) {
          console.log('[DifyAdapter] SSE 流结束,兜底调用 onComplete');
          streamCompleted = true;
          onComplete(accumulatedContent);
        }
        break;
      }

      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.substring(5).trim();
        if (dataStr === '[DONE]' || trimmed.startsWith('data: {"event": "ping"')) continue;

        try {
          const data = JSON.parse(dataStr);
          if (data.event === 'message') {
            console.log('Dify消息块：', data);
            accumulatedContent += data.answer;
            onChunk(data.answer);
          } else if (data.event === 'message_end') {
            this.conversationId = data.conversation_id;
            if (!streamCompleted) {
              streamCompleted = true;
              onComplete(accumulatedContent);
            }
          }
        } catch (e) { /* ignore */ }
      }
    }
  }

  clearContext() {
    this.conversationId = null;
  }
}