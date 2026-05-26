/**
 * LiveTalking 适配器
 *
 * 通过 /offer 建立 WebRTC 视频连接，通过 /human 发送文本驱动数字人播报。
 * 文本由我们自己的 GPT-SoVITS 流水线生成，LiveTalking 仅负责口型渲染。
 */
export class LiveTalkingAdapter {
  needsTTS = false; // LiveTalking 通过 /human 文本接口驱动，不需要外部 TTS 音频
  streamMode = 'paragraph'; // 服务端有自己的句队列，整段一次性发过去更顺滑
  constructor(config) {
    this.baseUrl = config.modelPath;   // LiveTalking 服务地址, 如 http://localhost:8010
    this.iceServers = config.iceServers || [];
    this.videoEl = null;
    this.pc = null;                    // RTCPeerConnection
    this.sessionId = null;             // 由 /offer 返回
    this._speaking = false;
  }

  // ==================== 1. 挂载 ====================

  async mount(container) {
    const video = document.createElement('video');
    // 铺满舞台，超出宽高比的部分自动裁切（多半裁左右两侧）
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.display = 'block';
    video.autoplay = true;
    video.playsInline = true;
    video.muted = false;
    container.appendChild(video);
    this.videoEl = video;

    await this._connectWebRTC();
  }

  async _connectWebRTC() {
    this.pc = new RTCPeerConnection(
      this.iceServers.length > 0 ? { iceServers: this.iceServers } : undefined
    );

    this.pc.addTransceiver('audio', { direction: 'recvonly' });
    this.pc.addTransceiver('video', { direction: 'recvonly' });

    this.pc.ontrack = (event) => {
      if (!this.videoEl) return;
      // 音频和视频共享同一个 MediaStream，srcObject 设一次即可
      if (this.videoEl.srcObject !== event.streams[0]) {
        this.videoEl.srcObject = event.streams[0];
      }
      console.log('[LiveTalking] 远端', event.track.kind, '轨道就绪');
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[LiveTalking] ICE 状态:', this.pc.iceConnectionState);
    };

    // 创建 SDP offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    console.log('[LiveTalking] 客户端 SDP offer:', this.pc.localDescription.sdp);

    // POST /offer → 获取 answer + sessionid
    const resp = await fetch(`${this.baseUrl}/offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sdp: this.pc.localDescription.sdp,
        type: 'offer',
      }),
    });

    if (!resp.ok) {
      throw new Error(`[LiveTalking] /offer 信令失败: ${resp.status}`);
    }

    const answer = await resp.json();
    this.sessionId = answer.sessionid;

    await this.pc.setRemoteDescription(
      new RTCSessionDescription({ sdp: answer.sdp, type: 'answer' })
    );

    console.log('[LiveTalking] WebRTC 已建立, session:', this.sessionId);
  }

  // ==================== 2. 说话 ====================

  /**
   * 把一句文本送到 LiveTalking。服务端有自己的句子队列与 TTS 节奏，
   * 客户端只负责快速投递：不要在句间打断（会切掉上一句尾音），
   * 也不要用 setTimeout 估时长（估不准就会留白或提前断）。
   *
   * @param {string} _audioUrl - 未使用（LiveTalking 自己合成音频）
   * @param {string} text      - 原始句子文本
   */
  async speak(_audioUrl, text) {
    if (!text) return;

    this._speaking = true;

    try {
      const resp = await fetch(`${this.baseUrl}/human`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          type: 'echo',
          sessionid: this.sessionId,
        }),
      });

      if (!resp.ok) {
        throw new Error(`[LiveTalking] /human 请求失败: ${resp.status}`);
      }

      console.log('[LiveTalking] 已发送文本:', text.slice(0, 50));
    } catch (err) {
      console.error('[LiveTalking] speak 出错:', err);
    } finally {
      this._speaking = false;
    }
  }

  // ==================== 3. 表情 ====================

  setEmotion() {
    // LiveTalking 真人分身暂不支持表情切换，预留接口
  }

  // ==================== 4. 打断 ====================

  stopSpeaking() {
    this._interrupt();
  }

  async _interrupt() {
    if (!this.sessionId) return;
    try {
      await fetch(`${this.baseUrl}/interrupt_talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionid: this.sessionId }),
      });
      console.log('[LiveTalking] 已打断');
    } catch (err) {
      console.warn('[LiveTalking] 打断请求失败:', err);
    }
  }

  // ==================== 5. 销毁 ====================

  destroy() {
    this._speaking = false;
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.videoEl) {
      this.videoEl.remove();
      this.videoEl = null;
    }
    console.log('[LiveTalking] 已销毁');
  }
}
