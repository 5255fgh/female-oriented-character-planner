import { defineConfig, loadEnv } from "vite";

function createProxyOptions(target, apiKey) {
  return {
    target,
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/api\/llm/, ""),
    configure(proxy) {
      proxy.on("proxyReq", (proxyRequest) => {
        proxyRequest.removeHeader("authorization");

        if (apiKey) {
          proxyRequest.setHeader("Authorization", `Bearer ${apiKey}`);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const LLM_BASE_URL = env.LLM_BASE_URL || "https://api.deepseek.com";
  const LLM_API_KEY = env.LLM_API_KEY || "";
  const proxy = {
    "/api/llm": createProxyOptions(LLM_BASE_URL, LLM_API_KEY),
  };

  return {
    server: { proxy },
    preview: { proxy },
  };
});
