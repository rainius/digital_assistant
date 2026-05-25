// vue.config.js
const { defineConfig } = require("@vue/cli-service");

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      "/api/tts": {
        target: "http://192.168.1.168:9880",
        changeOrigin: true,
        pathRewrite: { "^/api/tts": "/tts" },
        // 可选：方便你在控制台看到代理日志
        logLevel: "debug",
      },
      // 新增ASR代理
      "/api/asr": {
        // target: "http://192.168.1.168:9999",
        target: "http://localhost:9999",
        changeOrigin: true,
        pathRewrite: { "^/api/asr": "/api/v1/asr" },
        logLevel: "debug",
      }
    },
  },
});
