/**
 * 引擎二：微软 Edge TTS 适配器
 * 特点：云端合成，速度极快，纯净的 HTTP 请求，无需复杂的流式截断
 */
export class EdgeTTSAdapter {
  constructor(config) {
    this.apiUrl = config.apiUrl || '/api/edge-tts'; // 你本地包装的 Edge API 地址
    this.voice = config.voice || 'zh-CN-XiaoxiaoNeural'; // 默认使用晓晓音色
  }

  /**
   * 因为 Edge 极快，且大模型做了“标点断句”，这里传入的 text 通常是一个短句
   */
  async streamTTS(text, onAudioReady) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: text, 
          voice: this.voice 
        })
      });

      if (!response.ok) throw new Error('Edge TTS 请求失败');

      // Edge API 通常直接返回音频文件流 (audio/mpeg 等)
      // 我们直接将其转换为 Blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 抛给页面的音频队列去播放
      onAudioReady(audioUrl);

    } catch (error) {
      console.error("Edge TTS 合成报错:", error);
    }
  }
}