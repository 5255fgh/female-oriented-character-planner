export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function domIdForPath(fieldPath) {
  return `field-${fieldPath.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

export function linesToArray(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function arrayToLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

export function formatDateTime(value) {
  if (!value) {
    return "时间未知";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toReadableError(error) {
  if (error instanceof Error && error.message.trim()) {
    if (error.message.includes("Failed to fetch")) {
      return "无法连接模型服务，请确认本地开发服务器与代理配置可用。";
    }
    return error.message;
  }
  return String(error || "操作失败，请稍后重试。" );
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 剪贴板权限被拒绝时继续使用兼容回退。
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.className = "clipboard-fallback";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("复制失败，请手动选择文本复制。" );
  }
}

export function scrollToFieldPath(fieldPath) {
  const anchors = Array.from(document.querySelectorAll("[data-field-anchor]"));
  let candidate = fieldPath;
  let anchor = null;

  while (candidate) {
    anchor = anchors.find((element) => element.dataset.fieldAnchor === candidate);
    if (anchor) {
      break;
    }
    const separator = candidate.lastIndexOf(".");
    candidate = separator === -1 ? "" : candidate.slice(0, separator);
  }

  if (!anchor) {
    return false;
  }

  anchor.scrollIntoView({ behavior: "auto", block: "center" });
  const focusTarget = anchor.matches("input, textarea, button, select")
    ? anchor
    : anchor.querySelector("input, textarea, button, select");
  focusTarget?.focus({ preventScroll: true });
  return true;
}
