/**
 * LiveTalking 适配器
 *
 * 通过 /offer 建立 WebRTC 视频连接，通过 /human 发送文本驱动数字人播报。
 * 文本由我们自己的 GPT-SoVITS 流水线生成，LiveTalking 仅负责口型渲染。
 */
import { tracer } from '@/tracing/tracer';

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
        // 首个远端轨道就绪 ≈ 首帧准备开始渲染。
        // 由 tracer 内部"只记首次"保证每轮只打一次。
        // if (event.track.kind === 'video') tracer.mark('t5_play_start');
      }

      // 首次拿到音频轨时,挂 AnalyserNode 用于 t5 能量检测
      if (event.track.kind === 'audio' && !this._analyser) {
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = this._audioCtx.createMediaStreamSource(
          new MediaStream([event.track])
        );
        this._analyser = this._audioCtx.createAnalyser();
        this._analyser.fftSize = 512;
        src.connect(this._analyser);
        this._audioBuf = new Uint8Array(this._analyser.fftSize);
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
      const traceId = tracer.current?.id || '';
      const resp = await fetch(`${this.baseUrl}/human`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          type: 'echo',
          sessionid: this.sessionId,
          trace_id: traceId,
        }),
      });

      if (!resp.ok) {
        throw new Error(`[LiveTalking] /human 请求失败: ${resp.status}`);
      }

      // t4_tts_first_return 由服务端在 TTS 首个语音片段生成时埋点,客户端不记

      // 每轮独立监听:等入站音频从静默转为有能量,即为本轮 t5
      this._watchFirstAudio();

      console.log('[LiveTalking] 已发送文本:', text.slice(0, 50));
    } catch (err) {
      console.error('[LiveTalking] speak 出错:', err);
    } finally {
      this._speaking = false;
    }
  }

  // 一次会话内多次调用:每轮独立监听"音频从静默转为有能量"
  // 依赖 tracer 每轮 begin() 会重置 marks,故此处直接 mark 即可,不用手动 arm
  _watchFirstAudio() {
    if (!this._analyser) return;
    const armedAt = performance.now();
    const step = () => {
      if (!this._analyser) return;
      this._analyser.getByteTimeDomainData(this._audioBuf);
      let sum = 0;
      for (let i = 0; i < this._audioBuf.length; i++) {
        const d = this._audioBuf[i] - 128;
        sum += d * d;
      }
      const rms = Math.sqrt(sum / this._audioBuf.length);
      if (rms > 2) {
        tracer.mark('t5_play_start');
        return;
      }
      if (performance.now() - armedAt > 5000) return;  // 兜底,不无限循环
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
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
    if (this._audioCtx) {
      this._audioCtx.close();
      this._audioCtx = null;
      this._analyser = null;
      this._audioBuf = null;
    }
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
