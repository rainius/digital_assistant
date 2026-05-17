export class DifyAdapter {
  constructor(config) {
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

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(requestBody)
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedContent = "";

    let isReading = true;
    while (isReading) {
      const { done, value } = await reader.read();
      if (done) { isReading = false; break; }

      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.substring(5).trim();
        if (dataStr === '[DONE]' || trimmed.startsWith('data: {"event": "ping"')) continue;

        try {
          const data = JSON.parse(dataStr);
          if (data.event === 'message') {
            accumulatedContent += data.answer;
            onChunk(data.answer);
          } else if (data.event === 'message_end') {
            this.conversationId = data.conversation_id;
            onComplete(accumulatedContent);
          }
        } catch (e) { /* ignore */ }
      }
    }
  }

  clearContext() {
    this.conversationId = null;
  }
}