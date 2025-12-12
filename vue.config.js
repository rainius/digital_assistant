// vue.config.js
const { defineConfig } = require("@vue/cli-service");

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      "/api/tts": {
        target: "http://127.0.0.1:9880",
        changeOrigin: true,
        pathRewrite: { "^/api/tts": "/tts" },
        // 可选：方便你在控制台看到代理日志
        logLevel: "debug",
      },
    },
  },
});
