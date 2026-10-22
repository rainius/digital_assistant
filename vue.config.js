// vue.config.js
const { defineConfig } = require("@vue/cli-service");

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      "/api/tts": {
        target: "http://192.168.1.168:9880",
        // target: "http://192.168.101.31:9880",
        changeOrigin: true,
        pathRewrite: { "^/api/tts": "/tts" },
        // 可选：方便你在控制台看到代理日志
        logLevel: "debug",
      },
      // 新增ASR代理
      "/api/asr": {
        target: "http://192.168.1.168:9999",
        // target: "http://192.168.101.31:9999",
        // target: "http://localhost:9999",
        changeOrigin: true,
        pathRewrite: { "^/api/asr": "/api/v1/asr" },
        logLevel: "debug",
      },
      // LiveTalking 真人分身（WebRTC 信令 + 文本驱动）
      "/api/livetalking": {
        target: "http://192.168.1.168:8010",
        // target: "http://192.168.101.31:8010",
        changeOrigin: true,
        pathRewrite: { "^/api/livetalking": "" },
        logLevel: "debug",
      },
    },
  },
});
