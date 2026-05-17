// utils/tts/SherpaTTSAdapter.js
export class SherpaTTSAdapter {
  constructor(config) {
    this.apiUrl = config.apiUrl || 'http://localhost:5001/api/local-tts';
  }

  async streamTTS(text, onAudioReady) {
    // 逻辑和 EdgeTTSAdapter 一模一样！
    // 因为后端直接返回了 WAV 的 Blob 块
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });
    
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    onAudioReady(audioUrl);
  }
}