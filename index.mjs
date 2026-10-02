import fs from 'node:fs';
import path from 'node:path';
import path$1 from 'path';
import { pathToFileURL } from 'url';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL as pathToFileURL$1, fileURLToPath } from 'node:url';

function 清理文本(v) {
  return String(v ?? "").trim();
}
function 展开换行(s) {
  const urls = [];
  const masked = s.replace(/https?:\/\/[^\s)\]>]+/gi, (url) => {
    const i = urls.length;
    urls.push(url);
    return `\0URL${i}\0`;
  });
  const expanded = masked.replace(/\/n/g, "\n");
  return expanded.replace(/\u0000URL(\d+)\u0000/g, (_, i) => urls[Number(i)] ?? "");
}
function 是图片段(type) {
  return type === "image" || type === "image_本地" || type === "image_local" || type === "image_base64" || type === "image_url";
}
function 取段原始数据(seg) {
  const raw = seg.data;
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") {
    const d = raw;
    return String(d.file ?? d.url ?? d.data ?? d.text ?? "").trim();
  }
  return "";
}
function 提取纯文本(content) {
  return content.replace(/<@!?[A-Za-z0-9_]+>/g, "").replace(/\s+/g, " ").trim();
}

// ===== 回复装饰：蓝色艾特 + 响应耗时 =====  ★
let 本次响应开始时间 = 0; // 由 plugin_onmessage 写入  ★

function 构建艾特前缀(目标) {  // ★
  const openid = 清理文本(目标?.mention_openid);
  return openid ? `<@${openid}>` : "";
}

function 构建耗时行() {  // ★
  if (!本次响应开始时间) return "";
  const ms = Math.max(0, Date.now() - 本次响应开始时间);
  return `> 响应用时: ${ms}ms`;
}

function 拼接Markdown(内容, 艾特, 耗时行) {  // ★
  let md = String(内容 ?? "");
  if (艾特)   md = md ? `${艾特}\n\n${md}` : 艾特;
  if (耗时行) md = md ? `${md}\n\n${耗时行}` : 耗时行;
  return md;
}

function 拼接文本结尾(内容, 耗时行) {  // ★
  const t = String(内容 ?? "");
  if (!耗时行) return t;
  return t ? `${t}\n${耗时行}` : 耗时行;
}

function 段_文本(text) {
  return { type: "text", data: String(text ?? "") };
}
function 段_md(content, keyboard) {
  return { type: "md", data: String(content ?? ""), keyboard };
}
function md图片行(url, opts) {
  const alt = opts?.alt ?? "img";
  const w = opts?.宽 ?? 640;
  const h = opts?.高 ?? 360;
  return `![${alt}#${w}px #${h}px](${url})`;
}
function md指令输入(填入内容, 显示文字, 带引用 = false) {
  const text = encodeURIComponent(String(填入内容 ?? ""));
  const showRaw = String(显示文字 ?? 填入内容 ?? "");
  const show = encodeURIComponent(showRaw);
  const reference = 带引用 ? "true" : "false";
  return `<qqbot-cmd-input text="${text}" show="${show}" reference="${reference}"/>`;
}
function 段_图片本地(相对或绝对路径) {
  return { type: "image_本地", data: String(相对或绝对路径 ?? "").trim() };
}
function 段_图片url(url) {
  return { type: "image_url", data: String(url ?? "").trim() };
}
function 段_图片base64(base64) {
  return { type: "image_base64", data: String(base64 ?? "").trim() };
}
function 解析插件相对路径(ctx, 相对路径) {
  const base = String(ctx.pluginPath ?? "").trim();
  if (!base) throw new Error("GF_mk: 缺少 pluginPath，无法解析相对路径");
  const rel = String(相对路径 ?? "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (!rel) throw new Error("GF_mk: 相对路径为空");
  return path.resolve(base, rel);
}
function 取发送目标(event) {
  const t = 清理文本(event.t);
  const msg_id = 清理文本(event.id);
  const author = event.author;

  // ★ 新增：提取需要艾特的 openid
  const mention_openid = 清理文本(
    author?.member_openid || author?.user_openid ||
    event.group_member_openid || event.user_openid
  );

  if (t === "GROUP_AT_MESSAGE_CREATE" || t === "GROUP_MESSAGE_CREATE") {
    return {
      scope: "group",
      group_openid: 清理文本(event.group_openid),
      msg_id,
      mention_openid // ★
    };
  }
  if (t === "C2C_MESSAGE_CREATE") {
    const author2 = event.author;
    return {
      scope: "c2c",
      user_openid: 清理文本(author2?.user_openid || author2?.member_openid || author2?.id),
      msg_id,
      mention_openid // ★
    };
  }
  throw new Error(`无法识别发送目标，事件类型: ${t || "未知"}`);
}
function 取互动目标(event) {
  const event_id = 清理文本(event.id);
  if (!event_id) throw new Error("缺少 interaction id");
  const scene = 清理文本(event.scene).toLowerCase();
  const chat_type = Number(event.chat_type);
  const author = event.author;
  const group_openid = 清理文本(event.group_openid ?? event.group_open_id);
  const user_openid = 清理文本(
    event.user_openid ?? event.group_member_openid ?? author?.user_openid ?? author?.member_openid
  );
  if (chat_type === 1 || scene === "group") {
    return { scope: "group", group_openid, event_id, mention_openid: user_openid }; // ★
  }
  if (chat_type === 2 || scene === "c2c") {
    return { scope: "c2c", user_openid, event_id, mention_openid: user_openid }; // ★
  }
  if (group_openid) return { scope: "group", group_openid, event_id, mention_openid: user_openid }; // ★
  if (user_openid) return { scope: "c2c", user_openid, event_id, mention_openid: user_openid }; // ★
  throw new Error(`无法识别互动场景 chat_type=${chat_type} scene=${scene || "?"}`);
}
function 取按钮数据(event) {
  if (清理文本(event.t) !== "INTERACTION_CREATE") return null;
  const payload = event.data;
  const resolved = payload?.resolved ?? payload?.resoloved;
  if (!resolved) return null;
  const id = 清理文本(resolved.button_id);
  const data = String(resolved.button_data ?? "").trim();
  if (!data && !id) return null;
  return { id, data };
}
async function BOTAPI(ctx, apiPath, params = {}) {
  if (!ctx.actions) throw new Error("GF_mk: 插件上下文未就绪");
  try {
    return await ctx.actions.call(apiPath, params, ctx.adapterName);
  } catch (error) {
    ctx.logger?.error?.("BOTAPI 调用失败:", apiPath, error);
    throw error;
  }
}
async function 回应互动(ctx, interactionId, code = 0) {
  const id = 清理文本(interactionId);
  if (!id) throw new Error("interaction id 为空");
  await BOTAPI(ctx, `/interactions/${id}`, { code, __method: "PUT" });
}
function 取发送消息Id(result) {
  if (!result || typeof result !== "object") return "";
  const o = result;
  const data = o.data && typeof o.data === "object" ? o.data : o;
  return 清理文本(data.id ?? data.msg_id ?? data.message_id ?? o.id ?? o.msg_id ?? "");
}
async function 撤回消息(ctx, 目标, messageId) {
  const id = 清理文本(messageId);
  if (!id) throw new Error("message_id 为空");
  if (目标.scope === "group") {
    const gid = 清理文本(目标.group_openid);
    if (!gid) throw new Error("缺少 group_openid");
    return BOTAPI(ctx, `/v2/groups/${gid}/messages/${id}`, { __method: "DELETE" });
  }
  const uid = 清理文本(目标.user_openid);
  if (!uid) throw new Error("缺少 user_openid");
  return BOTAPI(ctx, `/v2/users/${uid}/messages/${id}`, { __method: "DELETE" });
}
async function 发互动回复(ctx, 发送目标, 内容) {
  const { event_id: _drop, ...主动目标 } = 发送目标;
  return 发消息(ctx, 主动目标, 内容);
}
function 规范化消息段(message) {
  const list = Array.isArray(message) ? message : [message];
  const out = [];
  for (const seg of list) {
    if (!seg || typeof seg !== "object") continue;
    const type = 清理文本(seg.type).toLowerCase();
    if (!type) continue;
    if (type === "text") {
      const raw = seg.data;
      if (typeof raw === "string") {
        out.push({ type: "text", data: 展开换行(raw) });
      } else if (raw && typeof raw === "object" && "text" in raw) {
        out.push({ type: "text", data: 展开换行(String(raw.text ?? "")) });
      } else {
        out.push({ type: "text", data: "" });
      }
      continue;
    }
    if (type === "md" || type === "markdown") {
      const raw = seg.data;
      const md = typeof raw === "string" ? 展开换行(raw) : 展开换行(String(raw?.content ?? raw?.text ?? ""));
      if (md) {
        out.push({
          type: "md",
          data: md,
          keyboard: seg.keyboard
        });
      }
      continue;
    }
    if (是图片段(type)) {
      const data = 取段原始数据(seg);
      if (data) out.push({ type, data });
      continue;
    }
    out.push(seg);
  }
  return out;
}
function 解析图片段(ctx, seg) {
  const type = 清理文本(seg.type).toLowerCase();
  const data = 取段原始数据(seg);
  if (!data) throw new Error(`图片段 ${type} 的 data 为空`);
  if (type === "image_本地" || type === "image_local") {
    const abs2 = path.isAbsolute(data) ? data : 解析插件相对路径(ctx, data);
    return { kind: "local", path: abs2 };
  }
  if (type === "image_url") {
    return { kind: "url", url: data };
  }
  if (type === "image_base64") {
    let raw = data.trim();
    const m = raw.match(/^data:image\/[a-z0-9+.-]+;base64,(.+)$/i);
    if (m?.[1]) raw = m[1].trim();
    else if (raw.startsWith("base64://")) raw = raw.slice("base64://".length).trim();
    return { kind: "base64", data: raw };
  }
  if (/^https?:\/\//i.test(data) || /^file:\/\//i.test(data)) {
    return { kind: "url", url: data };
  }
  if (/^data:image\//i.test(data) || data.startsWith("base64://")) {
    return 解析图片段(ctx, { type: "image_base64", data });
  }
  const abs = path.isAbsolute(data) ? data : 解析插件相对路径(ctx, data);
  return { kind: "local", path: abs };
}
function 填充消息会话标识(body, 目标) {
  if (目标.scope === "group") {
    if (!目标.group_openid) throw new Error("缺少 group_openid");
    body.group_openid = 目标.group_openid;
    return;
  }
  if (!目标.user_openid) throw new Error("缺少 user_openid");
  body.openid = 目标.user_openid;
}
function 构建上传体(目标, opts, fileType = 1) {
  const body = {
    file_type: fileType,
    srv_send_msg: false,
    url: opts.url ?? ""
  };
  if (opts.file_data) body.file_data = opts.file_data;
  if (目标.scope === "group") {
    if (!目标.group_openid) throw new Error("缺少 group_openid");
    body.group_openid = 目标.group_openid;
  }
  return body;
}
async function 请求上传(ctx, 目标, body) {
  let res;
  if (目标.scope === "group") {
    res = await BOTAPI(ctx, `/v2/groups/${目标.group_openid}/files`, body);
  } else {
    if (!目标.user_openid) throw new Error("缺少 user_openid");
    res = await BOTAPI(ctx, `/v2/users/${目标.user_openid}/files`, body);
  }
  const info = 清理文本(res?.file_info);
  if (!info) throw new Error("富媒体上传未返回 file_info");
  return info;
}
async function 上传图片资源(ctx, 目标, 资源) {
  if (资源.kind === "url") {
    return 请求上传(ctx, 目标, 构建上传体(目标, { url: 资源.url }, 1));
  }
  if (资源.kind === "base64") {
    return 请求上传(ctx, 目标, 构建上传体(目标, { file_data: 资源.data }, 1));
  }
  const absPath = 资源.path;
  if (!fs.existsSync(absPath)) {
    throw new Error(`本地文件不存在: ${absPath}`);
  }
  const buf = fs.readFileSync(absPath);
  ctx.logger?.debug?.(
    `[GF_mk] 上传本地图 scope=${目标.scope} file=${absPath} bytes=${buf.length}`
  );
  return 请求上传(ctx, 目标, 构建上传体(目标, { file_data: buf.toString("base64") }, 1));
}
async function 上传视频Url(ctx, 目标, url) {
  const videoUrl = String(url ?? "").trim();
  if (!videoUrl) throw new Error("视频 URL 为空");
  ctx.logger?.debug?.(`[GF_mk] 上传视频 scope=${目标.scope} url=${videoUrl}`);
  return 请求上传(ctx, 目标, 构建上传体(目标, { url: videoUrl }, 2));
}
async function 上传音频Url(ctx, 目标, url) {
  const audioUrl = String(url ?? "").trim();
  if (!audioUrl) throw new Error("音频 URL 为空");
  ctx.logger?.debug?.(`[GF_mk] 上传音频 scope=${目标.scope} url=${audioUrl}`);
  return 请求上传(ctx, 目标, 构建上传体(目标, { url: audioUrl }, 3));
}
async function 发视频(ctx, 发送目标, 视频Url, 说明) {
  const fileInfo = await 上传视频Url(ctx, 发送目标, 视频Url);
  const apiPath = 组装发送路径(发送目标);
  const body = {
    msg_type: 7,
    media: { file_info: fileInfo }
  };
  const caption = String(说明 ?? "").trim();
  if (caption) body.content = caption;
  const seq = 取下一MsgSeq(发送目标);
  const result = await BOTAPI(ctx, apiPath, 组装发送载荷(发送目标, body, seq));
  递增MsgSeq(发送目标, seq);
  return result;
}
function 段_视频url(url) {
  return { type: "video_url", data: String(url ?? "").trim() };
}
function 截断Ark文本(text, max) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
function 转义Md$2(text) {
  return String(text ?? "").replace(/\r\n/g, "\n").replace(/\[/g, "\\[").replace(/\]/g, "\\]").trim();
}
function 构建音乐信息Md(歌名, 歌手, 封面, 音源) {
  const title = 转义Md$2(歌名) || "未知歌曲";
  const artist = 转义Md$2(歌手);
  const cover = String(封面 ?? "").trim();
  const lines = [`## ${title}`, ""];
  if (artist) lines.push(`**歌手** ${artist}`, "");
  if (音源) lines.push(`**音源** ${转义Md$2(音源)}`, "");
  if (cover && /^https?:\/\//i.test(cover)) {
    lines.push(md图片行(cover, { alt: title, 宽: 640, 高: 640 }), "");
  }
  lines.push("---", "_请点击下一条音频消息播放_");
  return lines.join("\n");
}
function 构建音乐Ark24(歌名, 歌手, 封面, 链接, 来源 = "GF_mk") {
  return {
    template_id: 24,
    kv: [
      { key: "#DESC#", value: 截断Ark文本(歌名, 40) || "音乐" },
      { key: "#PROMPT#", value: "点击卡片播放" },
      { key: "#TITLE#", value: 截断Ark文本(歌名, 60) || "未知歌曲" },
      { key: "#METADESC#", value: 截断Ark文本(歌手, 80) || "未知歌手" },
      { key: "#IMG#", value: String(封面 ?? "").trim() },
      { key: "#LINK#", value: String(链接 ?? "").trim() },
      { key: "#SUBTITLE#", value: 截断Ark文本(来源, 20) }
    ]
  };
}
async function 发Ark(ctx, 发送目标, ark) {
  const apiPath = 组装发送路径(发送目标);
  const seq = 取下一MsgSeq(发送目标);
  const result = await BOTAPI(ctx, apiPath, 组装发送载荷(发送目标, {
    msg_type: 3,
    ark
  }, seq));
  递增MsgSeq(发送目标, seq);
  return result;
}
async function 发音乐Ark(ctx, 发送目标, 歌名, 歌手, 封面, 链接, 来源) {
  return 发Ark(ctx, 发送目标, 构建音乐Ark24(歌名, 歌手, 封面, 链接, 来源));
}
const MUSIC_ARK_API = "https://api.s01s.cn/API/music_ark/";
const 音源Pingtai = {
  QQ: "qq",
  汽水: "yk",
  酷我: "kuwo",
  网易云: "163"
};
async function 获取MusicLuaJson(歌名, 歌手, 封面, 链接, 音源 = "汽水") {
  const pingtai = 音源Pingtai[音源] ?? "yk";
  const 参数 = `?title=${encodeURIComponent(歌名)}&singer=${encodeURIComponent(歌手)}&pingtai=${pingtai}&audio=${encodeURIComponent(链接)}&img=${encodeURIComponent(封面)}&wx=${encodeURIComponent("你也想听歌嘛？")}&link=${encodeURIComponent(链接)}`;
  const res = await fetch(MUSIC_ARK_API + 参数);
  if (!res.ok) throw new Error(`music_ark HTTP ${res.status}`);
  return JSON.parse(await res.text());
}
function 从MusicLua取音频(json, 备用) {
  const meta = json.meta;
  const url = String(meta?.music?.musicUrl ?? meta?.music?.jumpUrl ?? 备用).trim();
  return url || 备用;
}
async function 发音乐语音(ctx, 发送目标, 音频Url, 说明) {
  const fileInfo = await 上传音频Url(ctx, 发送目标, 音频Url);
  const apiPath = 组装发送路径(发送目标);
  const body = {
    msg_type: 7,
    media: { file_info: fileInfo }
  };
  const caption = String(说明 ?? "").trim();
  if (caption) body.content = caption;
  const seq = 取下一MsgSeq(发送目标);
  const result = await BOTAPI(ctx, apiPath, 组装发送载荷(发送目标, body, seq));
  递增MsgSeq(发送目标, seq);
  return result;
}
async function 发音乐卡片(ctx, 发送目标, 歌名, 歌手, 封面, 链接, 音源 = "汽水") {
  let audioUrl = String(链接 ?? "").trim();
  try {
    const luaJson = await 获取MusicLuaJson(歌名, 歌手, 封面, 链接, 音源);
    audioUrl = 从MusicLua取音频(luaJson, audioUrl);
  } catch (error) {
    ctx.logger?.warn?.("[GF_mk] music_ark 解析失败，使用原始链接:", error);
  }
  await 发消息(ctx, 发送目标, [段_md(构建音乐信息Md(歌名, 歌手, 封面, 音源), 构建点歌Footer键盘())]);
  return 发音乐语音(ctx, 发送目标, audioUrl, "▶ 点击播放");
}
function 取用户Id(event) {
  const author = event.author;
  return String(
    event.user_openid || event.group_member_openid || author?.user_openid || author?.member_openid || author?.union_openid || author?.id || ""
  ).trim() || "unknown";
}
function 组装发送路径(目标) {
  if (目标.scope === "group") {
    if (!目标.group_openid) throw new Error("缺少 group_openid");
    return `/v2/groups/${目标.group_openid}/messages`;
  }
  if (!目标.user_openid) throw new Error("缺少 user_openid");
  return `/v2/users/${目标.user_openid}/messages`;
}
function 取下一MsgSeq(目标) {
  return 目标.next_msg_seq ?? 1;
}
function 递增MsgSeq(目标, 当前) {
  if (目标.msg_id) 目标.next_msg_seq = 当前 + 1;
}
function 组装发送载荷(目标, fields, msgSeq) {
  const base = { ...fields };
  填充消息会话标识(base, 目标);
  if (目标.event_id) {
    base.event_id = 目标.event_id;
  } else if (目标.msg_id) {
    base.msg_id = 目标.msg_id;
    if (msgSeq != null) base.msg_seq = msgSeq;
  }
  return base;
}
function 补全Md图片语法(content) {
  return content.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi,
    (match, alt, url) => {
      if (/#\d+px/i.test(alt)) return match;
      const text = alt.trim() || "img";
      return `![${text}#640px #360px](${url})`;
    }
  );
}
function 规划发送批次(ctx, segments) {
  const batches = [];
  let pendingText = "";
  const 取段文案 = (seg) => {
    const raw = seg.data;
    return typeof raw === "string" ? 展开换行(raw) : 展开换行(String(raw?.text ?? ""));
  };
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const type = 清理文本(seg.type).toLowerCase();
    if (type === "text") {
      const t = 取段文案(seg);
      if (t) pendingText = pendingText ? `${pendingText}
${t}` : t;
      continue;
    }
    if (type === "md" || type === "markdown") {
      if (pendingText.trim()) {
        batches.push({ kind: "text", content: pendingText.trim() });
        pendingText = "";
      }
      const raw = seg.data;
      const md = typeof raw === "string" ? 展开换行(raw) : 展开换行(String(raw?.content ?? ""));
      if (md) {
        batches.push({
          kind: "markdown",
          content: md,
          keyboard: seg.keyboard
        });
      }
      continue;
    }
    if (是图片段(type)) {
      let caption = pendingText.trim();
      pendingText = "";
      const 资源 = 解析图片段(ctx, seg);
      i += 1;
      while (i < segments.length) {
        const next = segments[i];
        const nextType = 清理文本(next.type).toLowerCase();
        if (nextType === "text") {
          const t = 取段文案(next);
          caption = caption ? `${caption}
${t}` : t;
          i += 1;
          continue;
        }
        if (nextType === "md" || nextType === "markdown" || 是图片段(nextType)) break;
        i += 1;
      }
      i -= 1;
      batches.push({
        kind: "image",
        content: caption || void 0,
        资源
      });
    }
  }
  if (pendingText.trim()) {
    batches.push({ kind: "text", content: pendingText.trim() });
  }
  return batches;
}

// ===== 发消息（注入蓝色艾特 + 响应耗时）=====  ★
async function 发消息(ctx, 发送目标, 内容, options = {}) { // ★ 修复：新增 options 参数
  const segments = 规范化消息段(内容);
  if (!segments.length) return null;
  const batches = 规划发送批次(ctx, segments);
  if (!batches.length) return null;
  const apiPath = 组装发送路径(发送目标);
  let seq = 取下一MsgSeq(发送目标);
  let lastResult = null;
  const outChunks = [];

  // ★ 修复：判断是否为纯净模式（网页控制台发送）
  const 是纯净模式 = options.纯净模式 === true;

  // ★ 提取艾特前缀（纯净模式下不提取）
  const 艾特前缀 = 是纯净模式 ? "" : 构建艾特前缀(发送目标);

  // ★ 改为索引循环，便于判断最后一批
  for (let bi = 0; bi < batches.length; bi += 1) {
    const batch = batches[bi];
    const 是最后一批 = bi === batches.length - 1;
    // ★ 修复：只在最后一批且非纯净模式下追加耗时
    const 耗时行 = (是纯净模式 || !是最后一批) ? "" : 构建耗时行();

    if (batch.kind === "text") {
      // ★ 文本消息：只加耗时（文本模式无法渲染蓝色艾特）
      const content = 拼接文本结尾(batch.content, 耗时行);
      lastResult = await BOTAPI(ctx, apiPath, 组装发送载荷(发送目标, {
        msg_type: 0,
        content
      }, seq));
      if (batch.content) outChunks.push(batch.content);
    } else if (batch.kind === "markdown") {
      // ★ Markdown 消息：加艾特 + 耗时
      const md = 拼接Markdown(batch.content, 艾特前缀, 耗时行);
      const body = {
        msg_type: 2,
        markdown: { content: 补全Md图片语法(md) }
      };
      if (batch.keyboard?.rows?.length) {
        body.keyboard = { content: batch.keyboard };
      }
      lastResult = await BOTAPI(ctx, apiPath, 组装发送载荷(发送目标, body, seq));
      if (batch.content) outChunks.push(batch.content);
    } else {
      // 图片消息：底部文字带耗时
      const fileInfo = await 上传图片资源(ctx, 发送目标, batch.资源);
      const 说明 = 拼接文本结尾(batch.content, 耗时行);
      const body = {
        msg_type: 7,
        media: { file_info: fileInfo }
      };
      if (说明) body.content = 说明;
      lastResult = await BOTAPI(ctx, apiPath, 组装发送载荷(发送目标, body, seq));
      outChunks.push(batch.content ? `${batch.content}
[图片]` : "[图片]");
    }

    if (发送目标.msg_id) {
      递增MsgSeq(发送目标, seq);
      seq = 取下一MsgSeq(发送目标);
    }
  }

  if (outChunks.length) {
    try {
      const { recordOutboundMessage } = await Promise.resolve().then(() => messageLog);
      recordOutboundMessage?.(ctx, 发送目标, outChunks.join("\n"), lastResult);
    } catch {
    }
  }
  return lastResult;
}

function 行(...buttons) {
  return { buttons };
}
function 钮(id, 文字, data, 样式 = 1) {
  return {
    id,
    render_data: { label: 文字, visited_label: 文字, style: 样式 },
    action: {
      type: 1,
      permission: { type: 2 },
      data,
      unsupport_tips: "当前客户端不支持此操作"
    }
  };
}
function 指令钮(id, 文字, data, 样式 = 1) {
  return {
    id,
    render_data: { label: 文字, visited_label: 文字, style: 样式 },
    action: {
      type: 2,
      permission: { type: 2 },
      data,
      unsupport_tips: "当前客户端不支持指令按钮"
    }
  };
}
function 构建点歌Footer键盘() {
  return {
    rows: [
      行(
        钮("btn_music_menu", "音乐系统", "menu_music"),
        钮("btn_main_menu", "返回首页", "main_menu")
      )
    ]
  };
}

const moduleCache = /* @__PURE__ */ new Map();
async function callLocalVideoApi(pluginDir, apiName, input) {
  let mod = moduleCache.get(apiName);
  if (!mod) {
    const modPath = path$1.join(pluginDir, "lib", "api", `${apiName}.mjs`);
    mod = await import(pathToFileURL(modPath).href);
    moduleCache.set(apiName, mod);
  }
  return mod.parse(input);
}

function 转义Md$1(text) {
  return String(text ?? "").replace(/\r\n/g, "\n").replace(/\n/g, " ").replace(/\[/g, "\\[").replace(/\]/g, "\\]").trim();
}
function 截断(text, max = 120) {
  const s = 转义Md$1(text);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
function 格式化数字(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n ?? "-");
  if (v >= 1e8) return `${(v / 1e8).toFixed(1).replace(/\.0$/, "")}亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1).replace(/\.0$/, "")}万`;
  return String(v);
}
function 构建B站Md(d) {
  const up = d["UP主信息"];
  const 标题 = 转义Md$1(d["视频标题"]);
  const 作者 = 转义Md$1(up?.["UP主名称"]);
  const 描述 = 截断(d["视频描述"], 160);
  const 封面 = String(d["视频封面"] ?? "").trim();
  const lines = [
    `## ${标题 || "B站视频"}`,
    ""
  ];
  if (封面) {
    lines.push(md图片行(封面, { alt: "封面", 宽: 640, 高: 360 }), "");
  }
  if (作者) lines.push(`**UP主** ${作者}`, "");
  if (描述) lines.push(`> ${描述}`, "");
  lines.push(
    `**时长** ${转义Md$1(d["视频时长"]) || "-"} · **大小** ${转义Md$1(d["视频大小"]) || "-"}`,
    `**发布** ${转义Md$1(d["发布时间"]) || "-"}`,
    "",
    `**播放** ${格式化数字(d["播放次数"])} · **弹幕** ${格式化数字(d["弹幕数量"])} · **评论** ${格式化数字(d["评论数量"])}`,
    `**点赞** ${格式化数字(d["点赞数量"])} · **收藏** ${格式化数字(d["收藏数量"])} · **投币** ${格式化数字(d["投币数量"])} · **分享** ${格式化数字(d["分享数量"])}`,
    "",
    "---",
    "_视频发送中，请稍等…_"
  );
  return lines.join("\n");
}
function 识别B站链接(text) {
  const 扫描 = String(text ?? "").trim();
  if (!扫描) return null;
  const b23 = 扫描.match(/https?:\/\/b23\.tv\/[a-zA-Z0-9]+/i)?.[0];
  const bv = 扫描.match(/https?:\/\/(?:www\.)?bilibili\.com\/video\/BV[a-zA-Z0-9]{10}/i)?.[0];
  return b23 || bv || null;
}
function 插件目录(ctx) {
  const base = String(ctx.pluginPath ?? "").trim();
  if (!base) throw new Error("GF_mk: 缺少 pluginPath");
  return base;
}
async function 处理哔哩哔哩(ctx, 目标, 原文) {
  const raw = await callLocalVideoApi(插件目录(ctx), "blbl", 原文);
  if (raw["状态码"] !== 200 || !raw["数据"]) {
    ctx.logger?.error?.("[GF_mk] B站解析失败:", raw["消息"] ?? raw);
    await 发消息(ctx, 目标, [
      段_md(`## 解析失败

${转义Md$1(raw["消息"] ?? "未知错误")}`)
    ]);
    return true;
  }
  const d = raw["数据"];
  const 视频 = String(d["视频链接"] ?? "").trim();
  await 发消息(ctx, 目标, [段_md(构建B站Md(d))]);
  if (视频) {
    try {
      await 发视频(ctx, 目标, 视频);
    } catch (error) {
      ctx.logger?.error?.("[GF_mk] B站视频发送失败:", error);
      await 发消息(ctx, 目标, [
        段_md(`## 视频发送失败

${转义Md$1(error instanceof Error ? error.message : String(error))}`)
      ]);
    }
  }
  return true;
}
async function tryHandleVideoParse(ctx, 目标, text) {
  const url = 识别B站链接(text);
  if (!url) return false;
  ctx.logger?.info?.(`[GF_mk] B站视频解析: ${url}`);
  try {
    return await 处理哔哩哔哩(ctx, 目标, text);
  } catch (error) {
    ctx.logger?.error?.("[GF_mk] B站视频解析异常:", error);
    await 发消息(ctx, 目标, [
      段_md(`## 解析出错

${转义Md$1(error instanceof Error ? error.message : String(error))}`)
    ]);
    return true;
  }
}

const 音源列表 = ["QQ", "汽水", "酷我", "网易云"];
function resolvePluginDataFile$3(ctx, rel) {
  const pluginDir = String(ctx.pluginPath ?? "").trim();
  return path.resolve(pluginDir, "data", rel);
}
function resolveUserDataFile$3(ctx, rel) {
  const dataDir = String(ctx.dataPath ?? "").trim();
  if (!dataDir) return resolvePluginDataFile$3(ctx, rel);
  return path.resolve(dataDir, rel);
}
function readJsonConfig(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}
function readConfig$2(ctx) {
  const configPath = String(ctx.configPath ?? "").trim() || resolveUserDataFile$3(ctx, "config.json");
  return readJsonConfig(configPath, {});
}
function isDebugReadonly$1(ctx) {
  return readConfig$2(ctx).调试开关 === true;
}
function 转义Md(text) {
  return String(text ?? "").replace(/\r\n/g, "\n").replace(/\[/g, "\\[").replace(/\]/g, "\\]").trim();
}
function 音乐目录(ctx) {
  const base = String(ctx.dataPath ?? "").trim();
  if (!base) throw new Error("GF_mk: 缺少 dataPath");
  const dir = path.join(base, "music");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function 读Json(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function 写Json(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}
function 默认音源文件(ctx, userId) {
  return path.join(音乐目录(ctx), "source", `${userId}.json`);
}
function 临时歌单文件(ctx, userId) {
  return path.join(音乐目录(ctx), "session", `${userId}.json`);
}
function 收藏文件(ctx, userId) {
  return path.join(音乐目录(ctx), "favorites", `${userId}.json`);
}
function 读默认音源(ctx, userId) {
  const v = 读Json(默认音源文件(ctx, userId), {});
  return 音源列表.includes(v.source) ? v.source : "汽水";
}
function 写默认音源(ctx, userId, source) {
  if (isDebugReadonly$1(ctx)) return;
  写Json(默认音源文件(ctx, userId), { source });
}
function 读临时歌单(ctx, userId) {
  return 读Json(临时歌单文件(ctx, userId), null);
}
function 写临时歌单(ctx, userId, data) {
  写Json(临时歌单文件(ctx, userId), data);
}
function 读收藏(ctx, userId) {
  return 读Json(收藏文件(ctx, userId), []);
}
function 写收藏(ctx, userId, list) {
  if (isDebugReadonly$1(ctx)) return;
  写Json(收藏文件(ctx, userId), list);
}
function 列表Api(音源, keyword) {
  const q = encodeURIComponent(keyword);
  const map = {
    QQ: `https://a.aa.cab/qq.music?msg=${q}&num=10`,
    汽水: `https://api-v2.cenguigui.cn/api/qishui/?msg=${q}&type=json&n=`,
    酷我: `https://oiapi.net/api/Kuwo?msg=${q}&limit=20`,
    网易云: `https://oiapi.net/api/Music_163?name=${q}&limit=20`
  };
  return map[音源];
}
function 选歌Api(音源, keyword, index) {
  const q = encodeURIComponent(keyword);
  const n = String(index);
  const map = {
    QQ: `https://a.aa.cab/qq.music?msg=${q}&num=10&n=${n}`,
    汽水: `https://api-v2.cenguigui.cn/api/qishui/?msg=${q}&type=json&n=${n}`,
    酷我: `https://oiapi.net/api/Kuwo?msg=${q}&n=${n}`,
    网易云: `https://oiapi.net/api/Music_163?name=${q}&limit=20&n=${n}`
  };
  return map[音源];
}
async function 请求Json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
function 解析列表项(音源, item) {
  if (音源 === "网易云") {
    const singers = item.singers;
    return {
      歌名: String(item.name ?? ""),
      歌手: String(singers?.[0]?.name ?? "")
    };
  }
  if (音源 === "酷我") {
    return { 歌名: String(item.song ?? ""), 歌手: String(item.singer ?? "") };
  }
  return { 歌名: String(item.song ?? item.title ?? ""), 歌手: String(item.singer ?? "") };
}
function 解析歌曲详情(音源, raw) {
  const data = raw.data ?? {};
  if (音源 === "汽水") {
    return {
      歌名: String(data.title ?? ""),
      歌手: String(data.singer ?? ""),
      封面: String(data.cover ?? ""),
      链接: String(data.music ?? "")
    };
  }
  if (音源 === "酷我") {
    return {
      歌名: String(data.song ?? ""),
      歌手: String(data.singer ?? ""),
      封面: String(data.picture ?? ""),
      链接: String(data.url ?? "")
    };
  }
  if (音源 === "QQ") {
    return {
      歌名: String(data.song ?? ""),
      歌手: String(data.singer ?? ""),
      封面: String(data.cover ?? data.music ?? ""),
      链接: String(data.music ?? "")
    };
  }
  const singers = data.singers;
  return {
    歌名: String(data.name ?? ""),
    歌手: String(singers?.[0]?.name ?? ""),
    封面: String(data.picurl ?? ""),
    链接: String(data.url ?? "")
  };
}
function 构建音乐菜单Md() {
  return [
    "# GF_mk 音乐系统",
    "",
    "## 点歌",
    "- `点歌小团圆`（默认汽水）",
    "- `QQ点歌` / `汽水点歌` / `酷我点歌` / `网易云点歌`",
    "",
    "## 选歌",
    "- `选歌1` → **Markdown 信息卡 + 音频消息**（点击下一条播放）",
    "- `链接选歌1` → 仅输出音频链接",
    "",
    "## 收藏",
    "- `个人歌单` · `收藏歌曲1` · `取消收藏2` · `取消收藏3-5`",
    "- `播放收藏1` → Markdown 信息卡 + 音频 · `链接播放收藏1` → 仅链接",
    "- `清空个人收藏歌曲`",
    "",
    "---",
    "_接口：汽水/酷我/网易/OIAPI · QQ云汐 · 选歌先发 MD 信息卡再发可播放音频_"
  ].join("\n");
}
async function 发送音乐菜单(ctx, 目标, 互动回复 = false) {
  const 内容 = 段_md(构建音乐菜单Md(), 构建点歌Footer键盘());
  if (互动回复) {
    await 发互动回复(ctx, 目标, [内容]);
  } else {
    await 发消息(ctx, 目标, [内容]);
  }
}
function 构建点歌列表Md(音源, items) {
  const lines = [
    `## 【${音源}】搜索结果`,
    "",
    `共 **${items.length}** 首，**点击序号或歌名**自动填入 \`选歌序号\``,
    ""
  ];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const 序号 = i + 1;
    const 指令 = `选歌${序号}`;
    const 可点 = md指令输入(指令, `${序号}. ${转义Md(it.歌名)}`);
    lines.push(`${可点} — _${转义Md(it.歌手)}_`);
  }
  lines.push("", "---", "_点选后确认发送即可播放_");
  return lines.join("\n");
}
function 构建歌单Md(list) {
  const lines = [`## 个人歌单`, "", `共 **${list.length}** 首`, ""];
  for (let i = 0; i < list.length; i += 1) {
    const it = list[i];
    lines.push(`${i + 1}. **[${it.音源}]** ${转义Md(it.歌名)} — _${转义Md(it.歌手)}_`);
  }
  lines.push("", "---", "_`播放收藏1` · `链接播放收藏1`_");
  return lines.join("\n");
}
function 构建链接Md(详情) {
  return [
    `## ${转义Md(详情.歌名)}`,
    "",
    `**歌手** ${转义Md(详情.歌手)}`,
    "",
    "**音频链接**",
    "",
    `\`${详情.链接}\``
  ].join("\n");
}
async function 处理点歌(ctx, 目标, userId, 音源, keyword, 持久音源) {
  const name = String(keyword ?? "").trim();
  if (!name) {
    await 发消息(ctx, 目标, [段_md("## 点歌\n\n请在指令后输入歌名，例如：`点歌小团圆`")]);
    return;
  }
  if (持久音源) 写默认音源(ctx, userId, 音源);
  let raw;
  try {
    raw = await 请求Json(列表Api(音源, name));
  } catch (error) {
    ctx.logger?.error?.("[GF_mk] 点歌接口失败:", error);
    await 发消息(ctx, 目标, [段_md(`## 点歌失败

**${音源}** 接口不可达，请稍后重试`)]);
    return;
  }
  const arr = raw.data;
  if (!Array.isArray(arr) || arr.length === 0) {
    await 发消息(ctx, 目标, [段_md(`## 无结果

**${音源}** 未找到「${转义Md(name)}」`)]);
    return;
  }
  const items = arr.map((x) => 解析列表项(音源, x));
  写临时歌单(ctx, userId, {
    音源,
    searchName: name,
    count: items.length,
    data: items
  });
  await 发消息(ctx, 目标, [段_md(构建点歌列表Md(音源, items), 构建点歌Footer键盘())]);
}
async function 获取选歌详情(ctx, userId, index) {
  const session = 读临时歌单(ctx, userId);
  if (!session || index < 1 || index > session.count) return null;
  const raw = await 请求Json(选歌Api(session.音源, session.searchName, index));
  const 详情 = 解析歌曲详情(session.音源, raw);
  if (详情.链接.length < 10) return null;
  return { 音源: session.音源, 详情 };
}
async function 处理选歌(ctx, 目标, userId, index, 模式) {
  const session = 读临时歌单(ctx, userId);
  if (!session || index < 1 || index > session.count) {
    await 发消息(ctx, 目标, [
      段_md(`## 选歌失败

可选范围 **1 ~ ${session?.count ?? 0}**，请先点歌`)
    ]);
    return;
  }
  try {
    const result = await 获取选歌详情(ctx, userId, index);
    if (!result) {
      await 发消息(ctx, 目标, [段_md(`## 选歌失败

**${session.音源}** 接口返回异常`)]);
      return;
    }
    const { 音源, 详情 } = result;
    if (模式 === "link") {
      await 发消息(ctx, 目标, [段_md(构建链接Md(详情))]);
      return;
    }
    await 发音乐卡片(ctx, 目标, 详情.歌名, 详情.歌手, 详情.封面, 详情.链接, 音源);
  } catch (error) {
    ctx.logger?.error?.("[GF_mk] 选歌异常:", error);
    await 发消息(ctx, 目标, [
      段_md(`## 选歌异常

${转义Md(error instanceof Error ? error.message : String(error))}`)
    ]);
  }
}
async function 处理播放收藏(ctx, 目标, userId, index, 模式) {
  const list = 读收藏(ctx, userId);
  if (index < 1 || index > list.length) {
    await 发消息(ctx, 目标, [段_md(`## 播放失败

收藏共 **${list.length}** 首`)]);
    return;
  }
  const item = list[index - 1];
  try {
    const raw = await 请求Json(选歌Api(item.音源, item.搜索, item.序号));
    const 详情 = 解析歌曲详情(item.音源, raw);
    if (详情.链接.length < 10) {
      await 发消息(ctx, 目标, [段_md("## 播放失败\n\n接口返回异常")]);
      return;
    }
    if (模式 === "link") {
      await 发消息(ctx, 目标, [段_md(构建链接Md(详情))]);
      return;
    }
    await 发音乐卡片(ctx, 目标, 详情.歌名, 详情.歌手, 详情.封面, 详情.链接, item.音源);
  } catch (error) {
    ctx.logger?.error?.("[GF_mk] 播放收藏异常:", error);
    await 发消息(ctx, 目标, [
      段_md(`## 播放异常

${转义Md(error instanceof Error ? error.message : String(error))}`)
    ]);
  }
}
async function tryHandleMusicCommand(ctx, event, 目标, text) {
  const 消息 = String(text ?? "").trim();
  if (!消息) return false;
  const userId = 取用户Id(event);
  if (消息 === "音乐功能" || 消息 === "音乐系统" || 消息 === "音乐菜单") {
    await 发送音乐菜单(ctx, 目标);
    return true;
  }
  const 点歌Match = 消息.match(/^(酷我|汽水|网易云|QQ|)点歌([\s\S]+)$/);
  if (点歌Match) {
    const prefix = String(点歌Match[1] ?? "").trim();
    const keyword = String(点歌Match[2] ?? "").trim();
    const 音源 = prefix || 读默认音源(ctx, userId);
    if (!音源列表.includes(音源)) {
      await 发消息(ctx, 目标, [段_md("## 未知音源\n\n支持：QQ / 汽水 / 酷我 / 网易云")]);
      return true;
    }
    await 处理点歌(ctx, 目标, userId, 音源, keyword, prefix !== "");
    return true;
  }
  const 选歌Match = 消息.match(/^(链接|卡片|语音|)选歌([0-9]+)$/);
  if (选歌Match) {
    const mode = String(选歌Match[1] ?? "").trim();
    const index = Number(选歌Match[2]);
    if (mode === "语音") {
      await 发消息(ctx, 目标, [段_md("## 暂不支持\n\n官方机器人暂不支持语音消息，请用 `选歌1`")]);
      return true;
    }
    await 处理选歌(ctx, 目标, userId, index, mode === "链接" ? "link" : "ark");
    return true;
  }
  if (消息 === "我的收藏" || 消息 === "个人歌单") {
    const list = 读收藏(ctx, userId);
    if (!list.length) {
      await 发消息(ctx, 目标, [段_md("## 个人歌单\n\n暂无收藏，点歌后可用 `收藏歌曲1`")]);
      return true;
    }
    await 发消息(ctx, 目标, [段_md(构建歌单Md(list))]);
    return true;
  }
  const 收藏Match = 消息.match(/^(收藏音乐|收藏歌曲)([0-9]+)$/);
  if (收藏Match) {
    const index = Number(收藏Match[2]);
    const session = 读临时歌单(ctx, userId);
    if (!session || index < 1 || index > session.count) {
      await 发消息(ctx, 目标, [段_md("## 收藏失败\n\n请先点歌并确认序号")]);
      return true;
    }
    const item = session.data[index - 1];
    const list = 读收藏(ctx, userId);
    list.push({
      搜索: session.searchName,
      序号: index,
      音源: session.音源,
      歌名: item.歌名,
      歌手: item.歌手
    });
    写收藏(ctx, userId, list);
    await 发消息(ctx, 目标, [
      段_md(`## 已收藏

**${转义Md(item.歌名)}** — _${转义Md(item.歌手)}_`)
    ]);
    return true;
  }
  const 取消Match = 消息.match(/^取消收藏([0-9]+)(-|_|\.|)([0-9]+|)$/);
  if (取消Match) {
    const start = Number(取消Match[1]);
    const endRaw = String(取消Match[3] ?? "").trim();
    const end = endRaw ? Number(endRaw) : start;
    const list = 读收藏(ctx, userId);
    if (!list.length || start < 1 || start > list.length) {
      await 发消息(ctx, 目标, [段_md("## 取消失败\n\n序号无效")]);
      return true;
    }
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    if (hi > list.length) {
      await 发消息(ctx, 目标, [段_md(`## 取消失败

范围超出，当前共 **${list.length}** 首`)]);
      return true;
    }
    const removed = list.splice(lo - 1, hi - lo + 1);
    写收藏(ctx, userId, list);
    const names = removed.map((x) => `- ${转义Md(x.歌名)}`).join("\n");
    await 发消息(ctx, 目标, [段_md(`## 已删除 ${removed.length} 首

${names}`)]);
    return true;
  }
  if (消息 === "清空个人收藏歌曲" || 消息 === "清空个人收藏音乐") {
    写收藏(ctx, userId, []);
    await 发消息(ctx, 目标, [段_md("## 已清空\n\n个人收藏已重置")]);
    return true;
  }
  const 播放Match = 消息.match(/^(链接|卡片|语音|)播放收藏([0-9]+)$/);
  if (播放Match) {
    const mode = String(播放Match[1] ?? "").trim();
    const index = Number(播放Match[2]);
    if (mode === "语音") {
      await 发消息(ctx, 目标, [段_md("## 暂不支持\n\n请用 `播放收藏1`")]);
      return true;
    }
    await 处理播放收藏(ctx, 目标, userId, index, mode === "链接" ? "link" : "ark");
    return true;
  }
  return false;
}
function 取音乐收藏数(ctx, userId) {
  try {
    return 读收藏(ctx, userId).length;
  } catch {
    return 0;
  }
}
function 取音乐默认音源(ctx, userId) {
  try {
    return 读默认音源(ctx, userId);
  } catch {
    return "汽水";
  }
}

const BTN_MAIN_MENU = "main_menu";
const BTN_MENU_MUSIC = "menu_music";
const BTN_MENU_HELP = "menu_help";
const BTN_MENU_FORTUNE = "fortune_draw";
const BTN_MENU_CHECKIN = "checkin_punch";
const BTN_MENU_MYINFO = "my_profile";
const BTN_MENU_SUPERPOWER = "menu_superpower";
const BTN_MENU_ARMOR = "menu_armor";
function 构建主菜单Md() {
  return [
    "# GF_mk",
    "",
    "直接点下面按钮就行。",
    "没开号的话，先点「星甲玩法」里的装甲。"
  ].join("\n");
}
function 构建主菜单Keyboard() {
  return {
    rows: [
      行(
        钮(BTN_MENU_CHECKIN, "每日巡游", BTN_MENU_CHECKIN),
        钮(BTN_MENU_SUPERPOWER, "今日超能力", BTN_MENU_SUPERPOWER)
      ),
      行(
        钮(BTN_MENU_ARMOR, "星甲玩法", BTN_MENU_ARMOR),
        钮(BTN_MENU_FORTUNE, "今日运势", BTN_MENU_FORTUNE)
      ),
      行(
        钮(BTN_MENU_MUSIC, "点歌", BTN_MENU_MUSIC),
        钮(BTN_MENU_MYINFO, "我的信息", BTN_MENU_MYINFO)
      )
    ]
  };
}
async function 发送主菜单(ctx, 目标, 互动回复 = false) {
  const 内容 = 段_md(构建主菜单Md(), 构建主菜单Keyboard());
  if (互动回复) {
    await 发互动回复(ctx, 目标, [内容]);
  } else {
    await 发消息(ctx, 目标, [内容]);
  }
}
async function tryHandleMainMenuText(ctx, 目标, text) {
  const 消息 = String(text ?? "").trim();
  if (消息 === "菜单" || 消息 === "主菜单" || 消息 === "/mk" || 消息 === "/MK") {
    await 发送主菜单(ctx, 目标);
    return true;
  }
  return false;
}

function ensureParent$2(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
function resolvePluginDataFile$2(ctx, rel) {
  const pluginDir = String(ctx.pluginPath || "").trim();
  return path.resolve(pluginDir, "data", rel);
}
function resolveUserDataFile$2(ctx, rel) {
  const dataDir = String(ctx.dataPath || "").trim();
  if (!dataDir) return resolvePluginDataFile$2(ctx, rel);
  return path.resolve(dataDir, rel);
}
function readPluginOrUserText(ctx, rel) {
  const userPath = resolveUserDataFile$2(ctx, rel);
  if (fs.existsSync(userPath)) return fs.readFileSync(userPath, "utf-8");
  const pluginPath = resolvePluginDataFile$2(ctx, rel);
  if (fs.existsSync(pluginPath)) return fs.readFileSync(pluginPath, "utf-8");
  return "";
}
function readJsonFile$2(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}
function writeJsonFile$2(filePath, data) {
  ensureParent$2(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}
`, "utf-8");
}
function resolveConfigPath(ctx) {
  const explicit = String(ctx.configPath || "").trim();
  return explicit || resolveUserDataFile$2(ctx, "config.json");
}
function readConfig$1(ctx) {
  return readJsonFile$2(resolveConfigPath(ctx), {});
}
function isDebugReadonly(ctx) {
  return readConfig$1(ctx).调试开关 === true;
}
function readB(ctx, fileRel, key, defaultValue = "") {
  const filePath = resolveUserDataFile$2(ctx, fileRel);
  const obj = readJsonFile$2(filePath, {});
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : defaultValue;
}
function writeB(ctx, fileRel, key, value) {
  if (isDebugReadonly(ctx)) return;
  const filePath = resolveUserDataFile$2(ctx, fileRel);
  const obj = readJsonFile$2(filePath, {});
  obj[key] = value;
  writeJsonFile$2(filePath, obj);
}
function timeYmd(ts = Math.floor(Date.now() / 1e3)) {
  const d = new Date(ts * 1e3);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function randInt$1(min, max) {
  if (max < min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

const CDN58_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.95 Safari/537.36";
function ok(source, url) {
  return { code: 0, msg: "success", data: { url, source } };
}
function fail(msg) {
  return { code: -1, msg };
}
function guid() {
  const hex = crypto.randomBytes(16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(12, 15)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
function randomAlphaNum(len) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function cdn58Encrypt(data) {
  let str = Buffer.from(data, "utf8").toString("base64");
  const equalCount = (str.match(/=/g) || []).length;
  str = str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "") + String(equalCount);
  const half = Math.floor(str.length / 2);
  return str.slice(half) + str.slice(0, half);
}
function mimeByExt(ext) {
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp"
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}
async function resolveUploadPayload(input) {
  if (input.buffer && input.buffer.length > 0) {
    const filename = input.filename || `upload_${Date.now()}.jpg`;
    return { buffer: input.buffer, filename };
  }
  if (input.filepath) {
    const abs = path.isAbsolute(input.filepath) ? input.filepath : path.resolve(input.filepath);
    if (!fs.existsSync(abs)) throw new Error("文件不存在");
    const buffer = fs.readFileSync(abs);
    const filename = input.filename || path.basename(abs);
    return { buffer, filename };
  }
  if (input.url) {
    const res = await fetch(input.url, {
      redirect: "follow",
      headers: {
        "User-Agent": CDN58_UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
      }
    });
    if (!res.ok) throw new Error(`下载图片失败 HTTP ${res.status}`);
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    let filename = input.filename || "upload.jpg";
    try {
      const u = new URL(input.url);
      const base = path.basename(u.pathname);
      if (base && base.includes(".")) filename = base;
    } catch {
    }
    const ct = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const byCt = {
      "image/png": "png",
      "image/gif": "gif",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
      "image/bmp": "bmp"
    };
    const ext = byCt[ct];
    if (ext) {
      filename = `${String(filename).replace(/\.[^.]+$/, "") || "upload"}.${ext}`;
    }
    return { buffer, filename };
  }
  throw new Error("缺少图片内容（buffer / filepath / url）");
}
async function uploadCdn58(buffer, filename) {
  const ext = path.extname(filename).replace(/^\./, "").toLowerCase();
  if (!["jpg", "jpeg", "png", "gif", "bmp"].includes(ext)) {
    throw new Error("58同城不支持该格式");
  }
  const userId = `58Anonymous${guid()}`;
  const userInfo = {
    user_id: userId,
    source: "14",
    im_token: userId,
    client_version: "1.0",
    client_type: "pcweb",
    os_type: "Chrome",
    os_version: "122.0.6261.95",
    appid: "10140-mcs@jitmouQrcHs",
    extend_flag: "0",
    unread_index: "1",
    sdk_version: "6432",
    device_id: userId,
    xxzl_smartid: "",
    id58: "CkwAd2e0U3tBNxbRAzQ2Ag=="
  };
  const params = cdn58Encrypt(new URLSearchParams(userInfo).toString());
  const postBody = cdn58Encrypt(
    JSON.stringify({
      sender_id: userId,
      sender_source: 14,
      to_id: "10002",
      to_source: 100,
      file_suffixs: [ext]
    })
  );
  const getUrl = `https://im.58.com/msg/get_pic_upload_url?params=${encodeURIComponent(params)}&version=j1.0`;
  const getRes = await fetch(getUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      Origin: "https://ai.58.com",
      Referer: "https://ai.58.com/pc/",
      "User-Agent": CDN58_UA
    },
    body: postBody
  });
  const getText = await getRes.text();
  const getJson = JSON.parse(getText);
  if (getJson?.error_code !== 0 || !getJson?.data?.upload_info?.[0]?.url) {
    throw new Error(getJson?.error_msg || "58同城获取上传地址失败");
  }
  const putUrl = String(getJson.data.upload_info[0].url);
  const putRes = await fetch(putUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeByExt(ext) },
    body: new Uint8Array(buffer)
  });
  if (!putRes.ok) throw new Error(`58同城上传失败 HTTP ${putRes.status}`);
  const marker = "/nowater/im/";
  const idx = putUrl.indexOf(marker);
  if (idx < 0) throw new Error("58同城上传地址解析失败");
  const tail = putUrl.slice(idx + marker.length).split("?")[0];
  return `https://pic${Math.floor(Math.random() * 8) + 1}.58cdn.com.cn/nowater/im/${tail}`;
}
async function uploadPngcm(buffer, filename) {
  const form = new FormData();
  form.append("name", filename);
  form.append("uuid", `o_${randomAlphaNum(27)}`);
  form.append("sign", String(Math.floor(Date.now() / 1e3)));
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);
  const res = await fetch("https://img.wnflb2023.com/application/upload.php", {
    method: "POST",
    body: form,
    headers: { Referer: "https://img.wnflb2023.com/" }
  });
  const arr = await res.json();
  if (arr?.code === 200 && arr?.url) return String(arr.url);
  throw new Error(arr?.message || "fuliba 上传失败");
}
async function uploadImgdd(buffer, filename) {
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(buffer)]), filename);
  const res = await fetch("https://imgdd.com/upload", {
    method: "POST",
    body: form,
    headers: { Referer: "https://imgdd.com/" }
  });
  const arr = await res.json();
  if (arr?.url) return String(arr.url);
  throw new Error(arr?.message || "IMGDD 上传失败");
}
async function upload(input) {
  let buffer;
  let filename;
  try {
    ({ buffer, filename } = await resolveUploadPayload(input));
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  if (buffer.length > 10 * 1024 * 1024) {
    return fail("文件最大10M");
  }
  const chain = [
    { source: "cdn58", fn: () => uploadCdn58(buffer, filename) },
    { source: "pngcm", fn: () => uploadPngcm(buffer, filename) },
    { source: "imgdd", fn: () => uploadImgdd(buffer, filename) }
  ];
  const errors = [];
  for (const item of chain) {
    try {
      const url = await item.fn();
      return ok(item.source, url);
    } catch (e) {
      errors.push(`${item.source}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return fail(errors.join(" | ") || "全部图床上传失败");
}

const SHARP_RUNTIME_DEPS_DIR = "runtime-deps";
let sharpModule = null;
let searchPaths = [];
let sharpInstallPromise = null;
let activeNpmInstallChild = null;
const activeNpmInstallTimers = {
  tick: null,
  timer: null
};
const sharpInstallState = {
  phase: "idle",
  detail: "",
  error: "",
  startedAt: 0,
  percent: 0,
  logPath: ""
};
function resolveSharpRuntimeDepsDir(dataDir) {
  return path.join(path.resolve(String(dataDir || "").trim()), SHARP_RUNTIME_DEPS_DIR);
}
function resolveSharpInstallDir(paths) {
  const dataDir = String(paths.dataDir || "").trim();
  if (dataDir) return resolveSharpRuntimeDepsDir(dataDir);
  return path.resolve(String(paths.pluginDir || "").trim());
}
function configureSharpRuntimePaths(paths) {
  const dataDir = String(paths.dataDir || "").trim();
  const pluginDir = String(paths.pluginDir || "").trim();
  const next = [];
  if (dataDir) next.push(resolveSharpRuntimeDepsDir(dataDir));
  if (pluginDir) next.push(path.resolve(pluginDir));
  searchPaths = next;
}
function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}
function sharpEntryCandidates(baseDir) {
  const root = path.join(baseDir, "node_modules", "sharp");
  return [path.join(root, "lib", "index.js"), path.join(root, "lib", "sharp.js")];
}
async function importSharpFromDir(baseDir) {
  for (const entry of sharpEntryCandidates(baseDir)) {
    if (!fileExists(entry)) continue;
    try {
      const mod = await import(pathToFileURL$1(entry).href);
      const factory = mod.default ?? mod;
      if (typeof factory === "function") return factory;
    } catch {
    }
  }
  return null;
}
function resetSharpModuleCache() {
  sharpModule = null;
}
async function loadSharp() {
  if (sharpModule) return sharpModule;
  for (const dir of searchPaths) {
    const loaded = await importSharpFromDir(dir);
    if (loaded) {
      sharpModule = loaded;
      return loaded;
    }
  }
  const mod = await import('sharp');
  sharpModule = mod.default ?? mod;
  return sharpModule;
}
async function probeSharpAvailable(timeoutMs = 8e3) {
  try {
    return await Promise.race([
      (async () => {
        const sharp = await loadSharp();
        await sharp({
          create: { width: 2, height: 2, channels: 3, background: "#000" }
        }).png().toBuffer();
        return true;
      })(),
      new Promise((resolve) => {
        setTimeout(() => resolve(false), timeoutMs);
      })
    ]);
  } catch {
    return false;
  }
}
function isSharpPackagePresentAt(baseDir) {
  const dir = String(baseDir || "").trim();
  if (!dir) return false;
  return fileExists(path.join(dir, "node_modules", "sharp", "package.json"));
}
function isSharpPackagePresent(paths) {
  for (const dir of [resolveSharpInstallDir(paths), ...searchPaths]) {
    if (dir && isSharpPackagePresentAt(dir)) return true;
  }
  const pluginDir = String(paths.pluginDir || "").trim();
  if (pluginDir && isSharpPackagePresentAt(pluginDir)) return true;
  return false;
}
function ensureSharpRuntimePackage(paths, logger) {
  const installDir = resolveSharpInstallDir(paths);
  fs.mkdirSync(installDir, { recursive: true });
  const pkgPath = path.join(installDir, "package.json");
  if (fileExists(pkgPath)) return installDir;
  const pluginPkgPath = path.join(String(paths.pluginDir || "").trim(), "package.json");
  let sharpRange = "^0.34.3";
  try {
    if (fileExists(pluginPkgPath)) {
      const pluginPkg = JSON.parse(fs.readFileSync(pluginPkgPath, "utf-8"));
      if (pluginPkg?.dependencies?.sharp) sharpRange = pluginPkg.dependencies.sharp;
    }
  } catch (e) {
    logger?.warn?.("[依赖] 读取插件 package.json 失败，使用默认 sharp 版本", e);
  }
  const runtimePkg = {
    name: "gf-mk-sharp-runtime-deps",
    private: true,
    type: "module",
    dependencies: {
      sharp: sharpRange
    }
  };
  fs.writeFileSync(pkgPath, JSON.stringify(runtimePkg, null, 2), "utf-8");
  logger?.info?.(`[依赖] 已写入 ${pkgPath}`);
  return installDir;
}
function detectLinuxLibc() {
  if (process.platform !== "linux") return "";
  if (fileExists("/lib/ld-musl-x86_64.so.1") || fileExists("/lib/ld-musl-aarch64.so.1") || fileExists("/lib/ld-musl-armhf.so.1")) {
    return "musl";
  }
  return "glibc";
}
function buildPlatformLabel() {
  const libc = detectLinuxLibc();
  const base = `${os.platform()}-${os.arch()}`;
  return libc ? `${base} (${libc})` : base;
}
function buildManualInstallHint(installDir, paths) {
  const dir = path.resolve(String(installDir || "").trim() || ".");
  const platform = buildPlatformLabel();
  const dataHint = paths.dataDir ? `（咔咔珂请装到 data 目录下的 ${SHARP_RUNTIME_DEPS_DIR}，勿在 plugins 目录 npm install）` : "";
  return [
    `平台: ${platform} · Node ${process.version}${dataHint}`,
    "SSH 手动安装：",
    `cd "${dir}"`,
    "rm -rf node_modules/sharp node_modules/@img",
    "npm config set registry https://registry.npmmirror.com   # 国内建议",
    "npm install --omit=dev --no-audit --no-fund",
    `日志: ${path.join(dir, "sharp-install.log")}`
  ].join("\n");
}
function isSharpInstallRunning() {
  return sharpInstallPromise != null || sharpInstallState.phase === "running";
}
async function probeSharpSafe(timeoutMs = 8e3) {
  if (isSharpInstallRunning()) return false;
  return probeSharpAvailable(timeoutMs);
}
function clearNpmInstallTimers() {
  if (activeNpmInstallTimers.tick) {
    clearInterval(activeNpmInstallTimers.tick);
    activeNpmInstallTimers.tick = null;
  }
  if (activeNpmInstallTimers.timer) {
    clearTimeout(activeNpmInstallTimers.timer);
    activeNpmInstallTimers.timer = null;
  }
}
function killNpmInstallChild(logger) {
  const child = activeNpmInstallChild;
  if (!child) return;
  activeNpmInstallChild = null;
  try {
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        shell: true,
        stdio: "ignore"
      });
    } else {
      child.kill("SIGKILL");
    }
  } catch (e) {
    logger?.warn?.("[依赖] 终止 npm install 进程失败:", e);
  }
}
function cancelSharpDependencyInstall(logger) {
  clearNpmInstallTimers();
  killNpmInstallChild(logger);
  sharpInstallPromise = null;
  sharpInstallState.phase = "idle";
  sharpInstallState.detail = "";
  sharpInstallState.error = "";
  sharpInstallState.percent = 0;
  sharpInstallState.startedAt = 0;
  sharpInstallState.logPath = "";
  resetSharpModuleCache();
  logger?.info?.("[依赖] Sharp 安装任务已取消（插件停用）");
}
function setInstallProgress(phase, detail, percent, error = "") {
  sharpInstallState.phase = phase;
  sharpInstallState.detail = detail;
  sharpInstallState.percent = Math.max(0, Math.min(100, percent));
  sharpInstallState.error = error;
  if (phase === "running" && !sharpInstallState.startedAt) {
    sharpInstallState.startedAt = Date.now();
  }
}
function findNpmCliJs() {
  const nodeDir = path.dirname(process.execPath);
  const guesses = [
    path.join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(nodeDir, "..", "libexec", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js")
  ];
  for (const g of guesses) {
    if (fileExists(g)) return g;
  }
  return null;
}
function resolveNpmSpawn(installArgs) {
  const baseOptions = {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      npm_config_fund: "false",
      npm_config_audit: "false",
      npm_config_fetch_timeout: "600000",
      npm_config_progress: "true"
    }
  };
  if (process.platform === "win32") {
    return {
      command: "npm.cmd",
      args: installArgs,
      options: { ...baseOptions, shell: true }
    };
  }
  const npmCli = findNpmCliJs();
  if (npmCli) {
    return {
      command: process.execPath,
      args: [npmCli, ...installArgs],
      options: baseOptions
    };
  }
  const localNpm = path.join(path.dirname(process.execPath), "npm");
  if (fileExists(localNpm)) {
    return { command: localNpm, args: installArgs, options: baseOptions };
  }
  return { command: "npm", args: installArgs, options: baseOptions };
}
function appendInstallLog(logPath, chunk) {
  if (!logPath || !chunk) return;
  try {
    fs.appendFileSync(logPath, chunk, "utf-8");
  } catch {
  }
}
function cleanBrokenSharpArtifacts(installDir, logger) {
  const nm = path.join(path.resolve(installDir), "node_modules");
  for (const name of ["sharp", "@img"]) {
    const target = path.join(nm, name);
    if (!fileExists(target)) continue;
    try {
      fs.rmSync(target, { recursive: true, force: true });
      logger?.info?.(`[依赖] 已清理: ${target}`);
    } catch (e) {
      logger?.warn?.(`[依赖] 清理 ${target} 失败:`, e);
    }
  }
}
function runNpmInstall(installDir, timeoutMs, logger, onProgress) {
  return new Promise((resolve) => {
    const cwd = path.resolve(installDir);
    const pkgPath = path.join(cwd, "package.json");
    if (!fileExists(pkgPath)) {
      resolve({ ok: false, message: "package.json 不存在" });
      return;
    }
    const logPath = path.join(cwd, "sharp-install.log");
    sharpInstallState.logPath = logPath;
    try {
      fs.writeFileSync(
        logPath,
        `[${(/* @__PURE__ */ new Date()).toISOString()}] Sharp install · ${buildPlatformLabel()} · cwd=${cwd}
`,
        "utf-8"
      );
    } catch {
    }
    const installArgs = ["install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=warn"];
    const spawnSpec = resolveNpmSpawn(installArgs);
    onProgress?.("正在执行 npm install…", 15);
    logger?.info?.(
      `[依赖] 正在 ${cwd} 执行 npm install（${spawnSpec.command} ${spawnSpec.args.join(" ")}）…`
    );
    const child = spawn(spawnSpec.command, spawnSpec.args, { ...spawnSpec.options, cwd });
    activeNpmInstallChild = child;
    let stderr = "";
    let stdout = "";
    const started = Date.now();
    clearNpmInstallTimers();
    activeNpmInstallTimers.tick = setInterval(() => {
      const elapsed = Date.now() - started;
      onProgress?.(
        "正在下载 Sharp 原生包（装到 data/runtime-deps，避免插件热重载）…",
        Math.min(88, 15 + Math.floor(elapsed / 4e3))
      );
    }, 2e3);
    activeNpmInstallTimers.timer = setTimeout(() => {
      clearNpmInstallTimers();
      killNpmInstallChild(logger);
      appendInstallLog(logPath, `
[timeout] exceeded ${timeoutMs}ms
`);
      resolve({
        ok: false,
        message: "npm install 超时，请 SSH 手动安装（见 sharp-install.log）"
      });
    }, timeoutMs);
    const finish = (result) => {
      clearNpmInstallTimers();
      if (activeNpmInstallChild === child) activeNpmInstallChild = null;
      appendInstallLog(logPath, `
[result] ${result.ok ? "ok" : "fail"}: ${result.message}
`);
      if (result.ok) {
        logger?.info?.("[依赖] npm install 完成");
      } else {
        logger?.warn?.(`[依赖] npm install 失败: ${result.message}`);
      }
      resolve(result);
    };
    child.stdout?.on("data", (chunk) => {
      const text = String(chunk || "");
      stdout += text;
      appendInstallLog(logPath, text);
    });
    child.stderr?.on("data", (chunk) => {
      const text = String(chunk || "");
      stderr += text;
      appendInstallLog(logPath, text);
    });
    child.on("error", (err) => {
      const msg = err?.message || String(err);
      finish({
        ok: false,
        message: msg.includes("ENOENT") ? `${msg}（未找到 npm，请 SSH 手动安装）` : msg
      });
    });
    child.on("close", (code) => {
      if (code === 0) {
        onProgress?.("依赖下载完成，正在验证 Sharp…", 92);
        finish({ ok: true, message: "ok" });
        return;
      }
      const tail = (stderr || stdout).trim().split(/\r?\n/).slice(-8).join(" ");
      finish({ ok: false, message: tail || `npm install 退出码 ${code ?? "unknown"}` });
    });
  });
}
async function installSharpOnce(paths, logger) {
  setInstallProgress("running", "准备安装…", 5);
  resetSharpModuleCache();
  const installDir = ensureSharpRuntimePackage(paths, logger);
  if (!installDir || !fileExists(path.join(installDir, "package.json"))) {
    setInstallProgress("failed", "无法创建 runtime-deps", 0, "无法创建安装目录");
    return false;
  }
  setInstallProgress("running", "清理旧 Sharp 原生包…", 10);
  cleanBrokenSharpArtifacts(installDir, logger);
  const result = await runNpmInstall(installDir, 6e5, logger, (detail, percent) => {
    setInstallProgress("running", detail, percent);
  });
  resetSharpModuleCache();
  if (!result.ok) {
    setInstallProgress(
      "failed",
      result.message,
      0,
      `${result.message}
${buildManualInstallHint(installDir, paths)}`
    );
    return false;
  }
  setInstallProgress("running", "验证 Sharp 模块…", 95);
  if (await probeSharpAvailable(15e3)) {
    setInstallProgress("success", "Sharp 已安装并可用", 100);
    logger?.info?.(`[依赖] Sharp 已就绪: ${installDir}`);
    return true;
  }
  const msg = [
    `npm 已完成但 Sharp 仍无法加载（${buildPlatformLabel()}）`,
    buildManualInstallHint(installDir, paths)
  ].join("\n");
  setInstallProgress("failed", "Sharp 验证失败", 0, msg);
  logger?.warn?.(`[依赖] ${msg}`);
  return false;
}
async function getSharpDependencyStatus(paths) {
  const installDir = resolveSharpInstallDir(paths);
  const pluginDir = path.resolve(String(paths.pluginDir || "").trim());
  const dataDir = String(paths.dataDir || "").trim();
  const installing = isSharpInstallRunning();
  const packagePresent = isSharpPackagePresent(paths);
  const platform = buildPlatformLabel();
  const manualHint = buildManualInstallHint(installDir, paths);
  const logPath = sharpInstallState.logPath || path.join(installDir, "sharp-install.log");
  const available = installing ? false : await probeSharpSafe();
  let message = "";
  if (installing) {
    message = sharpInstallState.detail || "正在安装中…";
  } else if (available) {
    message = `Sharp 已就绪（${platform}）`;
  } else if (sharpInstallState.phase === "failed" && sharpInstallState.error) {
    message = sharpInstallState.error;
  } else if (packagePresent) {
    message = `检测到 sharp 包但无法加载（${platform}），请重新安装`;
  } else {
    message = `未安装 Sharp（${platform}），将安装到 data/${SHARP_RUNTIME_DEPS_DIR}`;
  }
  return {
    available,
    packagePresent,
    installing,
    platform,
    libc: detectLinuxLibc(),
    installDir,
    pluginDir,
    dataDir,
    message,
    phase: installing ? "running" : sharpInstallState.phase,
    detail: sharpInstallState.detail,
    percent: sharpInstallState.percent,
    logPath,
    manualHint
  };
}
async function triggerSharpDependencyInstall(paths, logger) {
  if (!isSharpInstallRunning() && await probeSharpSafe()) {
    setInstallProgress("success", "Sharp 已就绪", 100);
    return { accepted: false, message: "Sharp 已就绪，无需重复安装" };
  }
  if (sharpInstallPromise) {
    return { accepted: true, message: "安装已在进行中" };
  }
  sharpInstallState.startedAt = Date.now();
  sharpInstallState.error = "";
  setInstallProgress("running", "已开始安装…", 8);
  sharpInstallPromise = installSharpOnce(paths, logger).catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    setInstallProgress("failed", msg, 0, msg);
    logger?.error?.("[依赖] 安装异常:", e);
    return false;
  }).finally(() => {
    sharpInstallPromise = null;
  });
  return { accepted: true, message: "已开始安装，请稍候" };
}

const BTN_FORTUNE_DRAW = BTN_MENU_FORTUNE;
function escapeXml$4(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function wrapText$2(text, maxChars, maxLines = 6) {
  const s = String(text || "").trim();
  if (!s) return [""];
  const lines = [];
  let cur = "";
  for (const ch of s) {
    if (cur.length >= maxChars) {
      lines.push(cur);
      cur = "";
      if (lines.length >= maxLines) break;
    }
    cur += ch;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.length ? lines : [""];
}
function fetchUrlBuffer$2(url, timeoutMs = 2e4) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      { timeout: timeoutMs, headers: { "User-Agent": "MKbot-FortuneSharp/1.0" } },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrlBuffer$2(res.headers.location, timeoutMs).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
  });
}
function decodeDataUrl(dataUrl) {
  const m = String(dataUrl || "").match(/^data:[^;]+;base64,(.+)$/i);
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}
async function loadFortuneBackground(card, pluginDir, dataPath) {
  const candidates = [];
  const push = (v) => {
    const s = String(v || "").trim();
    if (s && !candidates.includes(s)) candidates.push(s);
  };
  push(card.backgroundImageUrl);
  const imageName = String(card.image_name || "").trim();
  if (imageName) {
    if (path.isAbsolute(imageName)) push(imageName);
    const roots = [
      path.join(String(dataPath || "").trim(), "默认资源", "image"),
      path.join(String(pluginDir || "").trim(), "data", "默认资源", "image")
    ];
    for (const root of roots) {
      if (!root.trim()) continue;
      push(path.join(root, imageName));
    }
  }
  for (const src of candidates) {
    try {
      if (/^data:/i.test(src)) {
        const buf = decodeDataUrl(src);
        if (buf && buf.length) return buf;
        continue;
      }
      if (/^file:\/\//i.test(src)) {
        const abs = fileURLToPath(src);
        if (fs.existsSync(abs)) return fs.readFileSync(abs);
        continue;
      }
      if (/^https?:\/\//i.test(src)) {
        const buf = await fetchUrlBuffer$2(src, 25e3);
        if (buf.length > 0) return buf;
        continue;
      }
      if (fs.existsSync(src)) return fs.readFileSync(src);
    } catch {
    }
  }
  return null;
}
function calcFortuneCardLayout(width, height, unSignText) {
  const cardW = Math.min(480, width - 40);
  const cardX = (width - cardW) / 2;
  const bottomPad = 50;
  const subLines = wrapText$2(unSignText, 26, 6);
  const cardH = 30 + 88 + 25 + 54 + subLines.length * 24 + 16 + 48 + 30;
  const cardY = height - bottomPad - cardH;
  return { cardW, cardX, cardY, cardH, subLines };
}
function buildFortuneOverlaySvg(width, height, card) {
  const font = "Microsoft YaHei, Noto Sans SC, sans-serif";
  const accent = "#FFB6C1";
  const glass = "rgba(15,15,18,0.5)";
  const title = escapeXml$4(card.Sorte || "大吉");
  const stars = escapeXml$4(card.Estrelas || "★★★★★★★");
  const time = escapeXml$4(card.time || "");
  const unSignText = String(card.unSignText || "此签为大吉之兆");
  const { cardW, cardX, cardY, cardH, subLines } = calcFortuneCardLayout(width, height, unSignText);
  const pad = 30;
  const avatarSize = 80;
  const avatarX = cardX + pad;
  const avatarY = cardY + pad;
  const infoX = avatarX + avatarSize + 18;
  const infoTimeY = avatarY + 18;
  const infoTitleY = avatarY + 44;
  const infoStarsY = avatarY + 72;
  const parts = [];
  parts.push(
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="35" ry="35" fill="${glass}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`
  );
  parts.push(
    `<circle cx="${avatarX + avatarSize / 2}" cy="${avatarY + avatarSize / 2}" r="${avatarSize / 2 + 1.5}" fill="none" stroke="#ffffff" stroke-width="3"/>`
  );
  parts.push(
    `<text x="${infoX}" y="${infoTimeY}" font-family="${font}" font-size="13" font-weight="900" fill="${accent}" letter-spacing="1">time:${time}</text>`
  );
  parts.push(
    `<text x="${infoX}" y="${infoTitleY}" font-family="${font}" font-size="26" font-weight="700" fill="#ffffff">${title}</text>`
  );
  parts.push(
    `<text x="${infoX}" y="${infoStarsY}" font-family="${font}" font-size="18" fill="${accent}">${stars}</text>`
  );
  const mainTop = avatarY + avatarSize + 25;
  const barX = cardX + pad;
  const textX = barX + 16;
  parts.push(
    `<rect x="${barX}" y="${mainTop + 2}" width="4" height="24" rx="2" fill="#ffffff" opacity="0.95"/>`
  );
  const signLines = wrapText$2(card.signText || "", 22, 2);
  signLines.forEach((line, i) => {
    parts.push(
      `<text x="${textX}" y="${mainTop + 20 + i * 26}" font-family="${font}" font-size="19" font-weight="600" fill="#ffffff">${escapeXml$4(line)}</text>`
    );
  });
  const subTop = mainTop + 20 + signLines.length * 26 + 14;
  const subX = cardX + pad + 17;
  parts.push(
    `<line x1="${cardX + pad}" y1="${subTop - 8}" x2="${cardX + pad}" y2="${subTop - 8 + subLines.length * 24 + 8}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`
  );
  subLines.forEach((line, i) => {
    parts.push(
      `<text x="${subX}" y="${subTop + i * 24}" font-family="${font}" font-size="15" fill="rgba(255,255,255,0.7)">${escapeXml$4(line)}</text>`
    );
  });
  const noteY = cardY + cardH - 22;
  parts.push(
    `<text x="${cardX + cardW / 2}" y="${noteY}" text-anchor="middle" font-family="${font}" font-size="11" fill="rgba(255,255,255,0.3)" letter-spacing="2">本内容为虚拟生成，切勿迷信！</text>`
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join("\n")}</svg>`;
}
async function roundAvatar$1(sharp, buf, size) {
  try {
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
    );
    return await sharp(buf).resize(size, size, { fit: "cover" }).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  } catch {
    return null;
  }
}
async function renderFortuneWithSharp(options, logger) {
  const width = options.width ?? 720;
  const height = options.height ?? 1280;
  const card = options.card || {};
  const pluginDir = String(options.pluginDir || "").trim();
  const dataPath = String(options.dataPath || "").trim();
  try {
    const sharp = await loadSharp();
    const bgBuf = await loadFortuneBackground(card, pluginDir, dataPath);
    const composites = [];
    if (bgBuf && bgBuf.length > 0) {
      const bgLayer = await sharp(bgBuf).resize(width, height, { fit: "cover", position: "centre" }).ensureAlpha().png().toBuffer();
      composites.push({ input: bgLayer, top: 0, left: 0 });
    } else {
      const fallback = await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 255, g: 240, b: 243 }
        }
      }).png().toBuffer();
      composites.push({ input: fallback, top: 0, left: 0 });
      logger?.warn?.("[Sharp渲染] 今日运势背景图不可用，已使用默认底色");
    }
    const overlaySvg = buildFortuneOverlaySvg(width, height, card);
    const overlayLayer = await sharp(Buffer.from(overlaySvg)).png().toBuffer();
    composites.push({ input: overlayLayer, top: 0, left: 0 });
    const { cardX, cardY } = calcFortuneCardLayout(width, height, String(card.unSignText || ""));
    const qq = String(card.qq || "").trim();
    const avatarUrl = String(card.avatarUrl || "").trim() || (/^\d{5,}$/.test(qq) ? `https://q4.qlogo.cn/g?b=qq&nk=${qq}&s=100` : "");
    if (avatarUrl) {
      try {
        const avatarBuf = await fetchUrlBuffer$2(avatarUrl, 1e4);
        if (avatarBuf.length > 0) {
          const rounded = await roundAvatar$1(sharp, avatarBuf, 80);
          if (rounded) {
            composites.push({
              input: rounded,
              top: Math.round(cardY + 30),
              left: Math.round(cardX + 30)
            });
          }
        }
      } catch {
      }
    }
    const out = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      }
    }).composite(composites).png().toBuffer();
    return out.toString("base64");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger?.error?.("[Sharp渲染] 今日运势渲染失败:", msg);
    return null;
  }
}
function qqAppAvatarUrl$2(appId, openId, size = 100) {
  const a = String(appId || "").trim();
  const id = String(openId || "").trim();
  if (!a || !id) return "";
  return `https://q.qlogo.cn/qqapp/${a}/${id}/${size}`;
}
function 构建运势Footer键盘() {
  return {
    rows: [
      行(
        钮(BTN_MENU_FORTUNE, "我也要抽", BTN_MENU_FORTUNE),
        钮("btn_fortune_home", "返回首页", BTN_MAIN_MENU)
      )
    ]
  };
}
function parseJsonArray(raw) {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function parseFortuneUserRecord(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") return raw;
  try {
    const o = JSON.parse(String(raw));
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}
function resolveFortuneImageFields(item) {
  let 图片 = "";
  let 图片远程 = "";
  if (typeof item === "string") {
    const trimmed = item.trim();
    if (/^https?:\/\//i.test(trimmed)) 图片远程 = trimmed;
    else 图片 = trimmed;
  } else if (item && typeof item === "object") {
    const o = item;
    图片远程 = String(o.url ?? o.remote ?? o.link ?? "").trim();
  }
  return { 图片, 图片远程 };
}
function localFortuneFileName(图片序号) {
  const n = Math.max(1, Math.min(17, Number(图片序号) + 1 || 1));
  return `运势${n}.png`;
}
function resolveLocalFortuneAbs(ctx, fileName) {
  const user = resolveUserDataFile$2(ctx, path.join("默认资源", "image", fileName));
  if (fs.existsSync(user)) return user;
  return resolvePluginDataFile$2(ctx, path.join("默认资源", "image", fileName));
}
function resolveNetworkBgUrl(图片, 图片远程) {
  const remote = String(图片远程 || "").trim();
  if (/^https?:\/\//i.test(remote)) return remote.replace(/^http:/i, "https:");
  const local = String(图片 || "").trim();
  if (/^https?:\/\//i.test(local)) return local.replace(/^http:/i, "https:");
  return "";
}
function resolveBotAppId(ctx) {
  const root = String(ctx.frameworkEnv?.projectRoot || "").trim();
  if (!root) return "";
  const connId = String(ctx.connectionId || ctx.frameworkEnv?.connectionId || "").trim();
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(root, "data", "connections.json"), "utf8")
    );
    const list = Array.isArray(raw.connections) ? raw.connections : [];
    const picked = (connId ? list.find((c) => c.id === connId) : void 0) || list.find((c) => (c.type ?? "") === "qq_official" && c.enable !== false) || list.find((c) => (c.type ?? "") === "qq_official");
    return String(picked?.appId || "").trim();
  } catch {
    return "";
  }
}
function 取用户头像Url(ctx, event) {
  const author = event.author;
  const fromEvent = String(author?.avatar || event.avatar || "").trim();
  if (/^https?:\/\//i.test(fromEvent)) return fromEvent.replace(/^http:/i, "https:");
  const openid = 取用户Id(event);
  const appId = resolveBotAppId(ctx);
  const byApp = qqAppAvatarUrl$2(appId, openid === "unknown" ? "" : openid, 100);
  if (byApp) return byApp;
  if (/^\d{5,}$/.test(openid)) {
    return `https://q4.qlogo.cn/g?b=qq&nk=${openid}&s=100`;
  }
  return "";
}
function buildCard(ctx, event, bg, 标题, 星数, 附言, 细附) {
  const now = /* @__PURE__ */ new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
  return {
    qq: 取用户Id(event),
    avatarUrl: 取用户头像Url(ctx, event),
    time: dateStr,
    Sorte: 标题 || "大吉",
    Estrelas: 星数 || "★★★★★★★",
    signText: 附言 || "福星高照，万事如意",
    unSignText: 细附 || "此签为大吉之兆",
    image_name: bg.imageName,
    backgroundImageUrl: bg.url
  };
}
async function uploadFortunePng(base64) {
  const buf = Buffer.from(base64, "base64");
  const result = await upload({
    buffer: buf,
    filename: `fortune_${Date.now()}.png`
  });
  if (result.code !== 0 || !result.data?.url) {
    throw new Error(result.msg || "图床上传失败");
  }
  return result.data.url;
}
async function renderAndSendMd(ctx, 目标, card) {
  const base64 = await renderFortuneWithSharp(
    {
      card,
      pluginDir: String(ctx.pluginPath || ""),
      dataPath: String(ctx.dataPath || ""),
      width: 720,
      height: 1280
    },
    ctx.logger
  );
  if (!base64) return false;
  const url = await uploadFortunePng(base64);
  const debugNote = isDebugReadonly(ctx) ? ["", "_调试开关已开：本次未写入运势记录_"] : [];
  const md = [
    "# 今日运势",
    "",
    md图片行(url, { alt: "今日运势", 宽: 720, 高: 1280 }),
    "",
    `**${card.Sorte}** ${card.Estrelas}`,
    "",
    `> ${card.signText}`,
    "",
    "_本内容为虚拟生成，切勿迷信_",
    ...debugNote
  ].join("\n");
  await 发消息(ctx, 目标, [段_md(md, 构建运势Footer键盘())]);
  return true;
}
async function tryHandleFortuneCommand(ctx, event, 目标, 消息) {
  if (消息 !== "今日运势") return false;
  const uid = 取用户Id(event);
  const sharpOk = await probeSharpAvailable(8e3);
  if (!sharpOk) {
    await 发消息(ctx, 目标, [
      段_md(
        [
          "## 今日运势",
          "",
          "图片渲染依赖（Sharp / Node 原生）尚未安装或不可用。",
          "",
          "请打开 **GF_mk 后台** → 安装 Sharp 依赖后再试。"
        ].join("\n")
      )
    ]);
    return true;
  }
  await 发消息(ctx, 目标, [段_md("正在绘制今日运势，请稍等…")]);
  const 今天 = timeYmd();
  const 今日我的 = parseFortuneUserRecord(readB(ctx, `今日运势/${今天}.json`, uid, "{}"));
  const 数据 = parseJsonArray(readPluginOrUserText(ctx, "默认资源/text/运势.json"));
  const 图片数据 = parseJsonArray(readPluginOrUserText(ctx, "默认资源/text/URL.json"));
  if (!数据.length) {
    await 发消息(ctx, 目标, [段_md("运势文案缺失：请检查 `data/默认资源/text/运势.json`")]);
    return true;
  }
  let 序号 = 0;
  let 图片序号 = 0;
  if (!今日我的 || Object.keys(今日我的).length === 0) {
    序号 = randInt$1(0, 数据.length - 1);
    图片序号 = randInt$1(0, Math.max(0, (图片数据.length || 17) - 1));
    writeB(
      ctx,
      `今日运势/${今天}.json`,
      uid,
      JSON.stringify({ 文本: 序号, 图片: 图片序号 })
    );
  } else {
    序号 = Number(今日我的.文本 ?? 0);
    图片序号 = Number(今日我的.图片 ?? 0);
  }
  const entry = 数据[序号] || 数据[0];
  const { 图片, 图片远程 } = resolveFortuneImageFields(图片数据[图片序号]);
  const localName = localFortuneFileName(图片序号);
  const localAbs = resolveLocalFortuneAbs(ctx, localName);
  if (fs.existsSync(localAbs)) {
    try {
      const ok = await renderAndSendMd(
        ctx,
        目标,
        buildCard(
          ctx,
          event,
          { imageName: localName, url: localAbs },
          entry.Sorte || "",
          entry.Estrelas || "",
          entry.signText || "",
          entry.unSignText || ""
        )
      );
      if (ok) return true;
      ctx.logger?.warn?.("[GF_mk] 今日运势本地背景渲染失败，尝试网络背景");
    } catch (e) {
      ctx.logger?.warn?.("[GF_mk] 今日运势本地模式异常:", e);
    }
  }
  const netUrl = resolveNetworkBgUrl(图片, 图片远程);
  if (!netUrl) {
    await 发消息(ctx, 目标, [
      段_md("运势背景不可用。请确认本地 `运势1~17.png` 或 `URL.json` 中的 https 链接。")
    ]);
    return true;
  }
  try {
    const ok = await renderAndSendMd(
      ctx,
      目标,
      buildCard(
        ctx,
        event,
        { imageName: netUrl, url: netUrl },
        entry.Sorte || "",
        entry.Estrelas || "",
        entry.signText || "",
        entry.unSignText || ""
      )
    );
    if (ok) return true;
    await 发消息(ctx, 目标, [段_md("运势卡片渲染失败，请检查 Sharp 与图床网络。")]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ctx.logger?.error?.("[GF_mk] 今日运势失败:", e);
    await 发消息(ctx, 目标, [段_md(`运势处理异常：${msg}`)]);
  }
  return true;
}

function sanitizeUserId(userId) {
  return String(userId || "").trim().replace(/[\\/:*?"<>|]/g, "_").slice(0, 128);
}
function resolveNicknameDir(ctx) {
  return resolveUserDataFile$2(ctx, "昵称记录");
}
function resolveNicknameFile(ctx, userId) {
  const id = sanitizeUserId(userId);
  if (!id) throw new Error("empty userId");
  return path.join(resolveNicknameDir(ctx), `${id}.json`);
}
function 取事件昵称(event) {
  const author = event.author;
  return String(author?.username || author?.name || "").trim();
}
function 读昵称记录(ctx, userId) {
  const id = sanitizeUserId(userId);
  if (!id) return null;
  const file = path.join(resolveNicknameDir(ctx), `${id}.json`);
  try {
    if (!fs.existsSync(file)) return null;
    const o = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!o || typeof o !== "object") return null;
    return {
      userId: String(o.userId || id),
      nickname: String(o.nickname || "").trim(),
      updatedAt: String(o.updatedAt || ""),
      updatedAtMs: Number(o.updatedAtMs) || 0
    };
  } catch {
    return null;
  }
}
function 取缓存昵称(ctx, userId) {
  return 读昵称记录(ctx, userId)?.nickname || "";
}
function 更新昵称记录(ctx, userId, nickname) {
  const id = sanitizeUserId(userId);
  const name = String(nickname || "").trim();
  if (!id || id === "unknown" || !name) return false;
  const prev = 读昵称记录(ctx, id);
  if (prev?.nickname === name) return false;
  const now = /* @__PURE__ */ new Date();
  const record = {
    userId: id,
    nickname: name,
    updatedAt: now.toISOString(),
    updatedAtMs: now.getTime()
  };
  const file = resolveNicknameFile(ctx, id);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}
`, "utf8");
    ctx.logger?.debug?.(
      prev?.nickname ? `[昵称记录] 更新 ${id}: ${prev.nickname} → ${name}` : `[昵称记录] 新建 ${id}: ${name}`
    );
    return true;
  } catch (e) {
    ctx.logger?.warn?.("[GF_mk] 写入昵称记录失败:", e);
    return false;
  }
}
function 同步事件昵称(ctx, event) {
  const uid = 取用户Id(event);
  const name = 取事件昵称(event);
  更新昵称记录(ctx, uid, name);
}

const BTN_CHECKIN = BTN_MENU_CHECKIN;
function escapeXml$3(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function wrapText$1(text, maxChars, maxLines = 4) {
  const s = String(text || "").trim();
  if (!s) return [""];
  const lines = [];
  let cur = "";
  for (const ch of s) {
    if (cur.length >= maxChars) {
      lines.push(cur);
      cur = "";
      if (lines.length >= maxLines) break;
    }
    cur += ch;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.length ? lines : [""];
}
function fetchUrlBuffer$1(url, timeoutMs = 12e3) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      { timeout: timeoutMs, headers: { "User-Agent": "MKbot-CheckinSharp/1.0" } },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrlBuffer$1(res.headers.location, timeoutMs).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
  });
}
async function roundAvatar(sharp, buf, size) {
  try {
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
    );
    return await sharp(buf).resize(size, size, { fit: "cover" }).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  } catch {
    return null;
  }
}
function speckles(seed) {
  const dots = [];
  let s = seed >>> 0 || 1;
  for (let i = 0; i < 36; i++) {
    s = s * 1664525 + 1013904223 >>> 0;
    const x = 40 + s % 640;
    s = s * 1664525 + 1013904223 >>> 0;
    const y = 40 + s % 1200;
    s = s * 1664525 + 1013904223 >>> 0;
    const r = 1 + s % 3;
    const op = 0.12 + s % 40 / 100;
    dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(255,255,255,${op.toFixed(2)})"/>`);
  }
  return dots.join("");
}
function buildCheckinSvg(width, height, card) {
  const font = "Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif";
  const nick = escapeXml$3(card.nickname || "冒险者");
  const mottoLines = wrapText$1(card.motto || "", 15, 3).map(escapeXml$3);
  const milestone = escapeXml$3(card.milestone || "");
  const levelName = escapeXml$3(card.levelName || "");
  const title = card.isRepeat ? "今日已打卡" : "签到成功";
  const sub = card.isRepeat ? "节奏仍在，积分保持" : escapeXml$3(card.greet || "新的一天，能量已就位");
  const prog = Math.max(0, Math.min(1, Number(card.levelProgress) || 0));
  const barW = 520;
  const fillW = Math.max(12, Math.round(barW * prog));
  const streak = Math.max(0, Number(card.streak) || 0);
  const seed = streak * 97 + (card.dayNum || 0) * 13 + (card.hour || 0);
  const mottoTspans = mottoLines.map((line, i) => `<tspan x="92" dy="${i === 0 ? 0 : 34}">${line}</tspan>`).join("");
  const streakDots = Array.from({ length: 7 }, (_, i) => {
    const on = i < Math.min(7, streak);
    const x = 88 + i * 74;
    const fill = on ? "url(#dayOn)" : "rgba(255,255,255,0.10)";
    const stroke = on ? "#99f6e4" : "rgba(255,255,255,0.14)";
    const label = on ? String(i + 1) : "·";
    const labelFill = on ? "#042f2e" : "rgba(255,255,255,0.35)";
    return `
      <rect x="${x}" y="708" width="56" height="56" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <text x="${x + 28}" y="744" text-anchor="middle" fill="${labelFill}" font-family="${font}" font-size="20" font-weight="800">${label}</text>
    `;
  }).join("");
  const arcs = `
    <path d="M40 240 C180 180, 320 280, 680 200" fill="none" stroke="rgba(94,234,212,0.22)" stroke-width="2"/>
    <path d="M-20 1100 C200 980, 420 1180, 760 1040" fill="none" stroke="rgba(251,191,36,0.18)" stroke-width="3"/>
  `;
  const stamp = card.isRepeat ? `
    <g transform="translate(540,980) rotate(-18)">
      <circle cx="0" cy="0" r="58" fill="none" stroke="rgba(253,230,138,0.75)" stroke-width="3"/>
      <circle cx="0" cy="0" r="48" fill="none" stroke="rgba(253,230,138,0.45)" stroke-width="1.5" stroke-dasharray="4 3"/>
      <text x="0" y="8" text-anchor="middle" fill="rgba(253,230,138,0.9)" font-family="${font}" font-size="22" font-weight="800">已签到</text>
    </g>` : `
    <g transform="translate(560,980) rotate(-12)">
      <rect x="-70" y="-28" width="140" height="56" rx="14" fill="url(#badge)" opacity="0.95"/>
      <text x="0" y="8" text-anchor="middle" fill="#422006" font-family="${font}" font-size="22" font-weight="800">+${card.award} 积分</text>
    </g>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#042f2e"/>
      <stop offset="35%" stop-color="#0f766e"/>
      <stop offset="68%" stop-color="#0e7490"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="glow" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.5"/>
      <stop offset="45%" stop-color="#2dd4bf" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.1"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.26)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.08)"/>
    </linearGradient>
    <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <linearGradient id="dayOn" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5eead4"/>
      <stop offset="100%" stop-color="#14b8a6"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="55%" stop-color="#2dd4bf"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <filter id="blur" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="30"/>
    </filter>
    <filter id="soft">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000" flood-opacity="0.28"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="580" cy="90" r="200" fill="url(#glow)" filter="url(#blur)"/>
  <circle cx="60" cy="990" r="240" fill="rgba(45,212,191,0.16)" filter="url(#blur)"/>
  <circle cx="650" cy="1120" r="170" fill="rgba(251,191,36,0.14)" filter="url(#blur)"/>
  ${speckles(seed)}
  ${arcs}

  <rect x="0" y="0" width="${width}" height="8" fill="url(#bar)"/>
  <text x="52" y="56" fill="rgba(255,255,255,0.7)" font-family="${font}" font-size="18" font-weight="700">GF_mk  ·  DAILY CHECK-IN</text>

  <text x="52" y="128" fill="#ffffff" font-family="${font}" font-size="58" font-weight="800">${escapeXml$3(title)}</text>
  <text x="52" y="174" fill="rgba(204,251,241,0.95)" font-family="${font}" font-size="24">${sub}</text>

  <g filter="url(#soft)">
    <rect x="492" y="62" width="176" height="186" rx="30" fill="rgba(15,23,42,0.42)" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
  </g>
  <text x="580" y="102" text-anchor="middle" fill="#99f6e4" font-family="${font}" font-size="18" font-weight="700">${escapeXml$3(card.monthLabel)}</text>
  <text x="580" y="132" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="${font}" font-size="18">${escapeXml$3(card.weekday)}</text>
  <text x="580" y="208" text-anchor="middle" fill="#ffffff" font-family="${font}" font-size="74" font-weight="800">${card.dayNum}</text>

  <g filter="url(#soft)">
    <rect x="44" y="248" width="632" height="220" rx="38" fill="url(#card)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
  </g>
  <circle cx="138" cy="358" r="58" fill="rgba(255,255,255,0.16)" stroke="#5eead4" stroke-width="3"/>
  <text x="218" y="330" fill="#ffffff" font-family="${font}" font-size="34" font-weight="800">${nick}</text>
  <text x="218" y="372" fill="rgba(204,251,241,0.95)" font-family="${font}" font-size="22">${escapeXml$3(card.dateLabel)}</text>
  <rect x="218" y="392" width="220" height="36" rx="12" fill="rgba(15,23,42,0.28)"/>
  <text x="232" y="416" fill="#fde68a" font-family="${font}" font-size="18" font-weight="700">称号 · ${levelName}</text>
  <text x="218" y="448" fill="rgba(255,255,255,0.62)" font-family="${font}" font-size="18">连签节奏位 · Day ${streak}</text>

  <g filter="url(#soft)">
    <rect x="44" y="494" width="200" height="168" rx="30" fill="rgba(15,23,42,0.32)" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
    <rect x="260" y="494" width="200" height="168" rx="30" fill="rgba(15,23,42,0.32)" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
    <rect x="476" y="494" width="200" height="168" rx="30" fill="rgba(15,23,42,0.32)" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
  </g>
  <text x="144" y="546" text-anchor="middle" fill="rgba(255,255,255,0.62)" font-family="${font}" font-size="18">连续签到</text>
  <text x="144" y="612" text-anchor="middle" fill="#fde68a" font-family="${font}" font-size="48" font-weight="800">${streak}<tspan font-size="20" fill="rgba(255,255,255,0.75)"> 天</tspan></text>

  <text x="360" y="546" text-anchor="middle" fill="rgba(255,255,255,0.62)" font-family="${font}" font-size="18">累计打卡</text>
  <text x="360" y="612" text-anchor="middle" fill="#ffffff" font-family="${font}" font-size="48" font-weight="800">${card.totalDays}</text>

  <text x="576" y="546" text-anchor="middle" fill="rgba(255,255,255,0.62)" font-family="${font}" font-size="18">${card.isRepeat ? "今日积分" : "本次获得"}</text>
  <text x="576" y="612" text-anchor="middle" fill="#99f6e4" font-family="${font}" font-size="48" font-weight="800">+${card.award}</text>

  <text x="52" y="696" fill="rgba(255,255,255,0.78)" font-family="${font}" font-size="20" font-weight="700">近 7 日节奏</text>
  ${streakDots}

  <text x="52" y="812" fill="rgba(255,255,255,0.82)" font-family="${font}" font-size="20" font-weight="700">里程碑 · ${milestone}</text>
  <rect x="52" y="832" width="${barW}" height="20" rx="10" fill="rgba(15,23,42,0.4)"/>
  <rect x="52" y="832" width="${fillW}" height="20" rx="10" fill="url(#bar)"/>
  <circle cx="${52 + fillW}" cy="842" r="9" fill="#fff" opacity="0.9"/>
  <text x="600" y="848" text-anchor="end" fill="rgba(255,255,255,0.78)" font-family="${font}" font-size="16">${Math.round(prog * 100)}%</text>

  <g filter="url(#soft)">
    <rect x="44" y="886" width="632" height="248" rx="36" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
  </g>
  <rect x="44" y="886" width="16" height="248" rx="8" fill="url(#badge)"/>
  <text x="92" y="940" fill="#fde68a" font-family="${font}" font-size="22" font-weight="800">今日寄语</text>
  <text x="92" y="992" fill="#ffffff" font-family="${font}" font-size="28" font-weight="700">${mottoTspans}</text>
  <text x="92" y="1096" fill="rgba(204,251,241,0.92)" font-family="${font}" font-size="22">总积分  ${card.points}</text>
  ${stamp}

  <text x="360" y="1238" text-anchor="middle" fill="rgba(255,255,255,0.42)" font-family="${font}" font-size="18">坚持比运气更可靠 · GF_mk</text>
</svg>`;
}
async function renderCheckinWithSharp(options, logger) {
  const width = options.width ?? 720;
  const height = options.height ?? 1280;
  const card = options.card;
  try {
    const sharp = await loadSharp();
    const composites = [];
    const svg = buildCheckinSvg(width, height, card);
    const baseLayer = await sharp(Buffer.from(svg)).png().toBuffer();
    composites.push({ input: baseLayer, top: 0, left: 0 });
    const avatarUrl = String(card.avatarUrl || "").trim();
    if (avatarUrl) {
      try {
        const avatarBuf = await fetchUrlBuffer$1(avatarUrl, 1e4);
        if (avatarBuf.length > 0) {
          const rounded = await roundAvatar(sharp, avatarBuf, 108);
          if (rounded) {
            composites.push({ input: rounded, top: 304, left: 84 });
          }
        }
      } catch {
      }
    }
    const out = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 4, g: 47, b: 46, alpha: 1 }
      }
    }).composite(composites).png().toBuffer();
    return out.toString("base64");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger?.error?.("[Sharp渲染] 签到卡渲染失败:", msg);
    return null;
  }
}
const MOTTOS = [
  "慢慢来，比较快。",
  "今天也给自己一个小奖励。",
  "行动会治愈焦虑。",
  "把平凡的一天过成仪式感。",
  "你已经比昨天更靠近目标。",
  "稳住节奏，奇迹会自己敲门。",
  "喝口水，继续发光。",
  "坚持不是爆发，是重复。",
  "小步前进，也是前进。",
  "阳光会偏爱有准备的人。",
  "把「想做」变成「在做」。",
  "你的出勤记录，正在写传奇。"
];
const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const MONTHS = ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"];
function greetByHour(h) {
  if (h < 6) return "夜深了，也记得照顾自己";
  if (h < 11) return "早上好，新的一天从打卡开始";
  if (h < 14) return "午间小憩前，先签到一下";
  if (h < 18) return "下午好，节奏还在继续";
  if (h < 22) return "晚上好，今天你很努力";
  return "夜色温柔，打卡收工";
}
function dateParts(ymd) {
  const now = /* @__PURE__ */ new Date();
  const [y, m, d] = String(ymd || "").split("-").map((x) => Number(x));
  const dt = y && m && d ? new Date(y, m - 1, d, now.getHours(), now.getMinutes()) : now;
  return {
    weekday: WEEKDAYS[dt.getDay()] || "",
    dayNum: dt.getDate(),
    monthLabel: MONTHS[dt.getMonth()] || "",
    hour: now.getHours()
  };
}
function profilePath(ctx, userId) {
  const safe = String(userId || "").replace(/[\\/:*?"<>|]/g, "_").slice(0, 128);
  return resolveUserDataFile$2(ctx, path.join("签到", `${safe}.json`));
}
function readProfile(ctx, userId) {
  const file = profilePath(ctx, userId);
  try {
    if (!fs.existsSync(file)) return null;
    const o = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!o || typeof o !== "object") return null;
    return {
      userId: String(o.userId || userId),
      lastYmd: String(o.lastYmd || ""),
      streak: Math.max(0, Number(o.streak) || 0),
      totalDays: Math.max(0, Number(o.totalDays) || 0),
      points: Math.max(0, Number(o.points) || 0),
      lastAward: Math.max(0, Number(o.lastAward) || 0),
      motto: String(o.motto || ""),
      updatedAt: String(o.updatedAt || "")
    };
  } catch {
    return null;
  }
}
function writeProfile(ctx, profile) {
  if (isDebugReadonly(ctx)) return;
  const file = profilePath(ctx, profile.userId);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(profile, null, 2)}
`, "utf8");
}
function ymdAddDays(ymd, delta) {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const dt = new Date(y, m - 1, d + delta);
  return timeYmd(Math.floor(dt.getTime() / 1e3));
}
function pickMotto(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = h * 31 + seed.charCodeAt(i) >>> 0;
  return MOTTOS[h % MOTTOS.length];
}
function levelMeta(streak) {
  const bands = [
    { at: 3, name: "新手旅人", label: "下一站：3 日连签" },
    { at: 7, name: "节奏保持者", label: "下一站：7 日连签" },
    { at: 15, name: "惯性制造机", label: "下一站：15 日连签" },
    { at: 30, name: "月圆骑士", label: "下一站：30 日连签" },
    { at: 60, name: "双月行者", label: "下一站：60 日连签" },
    { at: 100, name: "百日传说", label: "继续刷新纪录" }
  ];
  let prev = 0;
  let name = "初来乍到";
  for (const b of bands) {
    if (streak < b.at) {
      const progress = (streak - prev) / Math.max(1, b.at - prev);
      return { name, milestone: b.label, progress };
    }
    name = b.name;
    prev = b.at;
  }
  return { name: "传奇签到官", milestone: "已超越百日", progress: 1 };
}
function calcAward(streak) {
  return 10 + Math.min(30, Math.max(1, streak));
}
function 取签到档案(ctx, userId) {
  return readProfile(ctx, userId);
}
function 取签到称号(streak) {
  return levelMeta(streak).name;
}
function 构建签到Footer键盘() {
  return {
    rows: [
      行(
        钮(BTN_MENU_CHECKIN, "我也要签", BTN_MENU_CHECKIN),
        钮(BTN_MENU_FORTUNE, "今日运势", BTN_MENU_FORTUNE)
      ),
      行(钮("btn_checkin_home", "返回首页", BTN_MAIN_MENU))
    ]
  };
}
function displayName$1(ctx, event, uid) {
  return 取事件昵称(event) || 取缓存昵称(ctx, uid) || "冒险者";
}
async function uploadCheckinPng(base64) {
  const result = await upload({
    buffer: Buffer.from(base64, "base64"),
    filename: `checkin_${Date.now()}.png`
  });
  if (result.code === 0 && result.data?.url) return String(result.data.url);
  throw new Error(result.msg || "图床上传失败");
}
async function renderAndSend(ctx, 目标, event, profile, isRepeat) {
  const level = levelMeta(profile.streak);
  const parts = dateParts(profile.lastYmd);
  const card = {
    nickname: displayName$1(ctx, event, profile.userId),
    avatarUrl: 取用户头像Url(ctx, event),
    dateLabel: profile.lastYmd,
    weekday: parts.weekday,
    dayNum: parts.dayNum,
    monthLabel: parts.monthLabel,
    greet: greetByHour(parts.hour),
    streak: profile.streak,
    totalDays: profile.totalDays,
    points: profile.points,
    award: profile.lastAward,
    motto: profile.motto,
    milestone: level.milestone,
    isRepeat,
    levelName: level.name,
    levelProgress: level.progress,
    hour: parts.hour
  };
  const base64 = await renderCheckinWithSharp({ card, width: 720, height: 1280 }, ctx.logger);
  if (!base64) {
    await 发消息(ctx, 目标, [
      段_md(
        [
          isRepeat ? "## 今日已打卡" : "## 签到成功",
          "",
          `连续 **${profile.streak}** 天 · 累计 **${profile.totalDays}** 天`,
          `积分 **${profile.points}**（本次 +${profile.lastAward}）`,
          "",
          `称号：**${level.name}**`,
          "",
          `_${profile.motto}_`,
          "",
          "_图片渲染失败，已改为文字版（请检查 Sharp）_"
        ].join("\n"),
        构建签到Footer键盘()
      )
    ]);
    return;
  }
  const url = await uploadCheckinPng(base64);
  const title = isRepeat ? "今日已打卡" : "签到成功";
  const debugNote = isDebugReadonly(ctx) ? ["", "_调试开关已开：本次未写入签到数据_"] : [];
  const md = [
    `# ${title}`,
    "",
    md图片行(url, { alt: title, 宽: 720, 高: 1280 }),
    "",
    `**${card.nickname}** · ${card.dateLabel} · ${card.weekday}`,
    "",
    `| 连续 | 累计 | ${isRepeat ? "今日积分" : "本次获得"} | 总积分 |`,
    "| --- | --- | --- | --- |",
    `| ${profile.streak} 天 | ${profile.totalDays} 天 | +${profile.lastAward} | ${profile.points} |`,
    "",
    `称号：**${level.name}**  ·  ${level.milestone}`,
    "",
    `> ${profile.motto}`,
    ...debugNote
  ].join("\n");
  await 发消息(ctx, 目标, [段_md(md, 构建签到Footer键盘())]);
}
async function tryHandleCheckinCommand(ctx, event, 目标, 消息) {
  const t = String(消息 || "").trim();
  if (t !== "签到" && t !== "打卡" && t !== "每日签到") return false;
  const uid = 取用户Id(event);
  if (uid === "unknown") {
    await 发消息(ctx, 目标, [段_md("无法识别用户，稍后再试。")]);
    return true;
  }
  const sharpOk = await probeSharpAvailable(8e3);
  if (!sharpOk) {
    await 发消息(ctx, 目标, [
      段_md(
        [
          "## 签到 / 打卡",
          "",
          "图片渲染依赖（Sharp）尚未安装或不可用。",
          "",
          "请打开 **GF_mk 后台** → 系统设置 → 安装 Sharp 后再试。"
        ].join("\n")
      )
    ]);
    return true;
  }
  await 发消息(ctx, 目标, [段_md("正在制作今日打卡卡…")]);
  const today = timeYmd();
  const prev = readProfile(ctx, uid);
  const already = prev?.lastYmd === today;
  let profile;
  if (already && prev) {
    profile = prev;
    await renderAndSend(ctx, 目标, event, profile, true);
    return true;
  }
  const yesterday = ymdAddDays(today, -1);
  const streak = prev && prev.lastYmd === yesterday ? (prev.streak || 0) + 1 : 1;
  const award = calcAward(streak);
  profile = {
    userId: uid,
    lastYmd: today,
    streak,
    totalDays: (prev?.totalDays || 0) + 1,
    points: (prev?.points || 0) + award,
    lastAward: award,
    motto: pickMotto(`${uid}:${today}`),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  writeProfile(ctx, profile);
  await renderAndSend(ctx, 目标, event, profile, false);
  return true;
}

const BTN_MYINFO = BTN_MENU_MYINFO;
function escapeXml$2(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function wrapText(text, maxChars, maxLines = 3) {
  const s = String(text).trim();
  if (!s) return [""];
  const lines = [];
  let cur = "";
  for (const ch of s) {
    if (cur.length >= maxChars) {
      lines.push(cur);
      cur = "";
      if (lines.length >= maxLines) break;
    }
    cur += ch;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.length ? lines : [""];
}
function fetchUrlBuffer(url, timeoutMs = 12e3) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      { timeout: timeoutMs, headers: { "User-Agent": "MKbot-MyInfoSharp/1.0" } },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrlBuffer(res.headers.location, timeoutMs).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("avatar timeout"));
    });
  });
}
async function loadAvatar(sharp, url, size) {
  if (!url) return null;
  try {
    const raw = await fetchUrlBuffer(url);
    return await sharp(raw).resize(size, size, { fit: "cover" }).png().toBuffer();
  } catch {
    return null;
  }
}
function buildSvg(width, height, card) {
  const font = "Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif";
  const nick = escapeXml$2(card.nickname || "冒险者");
  const level = escapeXml$2(card.levelName || "初来乍到");
  const uid = escapeXml$2(card.userIdShort || "—");
  const last = escapeXml$2(card.lastCheckin || "尚未签到");
  const fortune = card.fortuneDrawn ? escapeXml$2(card.fortuneName || "已抽签") : "今日未抽";
  const mottoLines = wrapText(card.motto || "今天也要元气满满", 16, 3).map(escapeXml$2);
  const mottoTspans = mottoLines.map((line, i) => `<tspan x="88" dy="${i === 0 ? 0 : 32}">${line}</tspan>`).join("");
  const checkBadge = card.checkedInToday ? "今日已签" : "今日未签";
  const checkFill = card.checkedInToday ? "#99f6e4" : "rgba(255,255,255,0.55)";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="45%" stop-color="#134e4a"/>
      <stop offset="100%" stop-color="#042f2e"/>
    </linearGradient>
    <linearGradient id="glow" x1="0.2" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.12"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.14)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.06)"/>
    </linearGradient>
    <clipPath id="av"><circle cx="152" cy="268" r="72"/></clipPath>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="620" cy="120" r="180" fill="url(#glow)"/>
  <circle cx="80" cy="980" r="220" fill="rgba(56,189,248,0.10)"/>

  <text x="72" y="92" fill="rgba(255,255,255,0.55)" font-family="${font}" font-size="22" font-weight="700" letter-spacing="4">MY PROFILE</text>
  <text x="72" y="148" fill="#f8fafc" font-family="${font}" font-size="48" font-weight="900">我的信息</text>

  <rect x="52" y="188" width="616" height="230" rx="28" fill="url(#card)" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/>
  <circle cx="152" cy="268" r="76" fill="rgba(15,23,42,0.55)" stroke="#99f6e4" stroke-width="3"/>
  <image href="avatar://local" x="80" y="196" width="144" height="144" clip-path="url(#av)" preserveAspectRatio="xMidYMid slice"/>
  <text x="252" y="250" fill="#f8fafc" font-family="${font}" font-size="34" font-weight="800">${nick}</text>
  <text x="252" y="292" fill="rgba(255,255,255,0.62)" font-family="${font}" font-size="18">ID · ${uid}</text>
  <text x="252" y="336" fill="#5eead4" font-family="${font}" font-size="22" font-weight="800">${level}</text>
  <text x="252" y="376" fill="${checkFill}" font-family="${font}" font-size="18" font-weight="700">${checkBadge}</text>

  <rect x="52" y="448" width="196" height="150" rx="22" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)"/>
  <rect x="262" y="448" width="196" height="150" rx="22" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)"/>
  <rect x="472" y="448" width="196" height="150" rx="22" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)"/>

  <text x="150" y="502" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-family="${font}" font-size="16">连续签到</text>
  <text x="150" y="558" text-anchor="middle" fill="#f8fafc" font-family="${font}" font-size="40" font-weight="900">${card.streak}</text>

  <text x="360" y="502" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-family="${font}" font-size="16">累计天数</text>
  <text x="360" y="558" text-anchor="middle" fill="#f8fafc" font-family="${font}" font-size="40" font-weight="900">${card.totalDays}</text>

  <text x="570" y="502" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-family="${font}" font-size="16">积分</text>
  <text x="570" y="558" text-anchor="middle" fill="#fde68a" font-family="${font}" font-size="40" font-weight="900">${card.points}</text>

  <rect x="52" y="628" width="616" height="210" rx="24" fill="rgba(15,23,42,0.35)" stroke="rgba(255,255,255,0.12)"/>
  <text x="88" y="678" fill="rgba(255,255,255,0.5)" font-family="${font}" font-size="16" font-weight="700">签到 / 运势 / 音乐</text>
  <text x="88" y="728" fill="#e2e8f0" font-family="${font}" font-size="22" font-weight="700">最近签到 · ${last}</text>
  <text x="88" y="774" fill="#e2e8f0" font-family="${font}" font-size="22" font-weight="700">今日运势 · ${fortune}</text>
  <text x="88" y="820" fill="#e2e8f0" font-family="${font}" font-size="22" font-weight="700">音乐收藏 · ${card.musicFavs} 首 · ${escapeXml$2(card.musicSource)}</text>

  <rect x="52" y="870" width="616" height="180" rx="24" fill="url(#card)" stroke="rgba(255,255,255,0.14)"/>
  <text x="88" y="922" fill="rgba(255,255,255,0.5)" font-family="${font}" font-size="16" font-weight="700">座右铭</text>
  <text x="88" y="972" fill="#f8fafc" font-family="${font}" font-size="24" font-weight="700">${mottoTspans}</text>

  <text x="360" y="1108" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-family="${font}" font-size="16">GF_mk · Profile</text>
</svg>`;
}
async function renderMyInfoWithSharp(opts, logger) {
  const sharp = await loadSharp();
  if (!sharp) return null;
  const width = opts.width || 720;
  const height = opts.height || 1180;
  const card = opts.card;
  const avatarSize = 144;
  try {
    let svg = buildSvg(width, height, card).replace(/<image href="avatar:\/\/local"[^/]*\/>/, "");
    const layers = [];
    const avatarBuf = await loadAvatar(sharp, String(card.avatarUrl || ""), avatarSize);
    if (avatarBuf) {
      const mask = Buffer.from(
        `<svg width="${avatarSize}" height="${avatarSize}"><circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="#fff"/></svg>`
      );
      const round = await sharp(avatarBuf).resize(avatarSize, avatarSize).composite([
        {
          input: await sharp(mask).png().toBuffer(),
          blend: "dest-in"
        }
      ]).png().toBuffer();
      layers.push({ input: round, top: 196, left: 80 });
    }
    const base = await sharp(Buffer.from(svg)).png().toBuffer();
    const out = layers.length ? await sharp(base).composite(layers).png().toBuffer() : base;
    return out.toString("base64");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger?.error?.("[Sharp渲染] 我的信息卡渲染失败:", msg);
    return null;
  }
}
function 构建我的信息Footer键盘() {
  return {
    rows: [
      行(
        钮(BTN_MENU_CHECKIN, "去签到", BTN_MENU_CHECKIN),
        钮(BTN_MENU_FORTUNE, "今日运势", BTN_MENU_FORTUNE)
      ),
      行(钮("btn_myinfo_home", "返回首页", BTN_MAIN_MENU))
    ]
  };
}
function shortId(id) {
  const s = String(id);
  if (s.length <= 14) return s || "—";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
function displayName(ctx, event, uid) {
  return 取事件昵称(event) || 取缓存昵称(ctx, uid) || "冒险者";
}
function todayFortune(ctx, uid) {
  const today = timeYmd();
  const raw = readB(ctx, `今日运势/${today}.json`, uid, "");
  let rec = null;
  if (raw && typeof raw === "object") rec = raw;
  else if (raw) {
    try {
      rec = JSON.parse(String(raw));
    } catch {
      rec = null;
    }
  }
  if (!rec || rec.文本 == null) return { drawn: false, name: "" };
  let entries = [];
  try {
    const v = JSON.parse(readPluginOrUserText(ctx, "默认资源/text/运势.json") || "[]");
    entries = Array.isArray(v) ? v : [];
  } catch {
    entries = [];
  }
  const idx = Number(rec.文本) || 0;
  const name = String(entries[idx]?.Sorte || "已抽签");
  return { drawn: true, name };
}
async function uploadPng(base64) {
  const result = await upload({
    buffer: Buffer.from(base64, "base64"),
    filename: `myinfo_${Date.now()}.png`
  });
  if (result.code === 0 && result.data?.url) return String(result.data.url);
  throw new Error(result.msg || "图床上传失败");
}
function buildTextMd(card, imageUrl) {
  const lines = ["# 我的信息", ""];
  if (imageUrl) {
    lines.push(md图片行(imageUrl, { alt: "我的信息", 宽: 720, 高: 1180 }), "");
  }
  lines.push(
    `**${card.nickname}** · \`${card.userIdShort}\``,
    "",
    `称号：**${card.levelName}** · ${card.checkedInToday ? "今日已签" : "今日未签"}`,
    "",
    "| 连续 | 累计 | 积分 |",
    "| --- | --- | --- |",
    `| ${card.streak} 天 | ${card.totalDays} 天 | ${card.points} |`,
    "",
    `- 最近签到：${card.lastCheckin}`,
    `- 今日运势：${card.fortuneDrawn ? card.fortuneName : "尚未抽取"}`,
    `- 音乐：收藏 ${card.musicFavs} 首 · 音源 ${card.musicSource}`,
    "",
    `> ${card.motto}`
  );
  return lines.join("\n");
}
async function tryHandleMyInfoCommand(ctx, event, 目标, 消息) {
  const t = String(消息 || "").trim();
  if (t !== "我的信息" && t !== "个人信息" && t !== "我的档案") return false;
  const uid = 取用户Id(event);
  if (uid === "unknown") {
    await 发消息(ctx, 目标, [段_md("无法识别用户，稍后再试。")]);
    return true;
  }
  const profile = 取签到档案(ctx, uid);
  const today = timeYmd();
  const fortune = todayFortune(ctx, uid);
  const card = {
    nickname: displayName(ctx, event, uid),
    avatarUrl: 取用户头像Url(ctx, event),
    userIdShort: shortId(uid),
    levelName: 取签到称号(profile?.streak || 0),
    streak: profile?.streak || 0,
    totalDays: profile?.totalDays || 0,
    points: profile?.points || 0,
    lastCheckin: profile?.lastYmd || "尚未签到",
    checkedInToday: profile?.lastYmd === today,
    fortuneDrawn: fortune.drawn,
    fortuneName: fortune.name,
    musicFavs: 取音乐收藏数(ctx, uid),
    musicSource: 取音乐默认音源(ctx, uid),
    motto: profile?.motto || "今天也要元气满满"
  };
  const sharpOk = await probeSharpAvailable(8e3);
  if (sharpOk) {
    await 发消息(ctx, 目标, [段_md("正在整理你的主页…")]);
    const base64 = await renderMyInfoWithSharp({ card, width: 720, height: 1180 }, ctx.logger);
    if (base64) {
      try {
        const url = await uploadPng(base64);
        const note = isDebugReadonly(ctx) ? "\n\n_调试开关已开：本页为只读展示_" : "";
        await 发消息(ctx, 目标, [
          段_md(buildTextMd(card, url) + note, 构建我的信息Footer键盘())
        ]);
        return true;
      } catch (e) {
        ctx.logger?.warn?.("[GF_mk] 我的信息图床失败，改文字版:", e);
      }
    }
  }
  await 发消息(ctx, 目标, [段_md(buildTextMd(card), 构建我的信息Footer键盘())]);
  return true;
}

function 含艾特标记(rawContent) {
  return /<@!?[A-Za-z0-9_]+>/.test(String(rawContent ?? ""));
}
function 是插件指令文本(消息) {
  const t = String(消息 || "").trim();
  if (!t) return false;
  if (t === "菜单" || t === "主菜单" || t === "/mk" || t === "/MK") return true;
  if (t === "签到" || t === "打卡" || t === "每日签到") return true;
  if (t === "今日运势") return true;
  if (t === "我的信息" || t === "个人信息" || t === "我的档案") return true;
  if (t === "音乐功能" || t === "音乐系统" || t === "音乐菜单") return true;
  if (t === "我的收藏" || t === "个人歌单") return true;
  if (t === "清空个人收藏歌曲" || t === "清空个人收藏音乐") return true;
  if (t === "你好") return true;
  if (t === "测试本地图片" || t === "测试本地多图片" || t === "测试网络多图片" || t === "测试本地图片文字" || t === "测试网络图片文字" || t === "测试md" || t === "测试markdown" || t === "测试按钮") {
    return true;
  }
  if (/https?:\/\/b23\.tv\/[a-zA-Z0-9]+/i.test(t)) return true;
  if (/https?:\/\/(?:www\.)?bilibili\.com\/video\/BV[a-zA-Z0-9]{10}/i.test(t)) return true;
  if (/^(酷我|汽水|网易云|QQ|)点歌[\s\S]+$/.test(t)) return true;
  if (/^(链接|卡片|语音|)选歌[0-9]+$/.test(t)) return true;
  if (/^(收藏音乐|收藏歌曲)[0-9]+$/.test(t)) return true;
  if (/^取消收藏[0-9]+(-|_|\.|)([0-9]+|)$/.test(t)) return true;
  if (/^(链接|卡片|语音|)播放收藏[0-9]+$/.test(t)) return true;
  return false;
}
function 判定计入排行(opts) {
  if (opts.scope === "private") return true;
  const et = String(opts.eventType || "");
  if (et === "INTERACTION_CREATE") return true;
  if (et === "GROUP_AT_MESSAGE_CREATE") return true;
  if (含艾特标记(String(opts.rawContent ?? ""))) return true;
  const text = String(opts.content ?? "").trim() || 提取纯文本(String(opts.rawContent ?? ""));
  return 是插件指令文本(text);
}
function 规范化展示内容(content) {
  let s = String(content ?? "");
  if (!s) return "";
  s = s.replace(
    /<\s*face[^>\n]*faceId\s*=\s*["']?(\d+)["']?[^>\n]*>?/gi,
    (_m, id) => `[表情${id}]`
  );
  s = s.replace(/<\s*faceType\s*=[^>\n]*>?/gi, "[表情]");
  s = s.replace(/faceType\s*=\s*\d+\s*,\s*faceId\s*=\s*["']?\d+["']?[^<\n]*/gi, "[表情]");
  s = s.replace(/<\s*emoji[^>\n]*>?/gi, "[表情]");
  s = s.replace(/<\s*img\b[^>\n]*>?/gi, "[图片]");
  s = s.replace(/<\s*video\b[^>\n]*>?/gi, "[视频]");
  s = s.replace(/<\s*file\b[^>\n]*>?/gi, "[文件]");
  s = s.replace(/<[^>\n]{1,120}>/g, (m) => {
    if (/^<@!?[A-Za-z0-9_]+>$/i.test(m.trim())) return m;
    return "";
  });
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function todayYmd$1(d = /* @__PURE__ */ new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function resolveGfLogRoot(ctx) {
  const root = String(ctx.frameworkEnv?.projectRoot || "").trim();
  if (root) return path.join(root, "log", "gf");
  const plugin = String(ctx.pluginPath || "").trim();
  if (plugin) return path.resolve(plugin, "..", "..", "log", "gf");
  return path.join(process.cwd(), "log", "gf");
}
function dayFile(root, scope, ymd) {
  return path.join(root, scope, `${ymd}.jsonl`);
}
function ensureParent$1(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function loadNicknameCache(root) {
  const f = path.join(root, "nicknames.json");
  try {
    if (!fs.existsSync(f)) return {};
    const o = JSON.parse(fs.readFileSync(f, "utf8"));
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}
function saveNicknameCache(root, cache) {
  try {
    ensureParent$1(path.join(root, "nicknames.json"));
    fs.writeFileSync(path.join(root, "nicknames.json"), `${JSON.stringify(cache, null, 2)}
`, "utf8");
  } catch {
  }
}
function readJsonlFile(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  if (!text.trim()) return [];
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      const o = JSON.parse(s);
      if (o && typeof o === "object" && o.ts) out.push(o);
    } catch {
    }
  }
  return out;
}
function resolveBotMeta(ctx) {
  const root = String(ctx.frameworkEnv?.projectRoot || "").trim();
  const connId = String(ctx.connectionId || ctx.frameworkEnv?.connectionId || "").trim();
  const empty = { name: "GF Bot", avatar: "", appId: "", running: false };
  if (!root) return empty;
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(root, "data", "connections.json"), "utf8")
    );
    const list = Array.isArray(raw.connections) ? raw.connections : [];
    const picked = (connId ? list.find((c) => c.id === connId) : void 0) || list.find((c) => (c.type ?? "") === "qq_official" && c.enable !== false) || list.find((c) => (c.type ?? "") === "qq_official");
    if (!picked) return empty;
    const botProfile = picked.botProfile;
    return {
      name: String(botProfile?.username || picked.name || "GF Bot"),
      avatar: String(botProfile?.avatar || ""),
      appId: String(picked.appId || ""),
      running: picked.enable !== false
    };
  } catch {
    return empty;
  }
}
function groupIdOf(event) {
  return String(event.group_openid || event.group_id || "").trim();
}
function classifyMessageScope(eventType) {
  const t = String(eventType || "");
  if (t === "GROUP_AT_MESSAGE_CREATE" || t === "GROUP_MESSAGE_CREATE") {
    return "group";
  }
  if (t === "C2C_MESSAGE_CREATE") return "private";
  return null;
}
function writeLogEntry(ctx, entry) {
  const root = resolveGfLogRoot(ctx);
  const file = dayFile(root, entry.scope, todayYmd$1(new Date(entry.time || Date.now())));
  try {
    ensureParent$1(file);
    fs.appendFileSync(file, `${JSON.stringify(entry)}
`, "utf8");
    if (entry.userId && entry.userId !== "unknown" && entry.userName) {
      const cache = loadNicknameCache(root);
      if (cache[entry.userId] !== entry.userName) {
        cache[entry.userId] = entry.userName;
        saveNicknameCache(root, cache);
      }
    }
  } catch (e) {
    ctx.logger?.warn?.("[GF_mk] 写入消息日志失败:", e);
  }
}
function resolveDisplayName(ctx, event, userId) {
  const fromEvent = 取事件昵称(event);
  if (fromEvent) return fromEvent;
  return 取缓存昵称(ctx, userId);
}
function resolveEntryRankable(e) {
  if (typeof e.rankable === "boolean") return e.rankable;
  return 判定计入排行({
    scope: e.scope,
    eventType: e.eventType,
    content: e.content,
    rawContent: ""
  });
}
function collectImageAttachments(event) {
  const e = event;
  const d = e.d && typeof e.d === "object" ? e.d : void 0;
  const raw = e.attachments ?? d?.attachments;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item;
    const url = String(a.url || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const contentType = String(a.content_type || a.contentType || "").trim().toLowerCase();
    const filename = String(a.filename || a.file_name || "").trim();
    const isImage = contentType.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)(?:$|\?)/i.test(filename) || /\.(jpe?g|png|gif|webp|bmp)(?:$|\?)/i.test(url);
    if (!isImage) continue;
    out.push({
      url,
      content_type: contentType,
      filename,
      width: Number(a.width) || 0,
      height: Number(a.height) || 0
    });
  }
  return out;
}
function attachmentFilename(att, index) {
  const byCt = {
    "image/png": "png",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/bmp": "bmp"
  };
  const ext = byCt[att.content_type] || "jpg";
  const base = (att.filename || `img_${index + 1}`).replace(/\.[^.]+$/, "") || `img_${index + 1}`;
  return `${base}.${ext}`;
}
function mdImageLine(url, _width, _height) {
  return `![图片](${url})`;
}
async function rehostInboundImages(ctx, event) {
  const list = collectImageAttachments(event);
  if (!list.length) return [];
  const lines = [];
  for (let i = 0; i < list.length; i += 1) {
    const att = list[i];
    try {
      const result = await upload({
        url: att.url,
        filename: attachmentFilename(att, i)
      });
      if (result.code === 0 && result.data?.url) {
        lines.push(mdImageLine(result.data.url, att.width, att.height));
        ctx.logger?.info?.(
          `[GF_mk] 入站图片已转存图床 source=${result.data.source} ${result.data.url}`
        );
      } else {
        lines.push(mdImageLine(att.url, att.width, att.height));
        ctx.logger?.warn?.(`[GF_mk] 入站图片转存失败，保留原链: ${result.msg}`);
      }
    } catch (error) {
      lines.push(mdImageLine(att.url, att.width, att.height));
      ctx.logger?.warn?.("[GF_mk] 入站图片转存异常，保留原链:", error);
    }
  }
  return lines;
}
async function recordInboundMessage(ctx, event) {
  const eventType = String(event.t || "");
  const scope = classifyMessageScope(eventType);
  if (!scope) return;
  同步事件昵称(ctx, event);
  const userId = 取用户Id(event);
  const rawContent = String(event.content ?? "");
  let text = 规范化展示内容(提取纯文本(rawContent));
  const imageLines = await rehostInboundImages(ctx, event);
  if (imageLines.length) {
    text = text.replace(/\[表情\d*\]/g, "").replace(/\s+/g, " ").trim();
  }
  const content = [text, ...imageLines].filter(Boolean).join("\n");
  const now = /* @__PURE__ */ new Date();
  writeLogEntry(ctx, {
    ts: now.toISOString(),
    time: now.getTime(),
    scope,
    eventType,
    userId,
    userName: resolveDisplayName(ctx, event, userId),
    groupId: scope === "group" ? groupIdOf(event) : "",
    content: content || "[空消息]",
    msgId: String(event.id || "").trim(),
    rankable: 判定计入排行({ scope, eventType, rawContent, content }),
    direction: "in"
  });
}
function recordInteractionMessage(ctx, event, buttonData) {
  同步事件昵称(ctx, event);
  const e = event;
  const scene = String(e.scene || "").toLowerCase();
  const chatType = Number(e.chat_type);
  let scope = "private";
  if (chatType === 1 || scene === "group" || groupIdOf(event)) scope = "group";
  if (chatType === 2 || scene === "c2c") scope = "private";
  const userId = 取用户Id(event);
  const now = /* @__PURE__ */ new Date();
  writeLogEntry(ctx, {
    ts: now.toISOString(),
    time: now.getTime(),
    scope,
    eventType: "INTERACTION_CREATE",
    userId,
    userName: resolveDisplayName(ctx, event, userId),
    groupId: scope === "group" ? groupIdOf(event) : "",
    content: `[按钮] ${String(buttonData || "").trim()}`,
    msgId: String(event.id || "").trim(),
    rankable: true,
    direction: "in"
  });
}
function extractApiMsgId(result) {
  if (!result || typeof result !== "object") return "";
  const o = result;
  const data = o.data && typeof o.data === "object" ? o.data : o;
  return String(data.id || data.msg_id || data.message_id || o.id || o.msg_id || "").trim();
}
function markMessageRecalled(ctx, msgId, opts) {
  const id = String(msgId || "").trim();
  if (!id) return false;
  const days = Math.min(30, Math.max(1, Number(opts?.days) || 7));
  const dates = listLogDates(ctx).slice(0, days);
  if (!dates.length) dates.push(todayYmd$1());
  const root = resolveGfLogRoot(ctx);
  let changed = false;
  for (const ymd of dates) {
    for (const scope of ["group", "private"]) {
      const file = dayFile(root, scope, ymd);
      if (!fs.existsSync(file)) continue;
      const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
      let fileChanged = false;
      const next = lines.map((line) => {
        if (!line.trim()) return line;
        try {
          const row = JSON.parse(line);
          if (String(row.msgId || "").trim() !== id) return line;
          if (String(row.content || "").includes("[已撤回]")) return line;
          row.content = `[已撤回] ${String(row.content || "").trim()}`.trim();
          fileChanged = true;
          changed = true;
          return JSON.stringify(row);
        } catch {
          return line;
        }
      });
      if (fileChanged) {
        fs.writeFileSync(file, `${next.filter((l) => l.length).join("\n")}
`, "utf-8");
      }
    }
  }
  return changed;
}
function recordOutboundMessage(ctx, 发送目标, content, apiResult) {
  const bot = resolveBotMeta(ctx);
  const text = 规范化展示内容(String(content || "").trim());
  if (!text) return;
  const isGroup = 发送目标.scope === "group";
  const groupId = isGroup ? String(发送目标.group_openid || "").trim() : "";
  const peerId = isGroup ? "" : String(发送目标.user_openid || "").trim();
  if (isGroup && !groupId) return;
  if (!isGroup && !peerId) return;
  const now = /* @__PURE__ */ new Date();
  writeLogEntry(ctx, {
    ts: now.toISOString(),
    time: now.getTime(),
    scope: isGroup ? "group" : "private",
    eventType: "BOT_MESSAGE_CREATE",
    userId: isGroup ? "bot" : peerId,
    userName: bot.name || "Bot",
    groupId,
    content: text,
    msgId: extractApiMsgId(apiResult),
    rankable: false,
    direction: "out"
  });
}
function listLogDates(ctx) {
  const root = resolveGfLogRoot(ctx);
  const set = /* @__PURE__ */ new Set();
  for (const scope of ["group", "private"]) {
    const dir = path.join(root, scope);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const m = name.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
      if (m) set.add(m[1]);
    }
  }
  return [...set].sort().reverse();
}
function loadDayEntries(ctx, ymd, scope = "all") {
  const root = resolveGfLogRoot(ctx);
  const scopes = scope === "all" ? ["group", "private"] : [scope];
  const list = [];
  for (const s of scopes) {
    list.push(...readJsonlFile(dayFile(root, s, ymd)));
  }
  list.sort((a, b) => (a.time || 0) - (b.time || 0));
  return list;
}
function aggregateUsageMaps(entries) {
  const groupMap = /* @__PURE__ */ new Map();
  const userMap = /* @__PURE__ */ new Map();
  const nick = {};
  for (const e of entries) {
    if (!resolveEntryRankable(e)) continue;
    if (e.direction === "out" || e.eventType === "BOT_MESSAGE_CREATE") continue;
    if (e.scope === "group" && e.groupId) {
      groupMap.set(e.groupId, (groupMap.get(e.groupId) || 0) + 1);
    }
    if (e.userId && e.userId !== "unknown" && e.userId !== "bot") {
      userMap.set(e.userId, (userMap.get(e.userId) || 0) + 1);
      if (e.userName) nick[e.userId] = e.userName;
    }
  }
  return { groupMap, userMap, nick };
}
function qqAppAvatarUrl$1(appId, openId, size = 100) {
  const a = String(appId || "").trim();
  const id = String(openId || "").trim();
  if (!a || !id) return "";
  return `https://q.qlogo.cn/qqapp/${a}/${id}/${size}`;
}
function toUserRankRows(ctx, userMap, nick, appId) {
  return [...userMap.entries()].map(([id, count]) => {
    const name = 取缓存昵称(ctx, id) || nick[id] || "";
    return { id, name, avatar: qqAppAvatarUrl$1(appId, id, 100), count };
  }).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}
function toGroupRankRows(groupMap, appId) {
  return [...groupMap.entries()].map(([id, count]) => ({
    id,
    name: "",
    avatar: qqAppAvatarUrl$1(appId, id, 100),
    count
  })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}
function buildDashboard(ctx, ymd = todayYmd$1()) {
  const entries = loadDayEntries(ctx, ymd, "all");
  const bot = resolveBotMeta(ctx);
  const root = resolveGfLogRoot(ctx);
  const nickCache = loadNicknameCache(root);
  const hourly = Array.from({ length: 24 }, () => 0);
  const groups = /* @__PURE__ */ new Set();
  const users = /* @__PURE__ */ new Set();
  let groupMessages = 0;
  let privateMessages = 0;
  for (const e of entries) {
    if (e.direction === "out" || e.eventType === "BOT_MESSAGE_CREATE") continue;
    const d = new Date(e.time || e.ts);
    if (!Number.isNaN(d.getTime())) {
      hourly[d.getHours()] += 1;
    }
    if (e.scope === "group") {
      groupMessages += 1;
      if (e.groupId) groups.add(e.groupId);
    } else {
      privateMessages += 1;
    }
    if (e.userId && e.userId !== "unknown" && e.userId !== "bot") {
      users.add(e.userId);
      if (e.userName) nickCache[e.userId] = e.userName;
    }
  }
  const { groupMap, userMap, nick } = aggregateUsageMaps(entries);
  Object.assign(nickCache, nick);
  const groupTop = toGroupRankRows(groupMap, bot.appId).slice(0, 5);
  const userTop = toUserRankRows(ctx, userMap, nickCache, bot.appId).slice(0, 5);
  return {
    date: ymd,
    bot,
    groupMessages,
    privateMessages,
    groupCount: groups.size,
    userCount: users.size,
    hourly,
    groupTop,
    userTop
  };
}
function buildRankings(ctx, ymd = todayYmd$1()) {
  const entries = loadDayEntries(ctx, ymd, "all");
  const bot = resolveBotMeta(ctx);
  const root = resolveGfLogRoot(ctx);
  const nickCache = loadNicknameCache(root);
  const { groupMap, userMap, nick } = aggregateUsageMaps(entries);
  Object.assign(nickCache, nick);
  return {
    date: ymd,
    groups: toGroupRankRows(groupMap, bot.appId),
    users: toUserRankRows(ctx, userMap, nickCache, bot.appId)
  };
}
function queryMergedLogs(ctx, opts) {
  const date = opts.date || todayYmd$1();
  const scope = opts.scope || "all";
  let list = loadDayEntries(ctx, date, scope);
  const q = String(opts.q || "").trim().toLowerCase();
  if (q) {
    list = list.filter((e) => {
      const blob = `${e.content}
${e.userName}
${e.userName}
${e.groupId}
${e.eventType}`.toLowerCase();
      return blob.includes(q);
    });
  }
  const order = opts.order === "asc" ? "asc" : "desc";
  if (order === "desc") list = [...list].reverse();
  const total = list.length;
  const offset = Math.max(0, Number(opts.offset) || 0);
  const limit = Math.min(500, Math.max(1, Number(opts.limit) || 100));
  return { date, total, list: list.slice(offset, offset + limit) };
}
function resolvePluginDataFile$1(ctx, rel) {
  const pluginDir = String(ctx.pluginPath || "").trim();
  return path.resolve(pluginDir, "data", rel);
}
function resolveUserDataFile$1(ctx, rel) {
  const dataDir = String(ctx.dataPath || "").trim();
  if (!dataDir) return resolvePluginDataFile$1(ctx, rel);
  return path.resolve(dataDir, rel);
}
function readJsonFile$1(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}
function writeJsonFile$1(filePath, data) {
  ensureParent$1(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}
`, "utf-8");
}
function pinFile(ctx) {
  return resolveUserDataFile$1(ctx, "chat-pins.json");
}
function chatKey(scope, id) {
  return `${scope}:${String(id || "").trim()}`;
}
function readChatPins(ctx) {
  const raw = readJsonFile$1(pinFile(ctx), { pins: [] });
  return Array.isArray(raw.pins) ? raw.pins.map(String).filter(Boolean) : [];
}
function writeChatPins(ctx, pins) {
  const next = [...new Set(pins.map(String).filter(Boolean))];
  writeJsonFile$1(pinFile(ctx), { pins: next });
  return next;
}
function toggleChatPin(ctx, key) {
  const k = String(key || "").trim();
  if (!k) return { pins: readChatPins(ctx), pinned: false };
  const pins = readChatPins(ctx);
  const i = pins.indexOf(k);
  if (i >= 0) pins.splice(i, 1);
  else pins.unshift(k);
  const next = writeChatPins(ctx, pins);
  return { pins: next, pinned: next.includes(k) };
}
function resolveAppId$1(ctx) {
  const root = String(ctx.frameworkEnv?.projectRoot || "").trim();
  if (!root) return "";
  const connId = String(ctx.connectionId || ctx.frameworkEnv?.connectionId || "").trim();
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(root, "data", "connections.json"), "utf8")
    );
    const list = Array.isArray(raw.connections) ? raw.connections : [];
    const picked = (connId ? list.find((c) => c.id === connId) : void 0) || list.find((c) => (c.type ?? "") === "qq_official" && c.enable !== false) || list.find((c) => (c.type ?? "") === "qq_official");
    return String(picked?.appId || "").trim();
  } catch {
    return "";
  }
}
function sessionPeer(e) {
  if (e.scope === "group") {
    const id2 = String(e.groupId || "").trim();
    if (!id2) return null;
    return { scope: "group", id: id2 };
  }
  const id = String(e.userId || "").trim();
  if (!id || id === "unknown") return null;
  return { scope: "private", id };
}
function previewContent(s) {
  let t = 规范化展示内容(String(s || ""));
  const hasImg = /!\[[^\]]*\]\(https?:\/\/[^)\s]+\)/i.test(t);
  t = t.replace(/!\[[^\]]*\]\(https?:\/\/[^)\s]+\)/gi, "[图片]").replace(/\s+/g, " ").trim();
  if (!t && hasImg) t = "[图片]";
  if (t.length <= 48) return t;
  return `${t.slice(0, 48)}…`;
}
function resolveBotProfile(ctx) {
  const appId = resolveAppId$1(ctx);
  const root = String(ctx.frameworkEnv?.projectRoot || "").trim();
  const empty = { name: "Bot", avatar: "", appId };
  if (!root) return empty;
  const connId = String(ctx.connectionId || ctx.frameworkEnv?.connectionId || "").trim();
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(root, "data", "connections.json"), "utf8")
    );
    const list = Array.isArray(raw.connections) ? raw.connections : [];
    const picked = (connId ? list.find((c) => c.id === connId) : void 0) || list.find((c) => (c.type ?? "") === "qq_official" && c.enable !== false) || list.find((c) => (c.type ?? "") === "qq_official");
    if (!picked) return empty;
    const botProfile = picked.botProfile;
    return {
      name: String(botProfile?.username || picked.name || "Bot"),
      avatar: String(botProfile?.avatar || ""),
      appId: String(picked.appId || appId)
    };
  } catch {
    return empty;
  }
}
function isOutbound(e) {
  return e.direction === "out" || e.eventType === "BOT_MESSAGE_CREATE";
}
function listChatSessions(ctx, opts) {
  const days = Math.min(90, Math.max(1, Number(opts?.days) || 30));
  const dates = listLogDates(ctx).slice(0, days);
  if (!dates.length) dates.push(todayYmd$1());
  const appId = resolveAppId$1(ctx);
  const pins = new Set(readChatPins(ctx));
  const map = /* @__PURE__ */ new Map();
  for (const ymd of dates) {
    const entries = loadDayEntries(ctx, ymd, "all");
    for (const e of entries) {
      const peer = sessionPeer(e);
      if (!peer) continue;
      const key = chatKey(peer.scope, peer.id);
      const cur = map.get(key);
      if (!cur) {
        map.set(key, {
          scope: peer.scope,
          id: peer.id,
          last: e,
          count: 1,
          titleHint: peer.scope === "private" ? e.userName || "" : ""
        });
      } else {
        cur.count += 1;
        if ((e.time || 0) >= (cur.last.time || 0)) cur.last = e;
        if (peer.scope === "private" && e.userName) cur.titleHint = e.userName;
      }
    }
  }
  const q = String(opts?.q || "").trim().toLowerCase();
  let sessions = [...map.entries()].map(([key, v]) => {
    const title = v.scope === "private" ? 取缓存昵称(ctx, v.id) || v.titleHint || v.id : v.id;
    return {
      key,
      scope: v.scope,
      id: v.id,
      title,
      avatar: qqAppAvatarUrl$1(appId, v.id, 100),
      lastContent: previewContent(v.last.content),
      lastTime: Number(v.last.time) || 0,
      lastTs: String(v.last.ts || ""),
      msgCount: v.count,
      pinned: pins.has(key)
    };
  });
  if (q) {
    sessions = sessions.filter(
      (s) => `${s.title}
${s.id}
${s.lastContent}
${s.scope}`.toLowerCase().includes(q)
    );
  }
  sessions.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.lastTime || 0) - (a.lastTime || 0);
  });
  return { sessions, botAppId: appId };
}
function listChatMessages(ctx, scope, id, opts) {
  const peerId = String(id || "").trim();
  const days = Math.min(90, Math.max(1, Number(opts?.days) || 30));
  const dates = listLogDates(ctx).slice(0, days);
  if (!dates.length) dates.push(todayYmd$1());
  const appId = resolveAppId$1(ctx);
  const bot = resolveBotProfile(ctx);
  const pins = new Set(readChatPins(ctx));
  const all = [];
  for (const ymd of dates) {
    for (const e of loadDayEntries(ctx, ymd, scope)) {
      const peer2 = sessionPeer(e);
      if (!peer2 || peer2.scope !== scope || peer2.id !== peerId) continue;
      all.push(e);
    }
  }
  all.sort((a, b) => (a.time || 0) - (b.time || 0));
  const total = all.length;
  const offset = Math.max(0, Number(opts?.offset) || 0);
  const limit = Math.min(300, Math.max(1, Number(opts?.limit) || 80));
  const start = Math.max(0, total - offset - limit);
  const end = Math.max(0, total - offset);
  const slice = all.slice(start, end);
  const list = slice.map((e) => {
    const out = isOutbound(e);
    return {
      ts: e.ts,
      time: e.time,
      scope: e.scope,
      userId: e.userId,
      userName: out ? bot.name || e.userName || "Bot" : e.userName || 取缓存昵称(ctx, e.userId) || e.userId,
      userAvatar: out ? bot.avatar || "" : qqAppAvatarUrl$1(appId, e.userId === "bot" ? "" : e.userId, 100),
      groupId: e.groupId,
      content: 规范化展示内容(e.content),
      eventType: e.eventType,
      msgId: e.msgId,
      direction: out ? "out" : "in"
    };
  });
  const last = all[all.length - 1];
  const peer = peerId ? {
    key: chatKey(scope, peerId),
    scope,
    id: peerId,
    title: scope === "private" ? 取缓存昵称(ctx, peerId) || (last && !isOutbound(last) ? last.userName : "") || peerId : peerId,
    avatar: qqAppAvatarUrl$1(appId, peerId, 100),
    lastContent: previewContent(last?.content || ""),
    lastTime: Number(last?.time) || 0,
    lastTs: String(last?.ts || ""),
    msgCount: total,
    pinned: pins.has(chatKey(scope, peerId))
  } : null;
  return { total, list, peer };
}

const messageLog = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
    __proto__: null,
    buildDashboard,
    buildRankings,
    chatKey,
    classifyMessageScope,
    listChatMessages,
    listChatSessions,
    listLogDates,
    loadDayEntries,
    markMessageRecalled,
    queryMergedLogs,
    readChatPins,
    recordInboundMessage,
    recordInteractionMessage,
    recordOutboundMessage,
    resolveEntryRankable,
    resolveGfLogRoot,
    todayYmd: todayYmd$1,
    toggleChatPin
}, Symbol.toStringTag, { value: 'Module' }));

const GF_ROUTE_PREFIX = "/gfmk";
function wrapPath(p) {
  if (!p) return GF_ROUTE_PREFIX;
  return p.startsWith("/") ? `${GF_ROUTE_PREFIX}${p}` : `${GF_ROUTE_PREFIX}/${p}`;
}
function sharpDepsPaths(ctx) {
  return {
    dataDir: String(ctx.dataPath || "").trim(),
    pluginDir: String(ctx.pluginPath || "").trim()
  };
}
function resolvePluginDataFile(ctx, rel) {
  const pluginDir = String(ctx.pluginPath || "").trim();
  return path.resolve(pluginDir, "data", rel);
}
function resolveUserDataFile(ctx, rel) {
  const dataDir = String(ctx.dataPath || "").trim();
  if (!dataDir) return resolvePluginDataFile(ctx, rel);
  return path.resolve(dataDir, rel);
}
function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}
function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}
`, "utf-8");
}
function readConfig(ctx) {
  const p = String(ctx.configPath || "").trim() || resolveUserDataFile(ctx, "config.json");
  return readJsonFile(p, {});
}
function writeConfig(ctx, patch) {
  const p = String(ctx.configPath || "").trim() || resolveUserDataFile(ctx, "config.json");
  const next = { ...readConfig(ctx), ...patch };
  writeJsonFile(p, next);
  return next;
}
function registerGfWebui(ctx) {
  const base = ctx.router;
  if (!base?.get || !base?.post) {
    ctx.logger?.warn?.("[GF_mk] 当前主机未提供 router，跳过后台注册");
    return;
  }
  configureSharpRuntimePaths(sharpDepsPaths(ctx));
  if (base.static) {
    base.static(wrapPath("/static"), "webui");
  }
  base.get(wrapPath("/dashboard"), (_req, res) => {
    try {
      const date = String(_req.query?.date || todayYmd$1()).trim() || todayYmd$1();
      const stats = buildDashboard(ctx, date);
      res.json({ code: 0, data: stats });
    } catch (e) {
      ctx.logger?.error?.("[GF_mk] dashboard 失败:", e);
      res.status(500).json({ code: -1, message: "仪表盘统计失败" });
    }
  });
  base.get(wrapPath("/rankings"), (_req, res) => {
    try {
      const date = String(_req.query?.date || todayYmd$1()).trim() || todayYmd$1();
      const data = buildRankings(ctx, date);
      res.json({ code: 0, data });
    } catch (e) {
      ctx.logger?.error?.("[GF_mk] rankings 失败:", e);
      res.status(500).json({ code: -1, message: "排行统计失败" });
    }
  });
  base.get(wrapPath("/chats"), (req, res) => {
    try {
      const data = listChatSessions(ctx, {
        days: Number(req.query?.days) || 30,
        q: String(req.query?.q || "").trim() || void 0
      });
      res.json({ code: 0, data });
    } catch (e) {
      ctx.logger?.error?.("[GF_mk] chats 失败:", e);
      res.status(500).json({ code: -1, message: "会话列表失败" });
    }
  });
  base.get(wrapPath("/chats/messages"), (req, res) => {
    try {
      const scopeRaw = String(req.query?.scope || "").trim();
      const scope = scopeRaw === "group" || scopeRaw === "private" ? scopeRaw : "";
      const id = String(req.query?.id || "").trim();
      if (!scope || !id) {
        res.status(400).json({ code: -1, message: "缺少 scope / id" });
        return;
      }
      const data = listChatMessages(ctx, scope, id, {
        days: Number(req.query?.days) || 30,
        limit: Number(req.query?.limit) || 100,
        offset: Number(req.query?.offset) || 0
      });
      res.json({ code: 0, data });
    } catch (e) {
      ctx.logger?.error?.("[GF_mk] chats/messages 失败:", e);
      res.status(500).json({ code: -1, message: "会话消息失败" });
    }
  });
  base.get(wrapPath("/chats/pins"), (_req, res) => {
    try {
      res.json({ code: 0, data: { pins: readChatPins(ctx) } });
    } catch {
      res.status(500).json({ code: -1, message: "读取置顶失败" });
    }
  });
  base.post(wrapPath("/chats/pin"), (req, res) => {
    try {
      const body = req.body || {};
      let key = String(body.key || "").trim();
      if (!key && body.scope && body.id) {
        const scope = body.scope === "group" ? "group" : body.scope === "private" ? "private" : "";
        if (scope) key = chatKey(scope, String(body.id));
      }
      if (!key) {
        res.status(400).json({ code: -1, message: "缺少 key" });
        return;
      }
      const data = toggleChatPin(ctx, key);
      res.json({ code: 0, data });
    } catch (e) {
      ctx.logger?.error?.("[GF_mk] chats/pin 失败:", e);
      res.status(500).json({ code: -1, message: "置顶失败" });
    }
  });
  base.post(wrapPath("/chats/send"), async (req, res) => {
    try {
      const body = req.body || {};
      const scopeRaw = String(body.scope || "").trim();
      const id = String(body.id || "").trim();
      const content = String(body.content || "").trim();
      const asMd = String(body.format || "").trim().toLowerCase() === "md";
      if (!id || !content) {
        res.status(400).json({ code: -1, message: "缺少 id / content" });
        return;
      }
      if (scopeRaw !== "group" && scopeRaw !== "private") {
        res.status(400).json({ code: -1, message: "scope 须为 group / private" });
        return;
      }
      const target = scopeRaw === "group" ? { scope: "group", group_openid: id } : { scope: "c2c", user_openid: id };
      // ★ 修复：网页控制台发送的消息传入 { 纯净模式: true }，不添加艾特和耗时
      const result = await 发消息(ctx, target, [asMd ? 段_md(content) : 段_文本(content)], { 纯净模式: true });
      res.json({ code: 0, data: { ok: true, result, format: asMd ? "md" : "text" }, message: "已发送" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.logger?.error?.("[GF_mk] chats/send 失败:", e);
      res.status(500).json({ code: -1, message: msg || "发送失败" });
    }
  });
  base.post(wrapPath("/chats/recall"), async (req, res) => {
    try {
      const body = req.body || {};
      const scopeRaw = String(body.scope || "").trim();
      const peerId = String(body.id || "").trim();
      const msgId = String(body.msgId || "").trim();
      if (!peerId || !msgId) {
        res.status(400).json({ code: -1, message: "缺少 id / msgId" });
        return;
      }
      if (scopeRaw !== "group" && scopeRaw !== "private") {
        res.status(400).json({ code: -1, message: "scope 须为 group / private" });
        return;
      }
      const target = scopeRaw === "group" ? { scope: "group", group_openid: peerId } : { scope: "c2c", user_openid: peerId };
      await 撤回消息(ctx, target, msgId);
      markMessageRecalled(ctx, msgId);
      res.json({ code: 0, data: { ok: true, msgId }, message: "已撤回" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.logger?.error?.("[GF_mk] chats/recall 失败:", e);
      res.status(500).json({ code: -1, message: msg || "撤回失败" });
    }
  });
  base.get(wrapPath("/logs/dates"), (_req, res) => {
    try {
      res.json({ code: 0, data: { dates: listLogDates(ctx), today: todayYmd$1() } });
    } catch (e) {
      ctx.logger?.error?.("[GF_mk] logs/dates 失败:", e);
      res.status(500).json({ code: -1, message: "日期列表失败" });
    }
  });
  base.get(wrapPath("/logs"), (req, res) => {
    try {
      const scopeRaw = String(req.query?.scope || "all").trim();
      const scope = ["all", "group", "private"].includes(scopeRaw) ? scopeRaw : "all";
      const data = queryMergedLogs(ctx, {
        date: String(req.query?.date || "").trim() || void 0,
        scope,
        q: String(req.query?.q || "").trim() || void 0,
        limit: Number(req.query?.limit) || 100,
        offset: Number(req.query?.offset) || 0,
        order: String(req.query?.order || "desc") === "asc" ? "asc" : "desc"
      });
      res.json({ code: 0, data });
    } catch (e) {
      ctx.logger?.error?.("[GF_mk] logs 查询失败:", e);
      res.status(500).json({ code: -1, message: "日志查询失败" });
    }
  });
  base.get(wrapPath("/config"), (_req, res) => {
    try {
      const cfg = readConfig(ctx);
      res.json({
        code: 0,
        data: {
          图片渲染: cfg.图片渲染 !== false,
          渲染模式: String(cfg.渲染模式 || "sharp"),
          调试开关: cfg.调试开关 === true,
          功能说明: "今日运势（图片版 / Markdown 输出）"
        }
      });
    } catch (e) {
      ctx.logger?.error?.("[GF_mk] 读取配置失败:", e);
      res.status(500).json({ code: -1, message: "读取配置失败" });
    }
  });
  base.post(wrapPath("/config"), (req, res) => {
    try {
      const body = req.body || {};
      const patch = {};
      if (body.图片渲染 !== void 0) patch.图片渲染 = !!body.图片渲染;
      if (body.调试开关 !== void 0) patch.调试开关 = !!body.调试开关;
      if (body.渲染模式 !== void 0) {
        const mode = String(body.渲染模式 || "sharp").toLowerCase();
        patch.渲染模式 = mode === "html" ? "html" : "sharp";
      }
      const next = writeConfig(ctx, patch);
      res.json({ code: 0, data: next, message: "已保存" });
    } catch (e) {
      ctx.logger?.error?.("[GF_mk] 保存配置失败:", e);
      res.status(500).json({ code: -1, message: "保存配置失败" });
    }
  });
  base.get(wrapPath("/sharp-deps/status"), async (_req, res) => {
    try {
      const status = await getSharpDependencyStatus(sharpDepsPaths(ctx));
      res.json({ code: 0, data: status });
    } catch (e) {
      ctx.logger?.error?.("[GF_mk] Sharp 状态失败:", e);
      res.status(500).json({ code: -1, message: "状态查询失败" });
    }
  });
  base.post(wrapPath("/sharp-deps/install"), async (_req, res) => {
    try {
      const result = await triggerSharpDependencyInstall(sharpDepsPaths(ctx), ctx.logger);
      res.json({ code: 0, data: result, message: result.message });
    } catch (e) {
      ctx.logger?.error?.("[GF_mk] Sharp 安装触发失败:", e);
      res.status(500).json({ code: -1, message: "安装触发失败" });
    }
  });
  if (base.page) {
    base.page({
      path: "admin",
      title: "GF_mk 后台",
      module: path.join("webui", "remote.js").replace(/\\/g, "/"),
      kind: "module",
      description: "仪表盘 · 查看消息 · Sharp 设置（控制台宿主 React 模块）"
    });
  }
  ctx.logger?.info?.("[GF_mk] 后台已注册（React 模块 webui/remote.js · /gfmk API）");
}

const WELCOME_FILE = "入群欢迎.json";
const DEFAULT_NOTIFY_OPENID = "651BF13FBB40F4EDDC9B0C0669A408C5";
const SYSTEM_EVENT_TYPES = /* @__PURE__ */ new Set([
  "GROUP_ADD_ROBOT",
  "GROUP_DEL_ROBOT",
  "FRIEND_ADD",
  "FRIEND_DEL",
  "GROUP_MEMBER_ADD",
  "GROUP_MEMBER_REMOVE"
]);
function str$1(v) {
  return String(v ?? "").trim();
}
function field(event, key) {
  const e = event;
  const d = e.d && typeof e.d === "object" ? e.d : void 0;
  return str$1(e[key] ?? d?.[key]);
}
function formatEventTime(raw) {
  if (!raw) {
    const d2 = /* @__PURE__ */ new Date();
    const p2 = (n) => String(n).padStart(2, "0");
    return `${d2.getFullYear()}-${p2(d2.getMonth() + 1)}-${p2(d2.getDate())} ${p2(d2.getHours())}:${p2(d2.getMinutes())}:${p2(d2.getSeconds())}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function resolveAppId(ctx) {
  const root = String(ctx.frameworkEnv?.projectRoot || "").trim();
  if (!root) return "";
  const connId = String(ctx.connectionId || ctx.frameworkEnv?.connectionId || "").trim();
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(root, "data", "connections.json"), "utf8")
    );
    const list = Array.isArray(raw.connections) ? raw.connections : [];
    const picked = (connId ? list.find((c) => c.id === connId) : void 0) || list.find((c) => (c.type ?? "") === "qq_official" && c.enable !== false) || list.find((c) => (c.type ?? "") === "qq_official");
    return str$1(picked?.appId);
  } catch {
    return "";
  }
}
function qqAppAvatarUrl(appId, openId, size = 640) {
  const a = str$1(appId);
  const id = str$1(openId);
  if (!a || !id) return "";
  return `https://thirdqq.qlogo.cn/qqapp/${a}/${id}/${size}`;
}
function resolveNotifyOpenid(ctx) {
  const cfg = readConfig$1(ctx);
  const fromCfg = str$1(cfg.系统通知openid ?? cfg.systemNotifyOpenid ?? cfg.notifyOpenid);
  return fromCfg || DEFAULT_NOTIFY_OPENID;
}
function isWelcomeEnabled(ctx, groupOpenid) {
  const v = str$1(readB(ctx, WELCOME_FILE, groupOpenid, "开启"));
  return v !== "关闭";
}
async function notifyOwner(ctx, lines) {
  const openid = resolveNotifyOpenid(ctx);
  const target = { scope: "c2c", user_openid: openid };
  const text = lines.filter(Boolean).join("\n");
  try {
    await 发消息(ctx, target, [段_md(text)]);
  } catch (error) {
    try {
      await 发消息(ctx, target, [段_文本(text.replace(/!\[[^\]]*\]\([^)]*\)/g, "[头像]"))]);
    } catch (e2) {
      ctx.logger?.error?.("[GF_mk] 系统通知发送失败:", error, e2);
    }
  }
}
async function handleGroupAddRobot(ctx, event) {
  const appId = resolveAppId(ctx);
  const groupId = field(event, "group_openid");
  const op = field(event, "op_member_openid");
  const time = formatEventTime(field(event, "timestamp"));
  const eventId = field(event, "id");
  const avatar = qqAppAvatarUrl(appId, op, 640);
  const lines = [
    avatar ? md图片行(avatar, { alt: "添加人", 宽: 160, 高: 160 }) : "",
    "有人添加我进群",
    `群id：${groupId || "—"}`,
    `添加人：${op || "—"}`,
    `添加时间：${time}`,
    `ID：${eventId || "—"}`
  ];
  await notifyOwner(ctx, lines);
}
async function handleGroupDelRobot(ctx, event) {
  const appId = resolveAppId(ctx);
  const groupId = field(event, "group_openid");
  const op = field(event, "op_member_openid");
  const time = formatEventTime(field(event, "timestamp"));
  const eventId = field(event, "id");
  const avatar = qqAppAvatarUrl(appId, op, 640);
  const lines = [
    avatar ? md图片行(avatar, { alt: "删除人", 宽: 160, 高: 160 }) : "",
    "有人把我移除群聊",
    `群id：${groupId || "—"}`,
    `删除人：${op || "—"}`,
    `删除时间：${time}`,
    `ID：${eventId || "—"}`
  ];
  await notifyOwner(ctx, lines);
}
async function handleFriendAdd(ctx, event) {
  const appId = resolveAppId(ctx);
  const openid = field(event, "openid");
  const time = formatEventTime(field(event, "timestamp"));
  const eventId = field(event, "id");
  const avatar = qqAppAvatarUrl(appId, openid, 640);
  await notifyOwner(ctx, [
    avatar ? md图片行(avatar, { alt: "好友", 宽: 160, 高: 160 }) : "",
    "有人添加我为好友",
    `添加人：${openid || "—"}`,
    `添加时间：${time}`,
    `ID：${eventId || "—"}`
  ]);
}
async function handleFriendDel(ctx, event) {
  const appId = resolveAppId(ctx);
  const openid = field(event, "openid");
  const time = formatEventTime(field(event, "timestamp"));
  const eventId = field(event, "id");
  const avatar = qqAppAvatarUrl(appId, openid, 640);
  await notifyOwner(ctx, [
    avatar ? md图片行(avatar, { alt: "好友", 宽: 160, 高: 160 }) : "",
    "有人删除好友",
    `删除人：${openid || "—"}`,
    `删除时间：${time}`,
    `ID：${eventId || "—"}`
  ]);
}
async function handleMemberAdd(ctx, event) {
  const groupId = field(event, "group_openid");
  const memberId = field(event, "member_openid");
  if (!groupId || !memberId) return;
  if (!isWelcomeEnabled(ctx, groupId)) return;
  const appId = resolveAppId(ctx);
  const time = formatEventTime(field(event, "timestamp"));
  const eventId = field(event, "id");
  const avatar = qqAppAvatarUrl(appId, memberId, 640);
  const md = [
    `<@${memberId}>`,
    avatar ? md图片行(avatar, { alt: "新成员", 宽: 160, 高: 160 }) : "",
    "欢迎新成员加入本群！",
    `您的id为：${memberId}`,
    `进群时间:${time}`,
    "如需关闭提示",
    "请艾特我发“入群欢迎”"
  ].filter(Boolean).join("\n");
  const target = eventId ? { scope: "group", group_openid: groupId, event_id: eventId } : { scope: "group", group_openid: groupId };
  try {
    await 发消息(ctx, target, [段_md(md)]);
  } catch (error) {
    ctx.logger?.warn?.("[GF_mk] 入群欢迎被动发送失败，尝试主动发送:", error);
    try {
      await 发消息(ctx, { scope: "group", group_openid: groupId }, [段_md(md)]);
    } catch (e2) {
      ctx.logger?.error?.("[GF_mk] 入群欢迎发送失败:", e2);
    }
  }
}
async function handleMemberRemove(ctx, event) {
  const groupId = field(event, "group_openid");
  const memberId = field(event, "member_openid");
  if (!groupId || !memberId) return;
  if (!isWelcomeEnabled(ctx, groupId)) return;
  const appId = resolveAppId(ctx);
  const time = formatEventTime(field(event, "timestamp"));
  const avatar = qqAppAvatarUrl(appId, memberId, 640);
  const md = [
    `<@${memberId}>`,
    avatar ? md图片行(avatar, { alt: "退群", 宽: 160, 高: 160 }) : "",
    "有人年纪轻轻就退出了本群！",
    `ta的id为：${memberId}`,
    `退群时间:${time}`,
    "如需关闭提示",
    "请艾特我发“入群欢迎”"
  ].filter(Boolean).join("\n");
  try {
    await 发消息(ctx, { scope: "group", group_openid: groupId }, [段_md(md)]);
  } catch (error) {
    ctx.logger?.error?.("[GF_mk] 退群提示发送失败:", error);
  }
}
async function tryHandleSystemEvents(ctx, event) {
  const t = str$1(event.t);
  if (!SYSTEM_EVENT_TYPES.has(t)) return false;
  try {
    switch (t) {
      case "GROUP_ADD_ROBOT":
        await handleGroupAddRobot(ctx, event);
        break;
      case "GROUP_DEL_ROBOT":
        await handleGroupDelRobot(ctx, event);
        break;
      case "FRIEND_ADD":
        await handleFriendAdd(ctx, event);
        break;
      case "FRIEND_DEL":
        await handleFriendDel(ctx, event);
        break;
      case "GROUP_MEMBER_ADD":
        await handleMemberAdd(ctx, event);
        break;
      case "GROUP_MEMBER_REMOVE":
        await handleMemberRemove(ctx, event);
        break;
      default:
        return false;
    }
    ctx.logger?.info?.(`[GF_mk] 已处理系统事件 ${t}`);
  } catch (error) {
    ctx.logger?.error?.(`[GF_mk] 系统事件 ${t} 处理失败:`, error);
  }
  return true;
}

function tcRoot(ctx) {
  const base = String(ctx.dataPath ?? "").trim();
  if (!base) throw new Error("GF_mk/tc: 缺少 dataPath");
  const dir = path.join(base, "tc");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function tcPluginDataRoot(ctx) {
  const base = String(ctx.pluginPath ?? "").trim();
  if (!base) throw new Error("GF_mk/tc: 缺少 pluginPath");
  return path.join(base, "data", "tc");
}
function ensureParent(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function tcFile(ctx, rel) {
  return path.join(tcRoot(ctx), rel.replace(/\\/g, "/"));
}
function 读(ctx, rel, key, fallback) {
  const file = tcFile(ctx, rel);
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!(key in raw)) return fallback;
    return raw[key];
  } catch {
    return fallback;
  }
}
function 写(ctx, rel, key, value) {
  if (isDebugReadonly(ctx)) return;
  const file = tcFile(ctx, rel);
  ensureParent(file);
  let data = {};
  try {
    if (fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {
    data = {};
  }
  data[key] = value;
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}
function 读全部(ctx, rel) {
  const file = tcFile(ctx, rel);
  try {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function todayYmd() {
  const d = /* @__PURE__ */ new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function nowTs() {
  return Math.floor(Date.now() / 1e3);
}
function formatDateTime(ts = nowTs()) {
  const d = new Date(ts * 1e3);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const PATH = {
  是否开号: "游戏数据/是否开号.json",
  游戏ID: "游戏数据/游戏ID.json",
  ID绑定: "游戏数据/ID绑定编号.json",
  账号总数: "游戏数据/账号总数.json",
  星羽: "游戏数据/星舰数据/星羽.json",
  存款星羽: "游戏数据/星舰数据/存款-星羽.json",
  存款首次: "游戏数据/星舰数据/存款系统/第一次.json",
  存款时间: "游戏数据/星舰数据/存款系统/时间.json",
  火力: "游戏数据/星舰数据/火力.json",
  耐久: "游戏数据/星舰数据/耐久.json",
  耐久上限: "游戏数据/星舰数据/耐久上限.json",
  暴击: "游戏数据/星舰数据/暴击.json",
  闪避: "游戏数据/星舰数据/闪避.json",
  总评分: "游戏数据/星舰数据/总评分.json",
  等级: "游戏数据/星舰数据/等级.json",
  经验: "游戏数据/星舰数据/经验.json",
  昵称: "游戏数据/星舰数据/昵称.json",
  创号时间: "游戏数据/星舰数据/创号时间.json",
  位置: "游戏数据/星舰数据/位置.json",
  修复状态: "游戏数据/星舰数据/战甲修复/记录状态.json",
  修复时间: "游戏数据/星舰数据/战甲修复/记录时间.json",
  修复速度: "游戏数据/星舰数据/战甲修复/修复速度.json",
  时空位置: "游戏数据/星舰数据/时空门/位置.json",
  时空冷却: "游戏数据/星舰数据/时空门/冷却.json",
  联盟加入: "游戏数据/星舰数据/联盟数据/玩家加入的.json",
  联盟加成火力: "游戏数据/星舰数据/联盟数据/已获取的联盟加成/火力.json",
  联盟加成耐久: "游戏数据/星舰数据/联盟数据/已获取的联盟加成/耐久上限.json",
  联盟加成暴击: "游戏数据/星舰数据/联盟数据/已获取的联盟加成/暴击.json",
  联盟加成闪避: "游戏数据/星舰数据/联盟数据/已获取的联盟加成/闪避.json",
  升级所需经验: "游戏数据/星舰数据/升级系统/所需经验.json",
  升级下次火力: "游戏数据/星舰数据/升级系统/下一次火力.json",
  升级下次耐久: "游戏数据/星舰数据/升级系统/下一次耐久.json",
  升级概率: "游戏数据/星舰数据/升级系统/升级概率.json",
  转生次数: "游戏数据/星舰数据/升级系统/转生次数.json",
  转生火力加成: "游戏数据/星舰数据/升级系统/转生火力加成.json",
  任务已领: (ymd) => `任务系统/每日任务/${ymd}❂已领奖励.json`,
  联盟战胜场: "游戏数据/星舰数据/联盟数据/联盟战胜场.json",
  联盟战周键: "游戏数据/星舰数据/联盟数据/联盟战当前周.json",
  联盟战已领: "游戏数据/星舰数据/联盟数据/联盟战已领奖.json",
  签到日期: "游戏数据/签到系统/时间记录.json",
  签到详细: "游戏数据/签到系统/详细时间记录.json",
  总签次数: "游戏数据/签到系统/总签次数.json",
  连签次数: "游戏数据/签到系统/连签次数.json",
  上次签到: "游戏数据/签到系统/上次签到时间.json",
  昵称库: "游戏数据/星舰数据/昵称数据/数据库.json",
  商店价格: "商店系统/道具价格.json",
  道具: (名) => `游戏数据/星舰数据/道具系统/${名}.json`,
  联盟记录: (名) => `游戏数据/星舰数据/联盟数据/${名}/记录.json`,
  签到排行: (ymd) => `游戏数据/签到系统/签到排行/${ymd.replace(/-/g, "_")}.json`,
  签到全服: "游戏数据/签到系统/全服信息/全服签到.json",
  签到渠道: (渠道, 群号) => `游戏数据/签到系统/全服信息/${渠道}/${群号}.json`,
  签到个人渠道: (ymd) => `游戏数据/签到系统/个人记录/今天签哪了/${ymd}.json`,
  签到个人排名: (渠道, ymd) => `游戏数据/签到系统/个人记录/${渠道}/${ymd}.json`,
  签到全服排名: (ymd) => `游戏数据/签到系统/个人记录/全服排名/${ymd}.json`,
  任务进度: (ymd) => `任务系统/每日任务/${ymd}❂完成进度.json`
};
const REQUIRE_REGISTER_MSG = "还没开号，点「立即装甲」就能玩。";
const ALLIANCE_NAMES = ["以爆制爆", "蚀月獠牙", "暗域商锋", "休闲至上"];
const TC_CMD_PREFIX = "tc_cmd:";
function tcCmdData(command) {
  return `${TC_CMD_PREFIX}${command}`;
}
function btn(label, command) {
  return { label, data: tcCmdData(command) };
}
function btnNav(label, data) {
  return { label, data };
}
function cmd(fill, show) {
  return { fill, show: fill };
}
const STARTER_BASE = {
  星羽: 100,
  火力: 100,
  耐久上限: 500
};
function rollStarterStats() {
  const around = (base) => {
    const lo = Math.max(1, Math.floor(base / 10));
    const hi = base * 10;
    return randInt(lo, hi);
  };
  const 星羽 = around(STARTER_BASE.星羽);
  const 火力 = around(STARTER_BASE.火力);
  const 耐久上限 = around(STARTER_BASE.耐久上限);
  const durLo = Math.max(1, Math.floor(耐久上限 / 10));
  const 耐久 = randInt(durLo, 耐久上限);
  const 暴击 = randInt(0, 30);
  const 闪避 = randInt(0, 30);
  return { 星羽, 火力, 耐久上限, 耐久, 暴击, 闪避 };
}
function combatCrit(ctx, userId) {
  return 1 + num(ctx, PATH.暴击, userId, 0);
}
function combatDodge(ctx, userId) {
  return 1 + num(ctx, PATH.闪避, userId, 0);
}
function calcCombatScore(fire, dur, durMax, crit, dodge) {
  return Math.max(0, Math.floor(fire)) * 2 + Math.max(0, Math.floor(dur)) + Math.floor(Math.max(0, durMax) * 0.5) + Math.max(0, Math.floor(crit)) * 30 + Math.max(0, Math.floor(dodge)) * 30;
}
function refreshScore(ctx, userId) {
  if (!userId || userId === "失败") return { score: 0, changed: false };
  const fire = num(ctx, PATH.火力, userId, 100);
  const dur = num(ctx, PATH.耐久, userId, 500);
  const durMax = num(ctx, PATH.耐久上限, userId, 500);
  const crit = num(ctx, PATH.暴击, userId, 0);
  const dodge = num(ctx, PATH.闪避, userId, 0);
  const score = calcCombatScore(fire, dur, durMax, crit, dodge);
  const prev = num(ctx, PATH.总评分, userId, -1);
  if (prev === score) return { score, changed: false };
  写(ctx, PATH.总评分, userId, score);
  return { score, changed: true };
}
function getScore(ctx, userId) {
  const cached = num(ctx, PATH.总评分, userId, -1);
  if (cached >= 0) return cached;
  return refreshScore(ctx, userId).score;
}
function num(ctx, rel, key, fb = 0) {
  return Number(读(ctx, rel, key, fb)) || fb;
}
function str(ctx, rel, key, fb = "") {
  const v = 读(ctx, rel, key, fb);
  return v == null ? fb : String(v);
}
function ensureRegistered(ctx, userId) {
  return str(ctx, PATH.是否开号, userId, "未") === "已";
}
function getGameId(ctx, userId) {
  return str(ctx, PATH.游戏ID, userId, "未知");
}
function isRepairing(ctx, userId) {
  return str(ctx, PATH.修复状态, userId, "正常") === "正在修甲";
}
function getAlliance(ctx, userId) {
  return str(ctx, PATH.联盟加入, userId, "未知");
}
function userByGameId(ctx, gameId) {
  return str(ctx, PATH.ID绑定, String(gameId), "失败");
}
function spacetimePos(ctx, userId) {
  return str(ctx, PATH.时空位置, userId, "深渊");
}
function displayPos(ctx, userId) {
  return str(ctx, PATH.位置, userId, "深渊");
}
function setPosition(ctx, userId, pos) {
  写(ctx, PATH.时空位置, userId, pos);
  写(ctx, PATH.位置, userId, pos);
}
function incTask(ctx, userId, taskKey) {
  const rel = PATH.任务进度(todayYmd());
  const raw = 读(ctx, rel, userId, {});
  const data = typeof raw === "string" ? JSON.parse(raw || "{}") : { ...raw };
  data[taskKey] = (Number(data[taskKey]) || 0) + 1;
  写(ctx, rel, userId, data);
}
function getTaskCount(ctx, userId, taskKey) {
  const raw = 读(ctx, PATH.任务进度(todayYmd()), userId, {});
  const data = typeof raw === "string" ? JSON.parse(raw || "{}") : raw ?? {};
  return Number(data[taskKey]) || 0;
}
const EXPLORE_XP_SOFT_CAP = 20;
function exploreBaseExpRange(nthToday) {
  if (nthToday <= 0 || nthToday > EXPLORE_XP_SOFT_CAP) return null;
  const first = [
    [15, 25],
    [12, 20],
    [10, 18],
    [8, 14],
    [6, 12],
    [4, 10],
    [3, 8],
    [2, 6],
    [1, 4],
    [1, 3]
  ];
  const second = [
    [1, 3],
    [1, 2],
    [1, 2],
    [1, 2],
    [1, 1],
    [1, 1],
    [1, 1],
    [1, 1],
    [1, 1],
    [1, 1]
  ];
  const row = nthToday <= 10 ? first[nthToday - 1] : second[nthToday - 11];
  return { lo: row[0], hi: row[1] };
}
const LEVEL_CAP = 30;
function rollUpgradeRewards(nextLv) {
  const stage = nextLv <= 10 ? 1 : nextLv <= 20 ? 2 : 3;
  const milestone = nextLv % 5 === 0;
  let fireLo = 10;
  let fireHi = 28;
  let durLo = 20;
  let durHi = 55;
  let luckChance = 22;
  let bothChance = 6;
  let cdLo = 1;
  let cdHi = 3;
  if (stage === 2) {
    fireLo = 18;
    fireHi = 48;
    durLo = 35;
    durHi = 85;
    luckChance = 28;
    bothChance = 9;
    cdLo = 1;
    cdHi = 4;
  } else if (stage === 3) {
    fireLo = 28;
    fireHi = 75;
    durLo = 50;
    durHi = 130;
    luckChance = 34;
    bothChance = 12;
    cdLo = 2;
    cdHi = 5;
  }
  if (milestone) {
    fireLo = Math.floor(fireLo * 1.35);
    fireHi = Math.floor(fireHi * 1.45);
    durLo = Math.floor(durLo * 1.35);
    durHi = Math.floor(durHi * 1.45);
    luckChance += 8;
    bothChance += 4;
    cdHi += 1;
  }
  const fire = randInt(fireLo, fireHi);
  const dur = randInt(durLo, durHi);
  let crit = 0;
  let dodge = 0;
  const luck = randInt(1, 100);
  if (luck <= bothChance) {
    crit = randInt(cdLo, cdHi);
    dodge = randInt(cdLo, cdHi);
  } else if (luck <= bothChance + luckChance) {
    if (randInt(0, 1) === 0) crit = randInt(cdLo, cdHi);
    else dodge = randInt(cdLo, cdHi);
  }
  return { fire, dur, crit, dodge };
}
const CRIT_MULT_MIN = 1.2;
const CRIT_MULT_MAX = 4;
function rollCritDamage(atk, critStat = 0) {
  const lift = Math.min(0.8, Math.max(0, critStat) * 0.02);
  const lo = CRIT_MULT_MIN + lift;
  const hi = CRIT_MULT_MAX;
  const t = Math.random();
  const mult = Math.round((lo + (hi - lo) * t) * 100) / 100;
  const dmg = Math.max(1, Math.floor(atk * mult));
  const bonusPct = Math.round((mult - 1) * 1e3) / 10;
  return { dmg, mult, bonusPct };
}
const EXPLORE_QTY_TIERS = [
  { qty: 1, weight: 50 },
  { qty: 5, weight: 28 },
  { qty: 10, weight: 14 },
  { qty: 15, weight: 6 },
  { qty: 20, weight: 2 }
];
const EXPLORE_QTY_DEFAULT = 1;
const EXPLORE_DUR_MIN = 30;
const EXPLORE_DUR_DEFAULT = 50;
function rollExploreQty() {
  const total = EXPLORE_QTY_TIERS.reduce((s, t) => s + t.weight, 0);
  let r = randInt(1, total);
  for (const t of EXPLORE_QTY_TIERS) {
    r -= t.weight;
    if (r <= 0) return t.qty;
  }
  return EXPLORE_QTY_DEFAULT;
}
function rollExploreOutcome() {
  const qty = rollExploreQty();
  const roll = randInt(0, 200);
  let kind = "太空废铁";
  let eventName = "";
  let isSpecialEvent = false;
  let durCost = randInt(EXPLORE_DUR_MIN, 70);
  if (roll >= 192) {
    kind = "强化组件";
    eventName = "事件·废弃军械库";
    isSpecialEvent = true;
    durCost = randInt(55, 110);
  } else if (roll >= 180) {
    kind = "红色血清";
    eventName = "事件·血清补给箱";
    isSpecialEvent = true;
    durCost = randInt(EXPLORE_DUR_MIN, 45);
  } else if (roll >= 150) {
    kind = "绿色血清";
    durCost = randInt(35, 75);
  } else {
    const side = randInt(1, 100);
    if (side <= 8) {
      eventName = "事件·陷阱区";
      isSpecialEvent = true;
      durCost = randInt(70, 120);
    } else if (side <= 16) {
      eventName = "事件·捷径航道";
      isSpecialEvent = true;
      durCost = randInt(EXPLORE_DUR_MIN, 40);
    } else {
      durCost = randInt(EXPLORE_DUR_MIN, EXPLORE_DUR_DEFAULT + 20);
    }
  }
  if (durCost < EXPLORE_DUR_MIN) durCost = EXPLORE_DUR_MIN;
  return { kind, qty, durCost, eventName, isSpecialEvent };
}
function readJsonArray(ctx, rel) {
  const file = tcFile(ctx, rel);
  try {
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeJsonArray(ctx, rel, arr) {
  if (isDebugReadonly(ctx)) return;
  const file = tcFile(ctx, rel);
  const dir = file.slice(0, Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\")));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(arr, null, 2), "utf8");
}
function calcDepositInterest(deposit, depositTime, now, alliance) {
  const hours = (now - depositTime) / 3600;
  const wc = hours / 2;
  const rate = alliance === "暗域商锋" ? 15e-5 : 5e-5;
  let interest = deposit * rate * wc;
  if (interest < 0.5) interest = 0;
  else if (interest < 1) interest = 1;
  else interest = Math.floor(interest);
  return { interest, hours, rate };
}
function msgSource(event) {
  const t = String(event.t ?? "");
  if (t.includes("GROUP")) {
    const gid = String(event.group_openid ?? event.group_open_id ?? event.group_id ?? "unknown").trim() || "unknown";
    return { 渠道: "群聊", 群号: gid };
  }
  return { 渠道: "私聊", 群号: "private" };
}
function stripBox(text) {
  return String(text ?? "").replace(/══════════════/g, "").split("\n").map((l) => l.trimEnd()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function buildKeyboard(buttons) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) {
    const chunk = buttons.slice(i, i + 3);
    rows.push(
      行(
        ...chunk.map((b, j) => {
          const data = b.data.startsWith(TC_CMD_PREFIX) || b.data === "main_menu" || b.data === "main" ? b.data : tcCmdData(b.data);
          return 钮(`tc_b_${i}_${j}`, b.label, data);
        })
      )
    );
  }
  return { rows };
}
function buildCmdLine(cmds) {
  return cmds.map((c) => md指令输入(c.fill, c.show ?? c.fill)).join(" · ");
}
async function replyText(ctx, target, text, interactive = false, extras = {}) {
  const body = stripBox(text);
  const title = extras.title ?? "星甲系统";
  const parts = [`## ${title}`, "", body];
  const showCmds = !!extras.cmds?.length && (!extras.buttons?.length || extras.keepCmds === true);
  if (showCmds && extras.cmds?.length) {
    parts.push("", "**需填写：**", buildCmdLine(extras.cmds));
  }
  if (isDebugReadonly(ctx)) {
    parts.push("", "_调试开关已开：本次不会写入数据_");
  }
  const keyboard = extras.buttons?.length ? buildKeyboard(extras.buttons) : void 0;
  const seg = 段_md(parts.join("\n"), keyboard);
  if (interactive) await 发互动回复(ctx, target, [seg]);
  else await 发消息(ctx, target, [seg]);
}
async function replyNeedRegister(ctx, target, interactive = false) {
  await replyText(ctx, target, REQUIRE_REGISTER_MSG, interactive, {
    title: "先开个号",
    buttons: [btn("立即装甲", "装甲"), btnNav("回大厅", "main_menu")]
  });
}
function topRankEntries(ctx, rel, limit = 10) {
  const all = 读全部(ctx, rel);
  return Object.entries(all).map(([userId, value]) => ({ userId, value: Number(value) || 0 })).sort((a, b) => b.value - a.value).slice(0, limit);
}
const RANK_CN = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

const ALLIANCE_APPLIED = "游戏数据/星舰数据/联盟数据/已获取的联盟加成/已应用.json";
function allianceBonusOf(name) {
  if (name === "以爆制爆") {
    return { fire: 100, dur: 100, crit: 20, dodge: 0, note: "火力+100 · 耐久上限+100 · 暴击+20" };
  }
  if (name === "蚀月獠牙") {
    return { fire: 50, dur: 50, crit: 0, dodge: 0, note: "火力+50 · 耐久上限+50 · 签到经验×1.5" };
  }
  if (name === "暗域商锋") {
    return { fire: 0, dur: 200, crit: 0, dodge: 20, note: "耐久上限+200 · 闪避+20 · 存款利率更高" };
  }
  return { fire: 0, dur: 0, crit: 0, dodge: 0, note: "暂无战斗加成" };
}
function ensureAllianceBonusesApplied(ctx, userId) {
  const joined = getAlliance(ctx, userId);
  if (joined === "未知") return;
  const flag = str(ctx, ALLIANCE_APPLIED, userId, "");
  if (flag === "v2") return;
  const bFire = num(ctx, PATH.联盟加成火力, userId, 0);
  const bDur = num(ctx, PATH.联盟加成耐久, userId, 0);
  const bCrit = num(ctx, PATH.联盟加成暴击, userId, 0);
  const bDodge = num(ctx, PATH.联盟加成闪避, userId, 0);
  if (flag !== "是") {
    if (bFire || bDur) {
      写(ctx, PATH.火力, userId, num(ctx, PATH.火力, userId, 100) + bFire);
      写(ctx, PATH.耐久上限, userId, num(ctx, PATH.耐久上限, userId, 500) + bDur);
    }
  }
  if (bCrit || bDodge) {
    写(ctx, PATH.暴击, userId, num(ctx, PATH.暴击, userId, 0) + bCrit);
    写(ctx, PATH.闪避, userId, num(ctx, PATH.闪避, userId, 0) + bDodge);
  }
  写(ctx, ALLIANCE_APPLIED, userId, "v2");
  refreshScore(ctx, userId);
}
function applyJoinBonus(ctx, userId, bonus) {
  const nextFire = num(ctx, PATH.火力, userId, 100) + bonus.fire;
  const nextDurMax = num(ctx, PATH.耐久上限, userId, 500) + bonus.dur;
  const nextCrit = num(ctx, PATH.暴击, userId, 0) + bonus.crit;
  const nextDodge = num(ctx, PATH.闪避, userId, 0) + bonus.dodge;
  写(ctx, PATH.火力, userId, nextFire);
  写(ctx, PATH.耐久上限, userId, nextDurMax);
  写(ctx, PATH.暴击, userId, nextCrit);
  写(ctx, PATH.闪避, userId, nextDodge);
  写(ctx, PATH.联盟加成火力, userId, bonus.fire);
  写(ctx, PATH.联盟加成耐久, userId, bonus.dur);
  写(ctx, PATH.联盟加成暴击, userId, bonus.crit);
  写(ctx, PATH.联盟加成闪避, userId, bonus.dodge);
  写(ctx, ALLIANCE_APPLIED, userId, "v2");
  refreshScore(ctx, userId);
  return { fire: nextFire, durMax: nextDurMax, crit: nextCrit, dodge: nextDodge };
}
function revokeJoinBonus(ctx, userId) {
  const bFire = num(ctx, PATH.联盟加成火力, userId, 0);
  const bDur = num(ctx, PATH.联盟加成耐久, userId, 0);
  const bCrit = num(ctx, PATH.联盟加成暴击, userId, 0);
  const bDodge = num(ctx, PATH.联盟加成闪避, userId, 0);
  const fire = num(ctx, PATH.火力, userId, 100);
  const dur = num(ctx, PATH.耐久, userId, 500);
  const durMax = num(ctx, PATH.耐久上限, userId, 500);
  const nextFire = Math.max(0, fire - bFire);
  const nextDurMax = Math.max(1, durMax - bDur);
  写(ctx, PATH.火力, userId, nextFire);
  写(ctx, PATH.耐久上限, userId, nextDurMax);
  if (dur > nextDurMax) 写(ctx, PATH.耐久, userId, nextDurMax);
  写(ctx, PATH.暴击, userId, Math.max(0, num(ctx, PATH.暴击, userId, 0) - bCrit));
  写(ctx, PATH.闪避, userId, Math.max(0, num(ctx, PATH.闪避, userId, 0) - bDodge));
  写(ctx, PATH.联盟加成火力, userId, 0);
  写(ctx, PATH.联盟加成耐久, userId, 0);
  写(ctx, PATH.联盟加成暴击, userId, 0);
  写(ctx, PATH.联盟加成闪避, userId, 0);
  写(ctx, ALLIANCE_APPLIED, userId, "否");
  refreshScore(ctx, userId);
}
async function handleJoinAlliance(ctx, target, userId, choice) {
  const gameId = getGameId(ctx, userId);
  const joined = getAlliance(ctx, userId);
  if (joined !== "未知") {
    ensureAllianceBonusesApplied(ctx, userId);
    await replyText(ctx, target, [`编号:${gameId}`, `你已加入${joined}`, "请先【退出联盟】"].join("\n"));
    return;
  }
  if (isRepairing(ctx, userId)) {
    await replyText(ctx, target, [`编号:${gameId}`, "你正在修复战甲，请先【退出修甲】"].join("\n"));
    return;
  }
  const n = Number(choice);
  if (!n || n < 1 || n > 4) {
    await replyText(
      ctx,
      target,
      [
        "加入联盟，让你更强！",
        "1 以爆制爆 · +100火力 +100耐久 +20暴击",
        "2 蚀月獠牙 · +50火力 +50耐久 · 签到经验×1.5",
        "3 暗域商锋 · +200耐久 +20闪避 · 存款利率更高",
        "4 休闲至上 · 暂无战斗加成",
        "",
        "提示：点一个加入就行，随时可退。"
      ].join("\n"),
      false,
      {
        title: "联盟系统",
        buttons: [
          btn("①以爆制爆", "加入联盟 1"),
          btn("②蚀月獠牙", "加入联盟 2"),
          btn("③暗域商锋", "加入联盟 3"),
          btn("④休闲至上", "加入联盟 4"),
          btn("查看联盟", "查看联盟"),
          btn("退出联盟", "退出联盟")
        ]
      }
    );
    return;
  }
  const name = ALLIANCE_NAMES[n - 1];
  const bonus = allianceBonusOf(name);
  const rec = PATH.联盟记录(name);
  const pop = num(ctx, rec, "总人数", 0);
  const boom = num(ctx, rec, "繁荣度", 0);
  写(ctx, PATH.联盟加入, userId, name);
  写(ctx, rec, "总人数", pop + 1);
  写(ctx, rec, "繁荣度", boom + 10);
  const stats = applyJoinBonus(ctx, userId, bonus);
  await replyText(
    ctx,
    target,
    [
      `编号:${gameId}`,
      `已加入【${name}】`,
      bonus.note,
      `当前火力:${stats.fire} · 耐久上限:${stats.durMax}`,
      `暴击:${stats.crit} · 闪避:${stats.dodge}`,
      "提示：退出联盟会收回这些加成。"
    ].join("\n"),
    false,
    {
      title: "加入联盟",
      buttons: [
        btn("查看联盟", "查看联盟"),
        btn("控制台", "星甲控制台"),
        btn("每日巡游", "签到")
      ]
    }
  );
}
async function handleLeaveAlliance(ctx, target, userId) {
  const gameId = getGameId(ctx, userId);
  if (isRepairing(ctx, userId)) {
    await replyText(ctx, target, [`编号:${gameId}`, "你正在修复战甲，请先【退出修甲】"].join("\n"));
    return;
  }
  const joined = getAlliance(ctx, userId);
  if (joined === "未知") {
    await replyText(ctx, target, [`编号:${gameId}`, "你尚未加入任何联盟"].join("\n"));
    return;
  }
  ensureAllianceBonusesApplied(ctx, userId);
  const rec = PATH.联盟记录(joined);
  const pop = num(ctx, rec, "总人数", 0);
  const boom = num(ctx, rec, "繁荣度", 0);
  写(ctx, rec, "总人数", Math.max(0, pop - 1));
  写(ctx, rec, "繁荣度", Math.max(0, boom - 5));
  revokeJoinBonus(ctx, userId);
  写(ctx, PATH.联盟加入, userId, "未知");
  await replyText(
    ctx,
    target,
    [
      `编号:${gameId}`,
      `已退出 ${joined}`,
      "相应属性已收回。",
      `当前火力:${num(ctx, PATH.火力, userId, 100)} · 耐久上限:${num(ctx, PATH.耐久上限, userId, 500)}`
    ].join("\n"),
    false,
    {
      title: "退出联盟",
      buttons: [btn("再选联盟", "联盟系统"), btn("控制台", "星甲控制台")]
    }
  );
}
async function handleViewAlliance(ctx, target, userId) {
  const joined = getAlliance(ctx, userId);
  if (joined === "未知") {
    await replyText(ctx, target, "还没加入联盟。", false, {
      title: "查看联盟",
      buttons: [btn("去加入", "联盟系统")]
    });
    return;
  }
  ensureAllianceBonusesApplied(ctx, userId);
  const rec = PATH.联盟记录(joined);
  const bonus = allianceBonusOf(joined);
  await replyText(
    ctx,
    target,
    [
      `联盟:${joined}`,
      `等级:${num(ctx, rec, "等级", 1)} · 人数:${num(ctx, rec, "总人数", 0)} · 繁荣:${num(ctx, rec, "繁荣度", 0)}`,
      `加成:${bonus.note}`,
      `火力:${num(ctx, PATH.火力, userId, 100)} · 耐久上限:${num(ctx, PATH.耐久上限, userId, 500)}`
    ].join("\n"),
    false,
    {
      title: "我的联盟",
      buttons: [btn("控制台", "星甲控制台"), btn("退出联盟", "退出联盟")]
    }
  );
}

async function handleUseRed(ctx, target, userId, qty) {
  const gameId = getGameId(ctx, userId);
  if (isRepairing(ctx, userId)) {
    await replyText(ctx, target, [`编号:${gameId}`, "你正在修复战甲，请先【退出修甲】"].join("\n"));
    return;
  }
  const have = num(ctx, PATH.道具("红色血清"), userId, 0);
  if (qty <= 0 || qty > have) {
    await replyText(ctx, target, [`编号:${gameId}`, `你的红色血清不足【${qty}】个`].join("\n"));
    return;
  }
  写(ctx, PATH.道具("红色血清"), userId, have - qty);
  let gain = 0;
  for (let i = 0; i < qty; i++) gain += randInt(5, 15);
  const max = num(ctx, PATH.耐久上限, userId, 500) + gain;
  写(ctx, PATH.耐久上限, userId, max);
  refreshScore(ctx, userId);
  await replyText(
    ctx,
    target,
    [`编号:${gameId}`, "【红色血清结算】", `使用次数:${qty}`, `耐久提升:${gain}`].join("\n")
  );
}
async function handleUseGreen(ctx, target, userId, qty) {
  const gameId = getGameId(ctx, userId);
  if (isRepairing(ctx, userId)) {
    await replyText(ctx, target, [`编号:${gameId}`, "你正在修复战甲，请先【退出修甲】"].join("\n"));
    return;
  }
  let have = num(ctx, PATH.道具("绿色血清"), userId, 0);
  if (qty <= 0 || qty > have) {
    await replyText(ctx, target, [`编号:${gameId}`, `你的绿色血清不足【${qty}】个`].join("\n"));
    return;
  }
  const cap = num(ctx, PATH.耐久上限, userId, 500);
  const base = num(ctx, PATH.耐久, userId, 500);
  let healed = 0;
  let used = 0;
  const lines = [`编号:${gameId}`];
  for (let i = 0; i < qty; i++) {
    have = num(ctx, PATH.道具("绿色血清"), userId, 0);
    const cur = num(ctx, PATH.耐久, userId, 500);
    if (cur >= cap) continue;
    const roll = randInt(50, 200);
    if (cur + roll >= cap) {
      lines.push("动态耐久 - 恢复耐久上限");
      healed = cap - base;
      used += 1;
      写(ctx, PATH.耐久, userId, cap);
      写(ctx, PATH.道具("绿色血清"), userId, have - 1);
      continue;
    }
    lines.push(`动态耐久 + ${roll}`);
    healed += roll;
    used += 1;
    写(ctx, PATH.耐久, userId, cur + roll);
    写(ctx, PATH.道具("绿色血清"), userId, have - 1);
  }
  lines.push("【绿色血清结算】", `使用次数:${used}`, `恢复耐久:${healed}`);
  refreshScore(ctx, userId);
  await replyText(ctx, target, lines.join("\n"));
}
async function handleUseComponent(ctx, target, userId, qty) {
  const gameId = getGameId(ctx, userId);
  if (isRepairing(ctx, userId)) {
    await replyText(ctx, target, [`编号:${gameId}`, "你正在修复战甲，请先【退出修甲】"].join("\n"));
    return;
  }
  const have = num(ctx, PATH.道具("强化组件"), userId, 0);
  if (qty <= 0 || qty > have) {
    await replyText(ctx, target, [`编号:${gameId}`, `你的强化组件不足【${qty}】个`].join("\n"));
    return;
  }
  写(ctx, PATH.道具("强化组件"), userId, have - qty);
  let gFire = 0;
  let gDur = 0;
  const lines = [`编号:${gameId}`];
  for (let i = 0; i < qty; i++) {
    const add = randInt(5, 50);
    const roll = randInt(0, 10);
    const round = i + 1;
    if (roll === 2 || roll === 3) {
      lines.push(`第${round}次循环:成功❂火力+${add}`);
      gFire += add;
    } else if (roll === 4 || roll === 5) {
      lines.push(`第${round}次循环:成功❂耐久+${add}`);
      gDur += add;
    } else {
      lines.push(`第${round}次循环:失败`);
    }
  }
  写(ctx, PATH.火力, userId, num(ctx, PATH.火力, userId, 100) + gFire);
  写(ctx, PATH.耐久上限, userId, num(ctx, PATH.耐久上限, userId, 500) + gDur);
  refreshScore(ctx, userId);
  lines.push("【强化结算】", `耐久 + ${gDur}`, `火力 + ${gFire}`);
  await replyText(ctx, target, lines.join("\n"));
}
async function handleUseRefresh(ctx, target, userId, qty) {
  const gameId = getGameId(ctx, userId);
  if (qty !== 1) {
    await replyText(ctx, target, [`编号:${gameId}`, "刷新卡每次使用 1 张。"].join("\n"));
    return;
  }
  const have = num(ctx, PATH.道具("刷新卡"), userId, 1);
  if (have < 1) {
    await replyText(ctx, target, [`编号:${gameId}`, "刷新卡不足"].join("\n"), false, {
      title: "道具不足",
      buttons: [btn("去商店", "商店")]
    });
    return;
  }
  写(ctx, PATH.道具("刷新卡"), userId, have - 1);
  写(ctx, PATH.时空冷却, userId, 0);
  await replyText(
    ctx,
    target,
    [`编号:${gameId}`, "已使用刷新卡", "时空门冷却已重置，可立即传送。"].join("\n"),
    false,
    {
      title: "刷新卡",
      buttons: [btn("去深渊", "时空门 深渊"), btn("去芸界", "时空门 芸界"), btn("控制台", "星甲控制台")]
    }
  );
}
const SCRAP_COST = 10;
async function handleUseScrap(ctx, target, userId, scrapAmount) {
  const gameId = getGameId(ctx, userId);
  const amount = scrapAmount > 0 ? scrapAmount : SCRAP_COST;
  const rounds = Math.floor(amount / SCRAP_COST);
  if (rounds < 1) {
    await replyText(ctx, target, [`编号:${gameId}`, `至少需要 ${SCRAP_COST} 个太空废铁`].join("\n"));
    return;
  }
  const cost = rounds * SCRAP_COST;
  const have = num(ctx, PATH.道具("太空废铁"), userId, 0);
  if (have < cost) {
    await replyText(
      ctx,
      target,
      [`编号:${gameId}`, `太空废铁不足（需要 ${cost}，当前 ${have}）`, `提示：每 ${SCRAP_COST} 个可兑换 1 次。`].join("\n"),
      false,
      { title: "废铁兑换", buttons: [btn("去探索", "探索")] }
    );
    return;
  }
  写(ctx, PATH.道具("太空废铁"), userId, have - cost);
  const lines = [`编号:${gameId}`, `消耗废铁 ${cost}`];
  let coin = 0;
  let exp = 0;
  let green = 0;
  for (let i = 0; i < rounds; i++) {
    const roll = randInt(1, 100);
    if (roll <= 45) {
      const g = randInt(60, 180);
      coin += g;
      lines.push(`第${i + 1}次：星羽+${g}`);
    } else if (roll <= 75) {
      const g = randInt(5, 15);
      exp += g;
      lines.push(`第${i + 1}次：经验+${g}`);
    } else if (roll <= 95) {
      green += 1;
      lines.push(`第${i + 1}次：绿色血清+1`);
    } else {
      写(ctx, PATH.道具("强化组件"), userId, num(ctx, PATH.道具("强化组件"), userId, 0) + 1);
      lines.push(`第${i + 1}次：强化组件+1（稀有）`);
    }
  }
  if (coin) 写(ctx, PATH.星羽, userId, num(ctx, PATH.星羽, userId, 0) + coin);
  if (exp) 写(ctx, PATH.经验, userId, num(ctx, PATH.经验, userId, 0) + exp);
  if (green) 写(ctx, PATH.道具("绿色血清"), userId, num(ctx, PATH.道具("绿色血清"), userId, 0) + green);
  await replyText(ctx, target, lines.join("\n"), false, {
    title: "废铁兑换",
    buttons: [btn("再兑×1", "使用太空废铁10"), btn("再探索", "探索"), btn("使用道具", "使用道具")]
  });
}

async function handleRank(ctx, target, kind) {
  const map = {
    评分排行榜: { rel: PATH.总评分, label: "总评分" },
    火力排行榜: { rel: PATH.火力, label: "火力" },
    耐久排行榜: { rel: PATH.耐久上限, label: "耐久上限" },
    等级排行榜: { rel: PATH.等级, label: "等级" },
    星羽排行榜: { rel: PATH.星羽, label: "星羽" },
    存款排行榜: { rel: PATH.存款星羽, label: "存款星羽" }
  };
  const cfg = map[kind];
  if (!cfg) {
    if (kind === "签到排行榜") {
      const arr = readJsonArray(ctx, PATH.签到排行(todayYmd()));
      const lines2 = ["排行榜 - 今日签到", "排名  编号  时间"];
      arr.slice(0, 10).forEach((row, i) => {
        lines2.push(`第${RANK_CN[i] ?? i + 1}名 · ${row.编号} · ${row.时间}`);
      });
      await replyText(ctx, target, lines2.join("\n"));
    }
    return;
  }
  if (kind === "评分排行榜") {
    const opened = 读全部(ctx, PATH.是否开号);
    for (const [uid, flag] of Object.entries(opened)) {
      if (String(flag) === "已") refreshScore(ctx, uid);
    }
  }
  const top = topRankEntries(ctx, cfg.rel, 10);
  const lines = [`排行榜 - ${cfg.label}`, "排名  玩家  数值"];
  top.forEach((row, i) => {
    const id = getGameId(ctx, row.userId);
    lines.push(`【第${RANK_CN[i] ?? i + 1}名】编号:${id} → ${row.value}`);
  });
  await replyText(ctx, target, lines.join("\n"));
}
const RANK_COMMANDS = [
  "签到排行榜",
  "评分排行榜",
  "火力排行榜",
  "耐久排行榜",
  "等级排行榜",
  "星羽排行榜",
  "存款排行榜"
];

const FONT = "Segoe UI, Microsoft YaHei, sans-serif";
function escapeXml$1(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function consoleButtons(ctx, userId) {
  const buttons = [
    btnNav("返回首页", "main_menu"),
    btn("返回星甲系统", "星甲系统"),
    btn("星甲控制台", "星甲控制台")
  ];
  if (isRepairing(ctx, userId)) {
    buttons.push(btn("退出修甲", "退出修甲"));
  } else {
    buttons.push(btn("进入修甲", "修复战甲"));
  }
  return buttons;
}
function consoleMdFallback(ctx, userId) {
  const id = getGameId(ctx, userId);
  const nick = str(ctx, PATH.昵称, userId, "未设置");
  const lv = num(ctx, PATH.等级, userId, 1);
  const exp = num(ctx, PATH.经验, userId, 0);
  const fire = num(ctx, PATH.火力, userId, 100);
  const dur = num(ctx, PATH.耐久, userId, 500);
  const durMax = num(ctx, PATH.耐久上限, userId, 500);
  const coin = num(ctx, PATH.星羽, userId, 0);
  const dep = num(ctx, PATH.存款星羽, userId, 0);
  const alliance = getAlliance(ctx, userId);
  const loc = displayPos(ctx, userId);
  const status = str(ctx, PATH.修复状态, userId, "正常");
  const crit = num(ctx, PATH.暴击, userId, 0);
  const dodge = num(ctx, PATH.闪避, userId, 0);
  const score = refreshScore(ctx, userId).score;
  return [
    `- 编号 **${id}** · ${nick}`,
    `- 等级 ${lv} · 经验 ${exp}`,
    `- 火力 ${fire} · 耐久 ${dur}/${durMax}`,
    `- 暴击 ${crit} · 闪避 ${dodge}`,
    `- 总评分 **${score}**`,
    `- 状态 ${status} · 位置 ${loc}`,
    `- 星羽 ${coin} · 存款 ${dep}`,
    `- 联盟 ${alliance}`
  ].join("\n");
}
function progressBar(pct, x, y, w, h, gradId) {
  const filled = Math.max(0, Math.min(1, pct));
  const fw = Math.max(filled > 0 ? 4 : 0, Math.round(w * filled));
  const c0 = filled > 0.7 ? "#0891b2" : filled > 0.3 ? "#d97706" : "#b91c1c";
  const c1 = filled > 0.7 ? "#00ffcc" : filled > 0.3 ? "#fbbf24" : "#f87171";
  const rx = h / 2;
  return `
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${c0}"/><stop offset="100%" stop-color="${c1}"/>
        </linearGradient>
        <linearGradient id="${gradId}_shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
          <stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#0B1220" stroke="#2A3A55" stroke-width="1"/>
      ${fw > 0 ? `<rect x="${x}" y="${y}" width="${fw}" height="${h}" rx="${rx}" fill="url(#${gradId})"/>
                 <rect x="${x + 1}" y="${y + 1}" width="${Math.max(0, fw - 2)}" height="${Math.max(1, h / 2 - 1)}" rx="${rx / 2}" fill="url(#${gradId}_shine)"/>` : ""}`;
}
function itemCard(x, y, w, h, name, qty, glyph, accent) {
  const owned = qty > 0;
  const bg = owned ? "#0B1220" : "#080b12";
  const border = owned ? accent : "#1a2333";
  const nameColor = owned ? "#E2E8F0" : "#475569";
  const qtyColor = owned ? "#F8FAFC" : "#334155";
  const glyphColor = owned ? accent : "#334155";
  const glow = owned ? `filter="url(#glowSoft)"` : "";
  return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${bg}" stroke="${border}" stroke-width="${owned ? 1.5 : 1}" ${glow} opacity="${owned ? 1 : 0.72}"/>
      <text x="${x + 14}" y="${y + 28}" fill="${nameColor}" font-size="15" font-family="${FONT}">${escapeXml$1(name)}</text>
      <text x="${x + w / 2}" y="${y + h / 2 + 8}" text-anchor="middle" fill="${glyphColor}" font-size="28" font-family="${FONT}" opacity="0.55">${glyph}</text>
      <text x="${x + w - 14}" y="${y + h - 14}" text-anchor="end" fill="${qtyColor}" font-size="22" font-family="${FONT}" font-weight="700">x${qty}</text>`;
}
function labelValue(x, y, label, value, valueColor = "#E2E8F0") {
  return `
      <text x="${x}" y="${y}" fill="#64748B" font-size="14" font-family="${FONT}">${escapeXml$1(label)}</text>
      <text x="${x + 72}" y="${y}" fill="${valueColor}" font-size="16" font-family="${FONT}" font-weight="600">${escapeXml$1(value)}</text>`;
}
async function renderConsoleImage(ctx, userId) {
  if (!await probeSharpAvailable()) return null;
  const sharp = await loadSharp();
  const id = getGameId(ctx, userId);
  const nick = str(ctx, PATH.昵称, userId, "未设置");
  const lv = num(ctx, PATH.等级, userId, 1);
  const exp = num(ctx, PATH.经验, userId, 0);
  const needExp = Math.max(1, num(ctx, PATH.升级所需经验, userId, 50));
  const fire = num(ctx, PATH.火力, userId, 100);
  const dur = num(ctx, PATH.耐久, userId, 500);
  const durMax = Math.max(1, num(ctx, PATH.耐久上限, userId, 500));
  const coin = num(ctx, PATH.星羽, userId, 0);
  const dep = num(ctx, PATH.存款星羽, userId, 0);
  const alliance = getAlliance(ctx, userId);
  const loc = displayPos(ctx, userId);
  const status = str(ctx, PATH.修复状态, userId, "正常");
  const streak = num(ctx, PATH.连签次数, userId, 0);
  const totalSign = num(ctx, PATH.总签次数, userId, 0);
  const crit = num(ctx, PATH.暴击, userId, 0);
  const dodge = num(ctx, PATH.闪避, userId, 0);
  const score = refreshScore(ctx, userId).score;
  const rename = num(ctx, PATH.道具("改名次数"), userId, 1);
  const refresh = num(ctx, PATH.道具("刷新卡"), userId, 1);
  const comp = num(ctx, PATH.道具("强化组件"), userId, 0);
  const red = num(ctx, PATH.道具("红色血清"), userId, 0);
  const green = num(ctx, PATH.道具("绿色血清"), userId, 0);
  const scrap = num(ctx, PATH.道具("太空废铁"), userId, 0);
  const depositTime = num(ctx, PATH.存款时间, userId, 1752631715);
  const { interest, hours } = calcDepositInterest(dep, depositTime, nowTs(), alliance);
  const allyKey = alliance === "未知" ? "休闲至上" : alliance;
  const allyLv = num(ctx, PATH.联盟记录(allyKey), "等级", 1);
  const allyPop = num(ctx, PATH.联盟记录(allyKey), "总人数", 0);
  const allyBoom = num(ctx, PATH.联盟记录(allyKey), "繁荣度", 0);
  const bFire = num(ctx, PATH.联盟加成火力, userId, 0);
  const bDur = num(ctx, PATH.联盟加成耐久, userId, 0);
  const bCrit = num(ctx, PATH.联盟加成暴击, userId, 0);
  const bDodge = num(ctx, PATH.联盟加成闪避, userId, 0);
  const repairing = status === "正在修甲";
  const statusDot = repairing ? "#FBBF24" : "#00FFCC";
  const statusLabel = repairing ? "修甲中" : "正常";
  const durPct = dur / durMax;
  const expPct = Math.min(1, exp / needExp);
  const w = 900;
  const h = 1040;
  const items = [
    { name: "改名卡", qty: rename, glyph: "✎", accent: "#22D3EE" },
    { name: "刷新卡", qty: refresh, glyph: "↻", accent: "#38BDF8" },
    { name: "强化组件", qty: comp, glyph: "⬡", accent: "#A78BFA" },
    { name: "红色血清", qty: red, glyph: "◆", accent: "#F87171" },
    { name: "绿色血清", qty: green, glyph: "◆", accent: "#34D399" },
    { name: "太空废铁", qty: scrap, glyph: "▣", accent: "#94A3B8" }
  ];
  const gridX = 48;
  const gridY = 720;
  const cellW = 260;
  const cellH = 118;
  const gapX = 16;
  const gapY = 14;
  const itemSvg = items.map((it, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return itemCard(
      gridX + col * (cellW + gapX),
      gridY + row * (cellH + gapY),
      cellW,
      cellH,
      it.name,
      it.qty,
      it.glyph,
      it.accent
    );
  }).join("");
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="pageBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B0E17"/>
      <stop offset="50%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#151D2B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#151D2B"/>
      <stop offset="100%" stop-color="#0F1623"/>
    </linearGradient>
    <linearGradient id="accentLine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00FFCC" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#0891B2" stop-opacity="0.2"/>
    </linearGradient>
    <filter id="glowCyan" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glowSoft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.8" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <pattern id="gridDots" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.8" fill="#1E293B" opacity="0.55"/>
    </pattern>
  </defs>

  <!-- 底 -->
  <rect width="100%" height="100%" fill="url(#pageBg)"/>
  <rect width="100%" height="100%" fill="url(#gridDots)" opacity="0.45"/>
  <circle cx="820" cy="60" r="180" fill="#00FFCC" opacity="0.04"/>
  <circle cx="40" cy="980" r="160" fill="#38BDF8" opacity="0.04"/>

  <!-- 顶部标题栏 -->
  <rect x="28" y="28" width="844" height="96" rx="14" fill="url(#headerGrad)" stroke="#2A3A55" stroke-width="1"/>
  <rect x="28" y="28" width="5" height="96" rx="2" fill="url(#accentLine)" filter="url(#glowCyan)"/>
  <text x="56" y="68" fill="#F8FAFC" font-size="30" font-family="${FONT}" font-weight="700">星甲控制台</text>
  <text x="56" y="98" fill="#94A3B8" font-size="16" font-family="${FONT}">#${escapeXml$1(id)} · ${escapeXml$1(nick)}</text>

  <!-- 状态胶囊 -->
  <rect x="700" y="52" width="150" height="48" rx="24" fill="#0B1220" stroke="#2A3A55" stroke-width="1"/>
  <circle cx="728" cy="76" r="6" fill="${statusDot}" filter="url(#glowCyan)"/>
  <circle cx="728" cy="76" r="10" fill="${statusDot}" opacity="0.22"/>
  <text x="748" y="82" fill="#E2E8F0" font-size="16" font-family="${FONT}" font-weight="600">${escapeXml$1(statusLabel)}</text>

  <!-- 战斗 + 资产 合并大卡 -->
  <rect x="28" y="144" width="844" height="300" rx="14" fill="url(#cardGrad)" stroke="#2A3A55" stroke-width="1"/>
  <line x1="450" y1="168" x2="450" y2="420" stroke="#1E3A4A" stroke-width="1"/>

  <!-- 左：战斗 -->
  <text x="52" y="178" fill="#00FFCC" font-size="15" font-family="${FONT}" font-weight="700" letter-spacing="1">战斗数据</text>
  <line x1="52" y1="188" x2="200" y2="188" stroke="#1E3A4A" stroke-width="1"/>
  ${labelValue(52, 220, "等级", String(lv), "#F8FAFC")}
  ${labelValue(250, 220, "经验", String(exp), "#94A3B8")}
  ${labelValue(52, 252, "火力", String(fire), "#FF8A3D")}
  ${labelValue(250, 252, "暴击", String(crit), "#00FFCC")}
  ${labelValue(52, 284, "闪避", String(dodge), "#38BDF8")}
  ${labelValue(250, 284, "评分", String(score), "#FBBF24")}

  <text x="52" y="324" fill="#64748B" font-size="13" font-family="${FONT}">耐久</text>
  <text x="420" y="324" text-anchor="end" fill="#94A3B8" font-size="13" font-family="${FONT}">${dur} / ${durMax}</text>
  ${progressBar(durPct, 52, 334, 368, 10, "durGrad")}

  <text x="52" y="372" fill="#64748B" font-size="13" font-family="${FONT}">经验进度</text>
  <text x="420" y="372" text-anchor="end" fill="#94A3B8" font-size="13" font-family="${FONT}">${exp} / ${needExp}</text>
  ${progressBar(expPct, 52, 382, 368, 8, "expGrad")}

  <text x="52" y="420" fill="#64748B" font-size="13" font-family="${FONT}">位置 ${escapeXml$1(loc)} · 连签 ${streak} · 总签 ${totalSign}</text>

  <!-- 右：资产 -->
  <text x="480" y="178" fill="#00FFCC" font-size="15" font-family="${FONT}" font-weight="700" letter-spacing="1">资产</text>
  <line x1="480" y1="188" x2="600" y2="188" stroke="#1E3A4A" stroke-width="1"/>
  <text x="480" y="236" fill="#64748B" font-size="14" font-family="${FONT}">星羽</text>
  <text x="480" y="278" fill="#FDE68A" font-size="36" font-family="${FONT}" font-weight="700" filter="url(#glowSoft)">${coin}</text>
  ${labelValue(480, 320, "存款", String(dep), "#E2E8F0")}
  ${labelValue(480, 352, "利息", `${Math.floor(interest)} · ${hours.toFixed(1)}h`, "#A5B4FC")}
  ${labelValue(480, 384, "联盟", alliance, "#CBD5E1")}
  <text x="480" y="420" fill="#475569" font-size="12" font-family="${FONT}">机甲能源与仓储状态</text>

  <!-- 联盟情报 -->
  <rect x="28" y="464" width="844" height="120" rx="14" fill="url(#cardGrad)" stroke="#2A3A55" stroke-width="1"/>
  <text x="52" y="498" fill="#00FFCC" font-size="15" font-family="${FONT}" font-weight="700" letter-spacing="1">联盟情报</text>
  <text x="52" y="532" fill="#F8FAFC" font-size="18" font-family="${FONT}" font-weight="700">${escapeXml$1(alliance)}</text>
  <text x="220" y="532" fill="#94A3B8" font-size="15" font-family="${FONT}">Lv${allyLv}</text>
  <text x="300" y="532" fill="#94A3B8" font-size="15" font-family="${FONT}">人数 ${allyPop}</text>
  <text x="420" y="532" fill="#94A3B8" font-size="15" font-family="${FONT}">繁荣 ${allyBoom}</text>
  <text x="52" y="564" fill="#00FFCC" font-size="14" font-family="${FONT}" opacity="0.85">火力+${bFire} · 耐久+${bDur} · 暴击+${bCrit} · 闪避+${bDodge}</text>

  <!-- 背包 -->
  <rect x="28" y="604" width="844" height="408" rx="14" fill="url(#cardGrad)" stroke="#2A3A55" stroke-width="1"/>
  <text x="52" y="642" fill="#00FFCC" font-size="15" font-family="${FONT}" font-weight="700" letter-spacing="1">背包道具</text>
  <text x="848" y="642" text-anchor="end" fill="#475569" font-size="12" font-family="${FONT}">拥有物品带微光边框</text>
  <line x1="52" y1="656" x2="848" y2="656" stroke="#1E3A4A" stroke-width="1"/>
  ${itemSvg}

  <!-- 底栏装饰 -->
  <text x="450" y="1024" text-anchor="middle" fill="#334155" font-size="11" font-family="${FONT}">MECH / CONSOLE · GF_mk</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function sendConsole(ctx, target, userId) {
  ensureAllianceBonusesApplied(ctx, userId);
  const buttons = consoleButtons(ctx, userId);
  const png = await renderConsoleImage(ctx, userId);
  if (png) {
    const up = await upload({ buffer: png, filename: `tc-console-${Date.now()}.png` });
    if (up.code === 0 && up.data?.url) {
      await replyText(
        ctx,
        target,
        [
          md图片行(up.data.url, { alt: "控制台", 宽: 900, 高: 1040 }),
          "",
          "提示：想干嘛直接点下面按钮。"
        ].join("\n"),
        false,
        {
          title: "星甲控制台",
          buttons
        }
      );
      return;
    }
  }
  await replyText(ctx, target, consoleMdFallback(ctx, userId), false, {
    title: "星甲控制台",
    buttons
  });
}
async function tryHandleConsoleCommand(ctx, target, userId, msg) {
  const cmds = ["星甲控制台", "/星甲控制台", "/星甲控台", "星甲控台", "/控制台", "控制台"];
  if (!cmds.includes(msg)) return false;
  if (str(ctx, PATH.是否开号, userId, "未") !== "已") {
    await replyNeedRegister(ctx, target);
    return true;
  }
  await sendConsole(ctx, target, userId);
  return true;
}

const SHOP_ITEMS = ["改名卡", "强化组件", "刷新卡"];
const DEFAULT_PRICES = {
  改名卡: 1e3,
  强化组件: 2500,
  刷新卡: 500
};
function escapeXml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function shopPrices(ctx) {
  const out = { ...DEFAULT_PRICES };
  for (const item of SHOP_ITEMS) {
    const p = Number(读(ctx, PATH.商店价格, item, DEFAULT_PRICES[item])) || DEFAULT_PRICES[item];
    out[item] = p;
    写(ctx, PATH.商店价格, item, p);
  }
  return out;
}
function itemStorageKey(item) {
  return item === "改名卡" ? "改名次数" : item;
}
function itemCount(ctx, userId, item) {
  const key = itemStorageKey(item);
  const fb = item === "改名卡" || item === "刷新卡" ? 1 : 0;
  return num(ctx, PATH.道具(key), userId, fb);
}
async function renderShopImage(_ctx, prices) {
  if (!await probeSharpAvailable()) return null;
  const sharp = await loadSharp();
  const w = 900;
  const h = 480;
  const rows = SHOP_ITEMS.map((item, i) => {
    const y = 140 + i * 100;
    return `
            <rect x="40" y="${y}" width="820" height="84" rx="12" fill="#0f766e" opacity="0.35"/>
            <text x="70" y="${y + 36}" fill="#5eead4" font-size="28" font-family="sans-serif" font-weight="700">${escapeXml(item)}</text>
            <text x="70" y="${y + 68}" fill="#cbd5e1" font-size="22" font-family="sans-serif">${prices[item]} 星羽</text>`;
  }).join("");
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#0b1220"/>
                <stop offset="100%" stop-color="#0f172a"/>
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <text x="40" y="70" fill="#5eead4" font-size="36" font-family="sans-serif" font-weight="700">暗域商锋 · 商店</text>
        <text x="40" y="110" fill="#64748b" font-size="20" font-family="sans-serif">点下方蓝字可填入购买指令</text>
        ${rows}
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function sendShopMenu(ctx, target) {
  const prices = shopPrices(ctx);
  const png = await renderShopImage(ctx, prices);
  const footer = "提示：点按钮买 1 个；点蓝字可改数量再发。";
  let body = footer;
  if (png) {
    const up = await upload({ buffer: png, filename: `tc-shop-${Date.now()}.png` });
    if (up.code === 0 && up.data?.url) {
      body = [md图片行(up.data.url, { alt: "商店", 宽: 900, 高: 480 }), "", footer].join("\n");
    }
  }
  await replyText(ctx, target, body, false, {
    title: "暗域商锋 · 商店",
    buttons: [
      btn("改名卡×1", "购买#改名卡#1"),
      btn("强化×1", "购买#强化组件#1"),
      btn("刷新卡×1", "购买#刷新卡#1"),
      btn("控制台", "星甲控制台")
    ],
    cmds: [
      cmd("购买#改名卡#1"),
      cmd("购买#强化组件#1"),
      cmd("购买#刷新卡#1")
    ],
    keepCmds: true
  });
}
async function tryHandleShopPurchase(ctx, target, userId, msg) {
  const m = msg.match(/^(?:购买|买)#(改名卡|强化组件|刷新卡)#([0-9]+)$/);
  if (!m) return false;
  if (!ensureRegistered(ctx, userId)) {
    await replyNeedRegister(ctx, target);
    return true;
  }
  const item = m[1];
  const qty = Number(m[2]) || 0;
  const gameId = getGameId(ctx, userId);
  const prices = shopPrices(ctx);
  const unit = prices[item];
  const cost = unit * qty;
  const wallet = num(ctx, PATH.星羽, userId, 0);
  if (qty <= 0) {
    await replyText(ctx, target, [`编号:${gameId}`, "购买内容数量不得为0"].join("\n"));
    return true;
  }
  if (cost > wallet) {
    await replyText(ctx, target, [`编号:${gameId}`, "你的星羽不足以本次购买", `需求:${cost}`].join("\n"));
    return true;
  }
  const storage = itemStorageKey(item);
  const cur = itemCount(ctx, userId, item);
  写(ctx, PATH.道具(storage), userId, cur + qty);
  写(ctx, PATH.星羽, userId, wallet - cost);
  await replyText(
    ctx,
    target,
    [`编号:${gameId}`, `已购入【${qty}】个/张/块【${item}】`, `耗资【${cost}】`].join("\n"),
    false,
    {
      title: "购买成功",
      buttons: [
        btn("再逛商店", "商店"),
        btn("使用道具", "使用道具"),
        btn("控制台", "星甲控制台"),
        btn("改名卡×1", "购买#改名卡#1"),
        btn("强化×1", "购买#强化组件#1"),
        btn("刷新卡×1", "购买#刷新卡#1")
      ],
      cmds: [
        cmd("购买#改名卡#1"),
        cmd("购买#强化组件#1"),
        cmd("购买#刷新卡#1")
      ],
      keepCmds: true
    }
  );
  return true;
}
async function tryHandleShopCommand(ctx, target, msg) {
  if (msg !== "商店" && msg !== "暗域商锋" && msg !== "买东西") return false;
  await sendShopMenu(ctx, target);
  return true;
}

const DAILY_QUESTS = [
  { key: "签到", name: "每日巡游", need: 1, rewardCoin: 80, rewardExp: 20 },
  { key: "探索", name: "探索 3 次", need: 3, rewardCoin: 120, rewardExp: 30 },
  { key: "挑战", name: "挑战 1 次", need: 1, rewardCoin: 100, rewardExp: 25 },
  { key: "升级", name: "升级 1 次", need: 1, rewardCoin: 150, rewardExp: 40 },
  { key: "存款", name: "存款 1 次", need: 1, rewardCoin: 60, rewardExp: 15 }
];
function claimedMap(ctx, userId) {
  const raw = 读(ctx, PATH.任务已领(todayYmd()), userId, {});
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw || "{}");
    } catch {
      return {};
    }
  }
  return { ...raw };
}
function setClaimed(ctx, userId, key) {
  const m = claimedMap(ctx, userId);
  m[key] = 1;
  写(ctx, PATH.任务已领(todayYmd()), userId, m);
}
async function handleDailyQuestPanel(ctx, target, userId) {
  if (!ensureRegistered(ctx, userId)) {
    await replyNeedRegister(ctx, target);
    return;
  }
  const claimed = claimedMap(ctx, userId);
  const lines = ["今日目标（完成可领奖）：", ""];
  for (const q of DAILY_QUESTS) {
    const cur = Math.min(getTaskCount(ctx, userId, q.key), q.need);
    const done = cur >= q.need;
    const got = !!claimed[q.key];
    const tag = got ? "已领" : done ? "可领" : "进行中";
    lines.push(`${q.name} ${cur}/${q.need} · ${tag} · 奖 ${q.rewardCoin}星羽+${q.rewardExp}经验`);
  }
  lines.push("", "提示：点「一键领奖」领取全部可领任务。");
  await replyText(ctx, target, lines.join("\n"), false, {
    title: "每日任务",
    buttons: [
      btn("一键领奖", "领取任务奖励"),
      btn("去巡游", "签到"),
      btn("去探索", "探索"),
      btn("匹配挑战", "匹配挑战")
    ]
  });
}
async function handleClaimDailyQuests(ctx, target, userId) {
  if (!ensureRegistered(ctx, userId)) {
    await replyNeedRegister(ctx, target);
    return;
  }
  const gameId = getGameId(ctx, userId);
  const claimed = claimedMap(ctx, userId);
  let coin = 0;
  let exp = 0;
  const got = [];
  for (const q of DAILY_QUESTS) {
    if (claimed[q.key]) continue;
    if (getTaskCount(ctx, userId, q.key) < q.need) continue;
    setClaimed(ctx, userId, q.key);
    coin += q.rewardCoin;
    exp += q.rewardExp;
    got.push(q.name);
  }
  if (!got.length) {
    await replyText(ctx, target, [`编号:${gameId}`, "暂无可领奖励", "先把进行中的任务做完。"].join("\n"), false, {
      title: "每日任务",
      buttons: [btn("查看任务", "每日任务"), btn("去探索", "探索")]
    });
    return;
  }
  写(ctx, PATH.星羽, userId, num(ctx, PATH.星羽, userId, 0) + coin);
  写(ctx, PATH.经验, userId, num(ctx, PATH.经验, userId, 0) + exp);
  await replyText(
    ctx,
    target,
    [`编号:${gameId}`, `已领取：${got.join("、")}`, `星羽+${coin}`, `经验+${exp}`].join("\n"),
    false,
    {
      title: "任务奖励",
      buttons: [btn("查看任务", "每日任务"), btn("升级", "升级"), btn("控制台", "星甲控制台")]
    }
  );
}

function weekKey() {
  const d = /* @__PURE__ */ new Date();
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - oneJan.getTime()) / 864e5 + oneJan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}
function ensureWeek(ctx) {
  const wk = weekKey();
  const cur = str(ctx, PATH.联盟战周键, "当前", "");
  if (cur !== wk) {
    写(ctx, PATH.联盟战周键, "当前", wk);
    for (const name of ALLIANCE_NAMES) {
      写(ctx, PATH.联盟战胜场, name, 0);
    }
  }
  return wk;
}
function recordAllianceWarWin(ctx, userId) {
  const alliance = getAlliance(ctx, userId);
  if (alliance === "未知") return;
  ensureWeek(ctx);
  写(ctx, PATH.联盟战胜场, alliance, num(ctx, PATH.联盟战胜场, alliance, 0) + 1);
}
async function handleAllianceWarPanel(ctx, target, userId) {
  if (!ensureRegistered(ctx, userId)) {
    await replyNeedRegister(ctx, target);
    return;
  }
  const wk = ensureWeek(ctx);
  const rows = ALLIANCE_NAMES.map((name) => ({
    name,
    wins: num(ctx, PATH.联盟战胜场, name, 0)
  })).sort((a, b) => b.wins - a.wins);
  const mine = getAlliance(ctx, userId);
  const lines = [
    `本周 ${wk}`,
    "规则：跨盟挑战获胜，给己方联盟 +1 胜场。",
    "周榜第 1 的联盟成员可领奖（每人每周一次）。",
    ""
  ];
  rows.forEach((r, i) => {
    const mark = r.name === mine ? " ←你" : "";
    lines.push(`${i + 1}. ${r.name} · 胜场 ${r.wins}${mark}`);
  });
  await replyText(ctx, target, lines.join("\n"), false, {
    title: "联盟战",
    buttons: [
      btn("领取周奖", "领取联盟战奖励"),
      btn("匹配挑战", "匹配挑战"),
      btn("我的联盟", "查看联盟"),
      btn("控制台", "星甲控制台")
    ]
  });
}
async function handleClaimAllianceWarReward(ctx, target, userId) {
  if (!ensureRegistered(ctx, userId)) {
    await replyNeedRegister(ctx, target);
    return;
  }
  const gameId = getGameId(ctx, userId);
  const wk = ensureWeek(ctx);
  const mine = getAlliance(ctx, userId);
  if (mine === "未知") {
    await replyText(ctx, target, [`编号:${gameId}`, "先加入联盟才能领奖。"].join("\n"), false, {
      buttons: [btn("去入盟", "联盟系统")]
    });
    return;
  }
  const rows = ALLIANCE_NAMES.map((name) => ({
    name,
    wins: num(ctx, PATH.联盟战胜场, name, 0)
  })).sort((a, b) => b.wins - a.wins);
  const top = rows[0];
  if (!top || top.wins <= 0) {
    await replyText(ctx, target, [`编号:${gameId}`, "本周还没有有效胜场。"].join("\n"));
    return;
  }
  if (top.name !== mine) {
    await replyText(
      ctx,
      target,
      [`编号:${gameId}`, `本周领先是【${top.name}】`, "只有领先联盟成员可领奖。"].join("\n"),
      false,
      { buttons: [btn("联盟战", "联盟战"), btn("匹配挑战", "匹配挑战")] }
    );
    return;
  }
  const claimKey = `${wk}:${userId}`;
  if (str(ctx, PATH.联盟战已领, claimKey, "") === "是") {
    await replyText(ctx, target, [`编号:${gameId}`, "本周奖励已领取。"].join("\n"));
    return;
  }
  const coin = 300 + top.wins * 20;
  const exp = 80 + top.wins * 5;
  写(ctx, PATH.联盟战已领, claimKey, "是");
  写(ctx, PATH.星羽, userId, num(ctx, PATH.星羽, userId, 0) + coin);
  写(ctx, PATH.经验, userId, num(ctx, PATH.经验, userId, 0) + exp);
  await replyText(
    ctx,
    target,
    [`编号:${gameId}`, `【${mine}】本周领先！`, `星羽+${coin}`, `经验+${exp}`].join("\n"),
    false,
    {
      title: "联盟战奖励",
      buttons: [btn("控制台", "星甲控制台"), btn("联盟战", "联盟战")]
    }
  );
}

let cache = null;
function normalizeNick(text) {
  return String(text ?? "").toLowerCase().replace(/[\s\u200b\u200c\u200d\ufeff_\-·•.。,，、|｜/\\'"`~!@#$%^&*()+=\[\]{}<>?？:：;；]/g, "");
}
function loadBank$1(ctx) {
  const file = path.join(tcPluginDataRoot(ctx), "违禁昵称.json");
  try {
    const mtime = fs.statSync(file).mtimeMs;
    if (cache && cache.mtime === mtime) return cache;
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const reserved = /* @__PURE__ */ new Set();
    const words = [];
    for (const [category, list] of Object.entries(raw)) {
      if (category === "说明" || !Array.isArray(list)) continue;
      for (const item of list) {
        const word = String(item ?? "").trim();
        if (!word) continue;
        if (category === "保留名") {
          reserved.add(word.toLowerCase());
          reserved.add(normalizeNick(word));
        }
        words.push({ category, word, norm: normalizeNick(word) });
      }
    }
    cache = { mtime, reserved, words: words.filter((w) => w.norm.length > 0) };
    return cache;
  } catch {
    return cache ?? {
      mtime: 0,
      reserved: /* @__PURE__ */ new Set(["未设置"]),
      words: [{ category: "保留名", word: "未设置", norm: "未设置" }]
    };
  }
}
function checkNicknameBan(ctx, nick) {
  const bank = loadBank$1(ctx);
  if (!bank) return { ok: true };
  const raw = String(nick ?? "").trim();
  const lower = raw.toLowerCase();
  const norm = normalizeNick(raw);
  if (bank.reserved.has(lower) || bank.reserved.has(norm)) {
    return { ok: false, category: "保留名", word: raw };
  }
  for (const w of bank.words) {
    if (w.category === "保留名") continue;
    if (!w.norm) continue;
    if (w.norm.length < 2) {
      if (norm === w.norm) return { ok: false, category: w.category, word: w.word };
      continue;
    }
    if (norm.includes(w.norm)) {
      return { ok: false, category: w.category, word: w.word };
    }
  }
  return { ok: true };
}

function afterPrefix(text, prefix) {
  if (!text.startsWith(prefix)) return null;
  return text.slice(prefix.length).trim();
}
async function handleRegister(ctx, target, userId) {
  if (ensureRegistered(ctx, userId)) {
    const id = getGameId(ctx, userId);
    await replyText(
      ctx,
      target,
      [`你已开号，编号 ${id}`, "今天还没巡游的话，点一下就行。"].join("\n"),
      false,
      {
        title: "星甲账号",
        buttons: [
          btn("每日巡游", "签到"),
          btn("星甲控制台", "星甲控制台"),
          btn("去探索", "探索"),
          btnNav("回大厅", "main_menu")
        ]
      }
    );
    return;
  }
  const total = num(ctx, PATH.账号总数, "数量", 0);
  const newId = total + 1;
  const roll = rollStarterStats();
  写(ctx, PATH.是否开号, userId, "已");
  写(ctx, PATH.游戏ID, userId, newId);
  写(ctx, PATH.ID绑定, String(newId), userId);
  写(ctx, PATH.账号总数, "数量", newId);
  写(ctx, PATH.等级, userId, 1);
  写(ctx, PATH.经验, userId, 0);
  写(ctx, PATH.星羽, userId, roll.星羽);
  写(ctx, PATH.火力, userId, roll.火力);
  写(ctx, PATH.耐久上限, userId, roll.耐久上限);
  写(ctx, PATH.耐久, userId, roll.耐久);
  写(ctx, PATH.暴击, userId, roll.暴击);
  写(ctx, PATH.闪避, userId, roll.闪避);
  写(ctx, PATH.昵称, userId, "未设置");
  写(ctx, PATH.创号时间, userId, formatDateTime());
  写(ctx, PATH.时空位置, userId, "深渊");
  写(ctx, PATH.位置, userId, "深渊");
  const score = refreshScore(ctx, userId).score;
  await replyText(
    ctx,
    target,
    [
      `开号成功，编号 ${newId}`,
      "",
      `星羽 ${roll.星羽} · 火力 ${roll.火力}`,
      `耐久 ${roll.耐久}/${roll.耐久上限}`,
      `暴击 ${roll.暴击} · 闪避 ${roll.闪避}`,
      `总评分 ${score}`,
      "",
      "提示：初始属性看运气，先去每日巡游。"
    ].join("\n"),
    false,
    {
      title: "装甲完成",
      buttons: [
        btn("每日巡游", "签到"),
        btn("星甲控制台", "星甲控制台"),
        btn("挑个联盟", "联盟系统")
      ],
      cmds: [cmd("更改昵称")],
      keepCmds: true
    }
  );
}
async function handleCheckin(ctx, event, target, userId) {
  if (!ensureRegistered(ctx, userId)) {
    await replyNeedRegister(ctx, target);
    return;
  }
  const gameId = getGameId(ctx, userId);
  const today = todayYmd();
  const signed = str(ctx, PATH.签到日期, userId, "");
  const { 渠道 } = msgSource(event);
  if (signed === today) {
    const bigRank = str(ctx, PATH.签到全服排名(today), userId, "未知");
    await replyText(
      ctx,
      target,
      [
        `编号:${gameId}`,
        "今天已经巡游过了。",
        `全服排名:${bigRank}`,
        "",
        "提示：去探索攒道具，或打开控制台看看状态。"
      ].join("\n"),
      false,
      {
        title: "今日已巡游",
        buttons: [
          btn("去探索", "探索"),
          btn("星甲控制台", "星甲控制台"),
          btn("升级", "升级"),
          btnNav("回大厅", "main_menu")
        ]
      }
    );
    return;
  }
  const total = num(ctx, PATH.总签次数, userId, 0);
  const streakBefore = num(ctx, PATH.连签次数, userId, 0);
  const lastTs = num(ctx, PATH.上次签到, userId, 0);
  const now = nowTs();
  写(ctx, PATH.总签次数, userId, total + 1);
  写(ctx, PATH.签到日期, userId, today);
  写(ctx, PATH.签到详细, userId, formatDateTime(now));
  写(ctx, PATH.上次签到, userId, now);
  let signCoin = randInt(50, 150);
  let signExp = randInt(30, 50);
  const alliance = getAlliance(ctx, userId);
  let bonusNote = "";
  if (alliance === "蚀月獠牙") {
    signExp = Math.floor(signExp * 1.5);
    bonusNote = "(蚀月獠牙加成)";
  } else if (alliance === "暗域商锋") {
    signCoin = Math.floor(signCoin * 1.5);
    bonusNote = "(暗域商锋加成)";
  }
  const wallet = num(ctx, PATH.星羽, userId, 0);
  const exp = num(ctx, PATH.经验, userId, 0);
  写(ctx, PATH.星羽, userId, wallet + signCoin);
  写(ctx, PATH.经验, userId, exp + signExp);
  const { 群号 } = msgSource(event);
  const serverCount = num(ctx, PATH.签到全服, today, 0) + 1;
  const channelCount = num(ctx, PATH.签到渠道(渠道, 群号), today, 0) + 1;
  写(ctx, PATH.签到全服, today, serverCount);
  写(ctx, PATH.签到渠道(渠道, 群号), today, channelCount);
  写(ctx, PATH.签到个人渠道(today), userId, 渠道);
  写(ctx, PATH.签到个人排名(渠道, today), userId, channelCount);
  写(ctx, PATH.签到全服排名(today), userId, serverCount);
  const lines = [
    "巡游成功",
    `编号:${gameId}`,
    `获得星羽:${signCoin}`,
    `获得经验:${signExp}`
  ];
  if (bonusNote) lines.push(bonusNote);
  lines.push(`全服排名:${serverCount}`, `${渠道}排名:${channelCount}`);
  if (lastTs === 0) {
    lines.push("提示：连续几天来巡游，会有连签加成。");
    写(ctx, PATH.连签次数, userId, 1);
  } else {
    const gap = now - lastTs;
    if (gap > 172800) {
      lines.push("连签断了，从今天重新算。");
      写(ctx, PATH.连签次数, userId, 1);
    } else {
      const streak = streakBefore + 1;
      lines.push(`连签 ${streak} 天`);
      写(ctx, PATH.连签次数, userId, streak);
    }
  }
  incTask(ctx, userId, "签到");
  const rankFile = PATH.签到排行(today);
  const rankArr = readJsonArray(ctx, rankFile);
  rankArr.push({ 用户: userId, 编号: gameId, 时间: formatDateTime(now) });
  writeJsonArray(ctx, rankFile, rankArr);
  lines.push("提示：星羽能存银行生息，耐久够就去探索。");
  await replyText(ctx, target, lines.join("\n"), false, {
    title: "巡游结算",
    buttons: [
      btn("去探索", "探索"),
      btn("升级", "升级"),
      btn("星甲控制台", "星甲控制台"),
      btn("存银行", "银行系统")
    ]
  });
}
async function handleExplore(ctx, target, userId) {
  const gameId = getGameId(ctx, userId);
  if (isRepairing(ctx, userId)) {
    await replyText(ctx, target, [`编号:${gameId}`, "你正在修复战甲，请先退出修甲"].join("\n"), false, {
      title: "无法探索",
      buttons: [btn("退出修甲", "退出修甲"), btn("星甲控制台", "星甲控制台")]
    });
    return;
  }
  const dur = num(ctx, PATH.耐久, userId, 500);
  if (dur < EXPLORE_DUR_MIN) {
    await replyText(
      ctx,
      target,
      [`编号:${gameId}`, `耐久不足 ${EXPLORE_DUR_MIN}，请先修复战甲`].join("\n"),
      false,
      {
        title: "无法探索",
        buttons: [btn("修复战甲", "修复战甲"), btn("绿血清×1", "使用绿色血清1")]
      }
    );
    return;
  }
  const outcome = rollExploreOutcome();
  const durCost = Math.min(Math.max(outcome.durCost, EXPLORE_DUR_MIN), dur);
  incTask(ctx, userId, "探索");
  const nth = getTaskCount(ctx, userId, "探索");
  写(ctx, PATH.耐久, userId, dur - durCost);
  refreshScore(ctx, userId);
  const { kind, qty, eventName, isSpecialEvent } = outcome;
  const cur = num(ctx, PATH.道具(kind), userId, 0);
  写(ctx, PATH.道具(kind), userId, cur + qty);
  let gainedExp = 0;
  const baseRange = exploreBaseExpRange(nth);
  if (baseRange) {
    gainedExp += randInt(baseRange.lo, baseRange.hi);
  }
  if (isSpecialEvent) {
    gainedExp += randInt(10, 22);
  }
  const lines = [`编号:${gameId}`, `耐久-${durCost}`, `${kind}+${qty}`];
  if (eventName) lines.push(eventName);
  if (gainedExp > 0) {
    const exp = num(ctx, PATH.经验, userId, 0);
    写(ctx, PATH.经验, userId, exp + gainedExp);
    lines.push(`经验+${gainedExp}`);
  } else if (nth > EXPLORE_XP_SOFT_CAP) {
    lines.push("今日常规探索经验已耗尽");
  } else {
    lines.push("经验+0");
  }
  if (nth < EXPLORE_XP_SOFT_CAP) {
    lines.push(`提示：今日第 ${nth}/${EXPLORE_XP_SOFT_CAP} 次；掉落量 1/5/10/15/20，越多越稀有。`);
  } else if (isSpecialEvent) {
    lines.push("提示：今日常规经验段已走完，本次靠事件拿到了经验。");
  } else {
    lines.push("提示：今日常规经验段已走完；稀有事件仍给经验。");
  }
  await replyText(ctx, target, lines.join("\n"), false, {
    title: "探索收获",
    buttons: [
      btn("再探索", "探索"),
      btn("升级", "升级"),
      btn("使用道具", "使用道具"),
      btn("修甲", "修复战甲")
    ]
  });
}
async function handleRepairStart(ctx, target, userId) {
  const gameId = getGameId(ctx, userId);
  const dur = num(ctx, PATH.耐久, userId, 500);
  const max = num(ctx, PATH.耐久上限, userId, 500);
  const speed = num(ctx, PATH.修复速度, userId, 100);
  if (dur >= max) {
    await replyText(ctx, target, [`编号:${gameId}`, "你的耐久已满，无需修复"].join("\n"));
    return;
  }
  const need = max - dur;
  const mins = need / speed;
  const eta = formatDateTime(nowTs() + Math.ceil(mins * 60));
  写(ctx, PATH.修复时间, userId, nowTs());
  写(ctx, PATH.修复状态, userId, "正在修甲");
  await replyText(
    ctx,
    target,
    [
      `编号:${gameId}`,
      "已开始修甲，期间不能探索/挑战。",
      `预计完成：${eta}`,
      "提示：修好了点「退出修甲」结算耐久。"
    ].join("\n"),
    false,
    {
      title: "修复战甲",
      buttons: [btn("退出修甲", "退出修甲"), btn("星甲控制台", "星甲控制台")]
    }
  );
}
async function handleRepairExit(ctx, target, userId) {
  const gameId = getGameId(ctx, userId);
  if (!isRepairing(ctx, userId)) {
    await replyText(ctx, target, [`编号:${gameId}`, "你不在修甲状态哦～"].join("\n"));
    return;
  }
  incTask(ctx, userId, "修复战甲");
  const start = num(ctx, PATH.修复时间, userId, nowTs());
  const speed = num(ctx, PATH.修复速度, userId, 100);
  const max = num(ctx, PATH.耐久上限, userId, 500);
  const dur = num(ctx, PATH.耐久, userId, 500);
  const mins = Math.floor((nowTs() - start) / 60);
  const healed = mins * speed;
  const total = dur + healed;
  if (total >= max) {
    写(ctx, PATH.耐久, userId, max);
    写(ctx, PATH.修复状态, userId, "正常");
    refreshScore(ctx, userId);
    await replyText(
      ctx,
      target,
      [`编号:${gameId}`, "耐久恢复至耐久上限", `耐久:${max}/${max}`, `速度:${speed}/1min`].join("\n")
    );
    return;
  }
  写(ctx, PATH.耐久, userId, total);
  写(ctx, PATH.修复状态, userId, "正常");
  refreshScore(ctx, userId);
  await replyText(
    ctx,
    target,
    [
      `编号:${gameId}`,
      `修复耐久+${healed}`,
      `当前耐久:${total}/${max}`,
      `速度:${speed}/1min`
    ].join("\n")
  );
}
async function handleUpgrade(ctx, target, userId) {
  const gameId = getGameId(ctx, userId);
  const exp = num(ctx, PATH.经验, userId, 0);
  const lv = num(ctx, PATH.等级, userId, 1);
  const needExp = num(ctx, PATH.升级所需经验, userId, 50);
  const pity = num(ctx, PATH.升级概率, userId, 0);
  if (lv >= LEVEL_CAP) {
    await replyText(
      ctx,
      target,
      [`编号:${gameId}`, `已达等级上限 ${LEVEL_CAP}`, "可发送【转生】重置等级，保留永久火力加成。"].join("\n"),
      false,
      {
        title: "等级上限",
        buttons: [btn("转生", "转生"), btn("控制台", "星甲控制台")]
      }
    );
    return;
  }
  if (exp < needExp || exp <= 0) {
    await replyText(
      ctx,
      target,
      [`编号:${gameId}`, "你的经验不足哦～", `目前等级:${lv}`, `升级所需:${needExp}`].join("\n")
    );
    return;
  }
  incTask(ctx, userId, "升级");
  const roll = randInt(0, 100);
  const threshold = 30 + pity;
  if (roll < threshold) {
    写(ctx, PATH.升级概率, userId, pity + 10);
    写(ctx, PATH.经验, userId, exp - needExp);
    await replyText(ctx, target, [`编号:${gameId}`, "等级提升失败～", "保底概率+10"].join("\n"));
    return;
  }
  const nextLv = lv + 1;
  const reward = rollUpgradeRewards(nextLv);
  const fire = num(ctx, PATH.火力, userId, 100) + reward.fire;
  const max = num(ctx, PATH.耐久上限, userId, 500) + reward.dur;
  const crit = num(ctx, PATH.暴击, userId, 0) + reward.crit;
  const dodge = num(ctx, PATH.闪避, userId, 0) + reward.dodge;
  写(ctx, PATH.升级概率, userId, 0);
  写(ctx, PATH.经验, userId, exp - needExp);
  写(ctx, PATH.等级, userId, nextLv);
  写(ctx, PATH.火力, userId, fire);
  写(ctx, PATH.耐久上限, userId, max);
  写(ctx, PATH.暴击, userId, crit);
  写(ctx, PATH.闪避, userId, dodge);
  写(ctx, PATH.升级所需经验, userId, Math.floor(needExp * 1.2));
  写(ctx, PATH.升级下次火力, userId, reward.fire);
  写(ctx, PATH.升级下次耐久, userId, reward.dur);
  const score = refreshScore(ctx, userId).score;
  const lines = [
    `编号:${gameId}`,
    "升级成功～",
    nextLv % 10 === 0 ? `成功突破${nextLv}级` : `目前等级:${nextLv}`,
    `火力+${reward.fire}`,
    `耐久上限+${reward.dur}`,
    `总评分 ${score}`
  ];
  if (reward.crit > 0) lines.push(`暴击+${reward.crit}（运气不错）`);
  if (reward.dodge > 0) lines.push(`闪避+${reward.dodge}（运气不错）`);
  if (reward.crit === 0 && reward.dodge === 0) {
    lines.push("本次未抽到暴击/闪避加成");
  }
  if (nextLv >= LEVEL_CAP) {
    lines.push(`已达上限 ${LEVEL_CAP}，可【转生】重置并拿永久加成。`);
  }
  await replyText(ctx, target, lines.join("\n"), false, {
    title: "升级",
    buttons: nextLv >= LEVEL_CAP ? [btn("转生", "转生"), btn("控制台", "星甲控制台")] : [btn("再升级", "升级"), btn("探索", "探索"), btn("控制台", "星甲控制台")]
  });
}
async function handleRebirth(ctx, target, userId) {
  const gameId = getGameId(ctx, userId);
  const lv = num(ctx, PATH.等级, userId, 1);
  if (lv < LEVEL_CAP) {
    await replyText(ctx, target, [`编号:${gameId}`, `需满级 ${LEVEL_CAP} 才能转生`, `当前等级:${lv}`].join("\n"));
    return;
  }
  const times = num(ctx, PATH.转生次数, userId, 0);
  const bonus = 10 + times * 5;
  const fire = num(ctx, PATH.火力, userId, 100);
  const durMax = num(ctx, PATH.耐久上限, userId, 500);
  写(ctx, PATH.等级, userId, 1);
  写(ctx, PATH.经验, userId, 0);
  写(ctx, PATH.升级所需经验, userId, 50);
  写(ctx, PATH.升级概率, userId, 0);
  写(ctx, PATH.升级下次火力, userId, 5);
  写(ctx, PATH.升级下次耐久, userId, 10);
  写(ctx, PATH.火力, userId, fire + bonus);
  写(ctx, PATH.耐久上限, userId, durMax + bonus * 2);
  写(ctx, PATH.转生次数, userId, times + 1);
  写(ctx, PATH.转生火力加成, userId, num(ctx, PATH.转生火力加成, userId, 0) + bonus);
  const score = refreshScore(ctx, userId).score;
  await replyText(
    ctx,
    target,
    [
      `编号:${gameId}`,
      `转生成功 · 第 ${times + 1} 次`,
      `等级重置为 1`,
      `永久火力+${bonus} · 耐久上限+${bonus * 2}`,
      `总评分 ${score}`,
      "提示：继续巡游探索，冲下一次满级。"
    ].join("\n"),
    false,
    {
      title: "转生",
      buttons: [btn("每日巡游", "签到"), btn("探索", "探索"), btn("控制台", "星甲控制台")]
    }
  );
}
async function handleChallenge(ctx, target, userId, enemyGameId) {
  const gameId = getGameId(ctx, userId);
  const enemyUser = userByGameId(ctx, enemyGameId);
  if (!ensureRegistered(ctx, userId) || !ensureRegistered(ctx, enemyUser)) {
    await replyText(ctx, target, "敌方或己方未注册账号，请先【装甲】");
    return;
  }
  if (spacetimePos(ctx, userId) !== "深渊") {
    await replyText(ctx, target, "该玩法需要在【深渊】哦～\n「时空门」是个不错的东西～");
    return;
  }
  if (spacetimePos(ctx, enemyUser) !== "深渊") {
    await replyText(ctx, target, "该玩法需要在【深渊】哦～\n对方好像不在战斗区域哦～");
    return;
  }
  if (isRepairing(ctx, userId)) {
    await replyText(ctx, target, [`编号:${gameId}`, "你正在修复战甲，请先【退出修甲】"].join("\n"));
    return;
  }
  if (isRepairing(ctx, enemyUser)) {
    const eid = getGameId(ctx, enemyUser);
    await replyText(ctx, target, [`编号:${eid}`, "对方正在修复战甲，无法应战"].join("\n"));
    return;
  }
  if (num(ctx, PATH.耐久, userId, 500) <= 0) {
    await replyText(ctx, target, [`编号:${gameId}`, "你已无耐久，请先修甲"].join("\n"), false, {
      buttons: [btn("修甲", "修复战甲")]
    });
    return;
  }
  if (num(ctx, PATH.耐久, enemyUser, 500) <= 0) {
    const eid = getGameId(ctx, enemyUser);
    await replyText(ctx, target, [`编号:${eid}`, "对方已无耐久，无法应战"].join("\n"));
    return;
  }
  if (String(enemyGameId) === String(gameId)) {
    await replyText(ctx, target, [`编号:${gameId}`, "禁止挑战自己！"].join("\n"));
    return;
  }
  incTask(ctx, userId, "挑战");
  const enemyId = getGameId(ctx, enemyUser);
  const myAlliance = getAlliance(ctx, userId);
  const enemyAlliance = getAlliance(ctx, enemyUser);
  const sameAlliance = myAlliance !== "未知" && enemyAlliance !== "未知" && myAlliance === enemyAlliance;
  const myAtk = num(ctx, PATH.火力, userId, 100);
  const enemyAtk = num(ctx, PATH.火力, enemyUser, 100);
  const myDurStart = num(ctx, PATH.耐久, userId, 500);
  const enemyDurStart = num(ctx, PATH.耐久, enemyUser, 500);
  let myDef = myDurStart;
  let enemyDef = enemyDurStart;
  const myDodge = combatDodge(ctx, userId);
  const myCrit = combatCrit(ctx, userId);
  const enemyDodge = combatDodge(ctx, enemyUser);
  const enemyCrit = combatCrit(ctx, enemyUser);
  const myCritStat = num(ctx, PATH.暴击, userId, 0);
  const enemyCritStat = num(ctx, PATH.暴击, enemyUser, 0);
  const persistDur = (who, value) => {
    if (sameAlliance) return;
    const v = Math.max(0, Math.floor(value));
    if (who === "me") 写(ctx, PATH.耐久, userId, v);
    else 写(ctx, PATH.耐久, enemyUser, v);
  };
  const log = [
    `  #${gameId} VS #${enemyId}`,
    `  我方耐久 ${myDurStart} · 敌方耐久 ${enemyDurStart}`
  ];
  let result = "平局";
  for (let round = 1; round <= 4; round++) {
    const r0 = randInt(0, 120);
    const r1 = randInt(30, 200);
    const r2 = randInt(30, 200);
    if (round % 2 === 1) {
      log.push(`+ [R${round}·我方]`);
      if (enemyDodge + r0 > r1) {
        log.push("+   敌方完美闪避");
      } else if (myCrit + r0 > r2) {
        const { dmg, bonusPct } = rollCritDamage(myAtk, myCritStat);
        enemyDef = Math.max(0, enemyDef - dmg);
        log.push(`+   暴击伤害 ${dmg} (+${bonusPct}%)`);
        log.push(`+   敌方剩余 ${enemyDef}`);
        persistDur("enemy", enemyDef);
      } else {
        enemyDef = Math.max(0, enemyDef - myAtk);
        log.push(`+   打出伤害 ${myAtk}`);
        log.push(`+   敌方剩余 ${enemyDef}`);
        persistDur("enemy", enemyDef);
      }
      if (enemyDef <= 0) {
        result = "我方胜";
        persistDur("enemy", 0);
        if (!sameAlliance) recordAllianceWarWin(ctx, userId);
        break;
      }
    } else {
      log.push(`- [R${round}·敌方]`);
      if (myDodge + r0 > r1) {
        log.push("-   我方完美闪避");
      } else if (enemyCrit + r0 > r2) {
        const { dmg, bonusPct } = rollCritDamage(enemyAtk, enemyCritStat);
        myDef = Math.max(0, myDef - dmg);
        log.push(`-   暴击伤害 ${dmg} (+${bonusPct}%)`);
        log.push(`-   我方剩余 ${myDef}`);
        persistDur("me", myDef);
      } else {
        myDef = Math.max(0, myDef - enemyAtk);
        log.push(`-   打出伤害 ${enemyAtk}`);
        log.push(`-   我方剩余 ${myDef}`);
        persistDur("me", myDef);
      }
      if (myDef <= 0) {
        result = "敌方胜";
        persistDur("me", 0);
        break;
      }
    }
  }
  if (result === "平局") {
    log.push("  —— 四回合结束 ——");
  }
  log.push(result === "我方胜" ? "+ 结果：我方胜" : result === "敌方胜" ? "- 结果：敌方胜" : "  结果：平局");
  log.push(
    sameAlliance ? "  [同联盟演练] 耐久未扣除" : `  结算 我 ${myDurStart}→${Math.max(0, Math.floor(myDef))} · 敌 ${enemyDurStart}→${Math.max(0, Math.floor(enemyDef))}`
  );
  const myScore = refreshScore(ctx, userId);
  const enemyScore = refreshScore(ctx, enemyUser);
  if (myScore.changed || enemyScore.changed) {
    log.push(`  评分 我 ${myScore.score} · 敌 ${enemyScore.score}`);
  }
  const tip = sameAlliance ? "提示：同联盟只演练，不扣耐久。跨联盟挑战才会扣。" : "提示：伤害已写入双方耐久，不够就去修甲。";
  await replyText(
    ctx,
    target,
    [tip, "", "```diff", ...log, "```"].join("\n"),
    false,
    {
      title: "挑战战报",
      buttons: [
        btn("再挑战", `挑战${enemyId}`),
        btn("随机挑战", "随机挑战"),
        btn("修甲", "修复战甲"),
        btn("控制台", "星甲控制台")
      ],
      cmds: [cmd("挑战")],
      keepCmds: true
    }
  );
}
async function handleRandomChallenge(ctx, target, userId) {
  const gameId = getGameId(ctx, userId);
  if (spacetimePos(ctx, userId) !== "深渊") {
    await replyText(ctx, target, "随机挑战需要在【深渊】。", false, {
      buttons: [btn("去深渊", "时空门 深渊")]
    });
    return;
  }
  if (isRepairing(ctx, userId)) {
    await replyText(ctx, target, [`编号:${gameId}`, "修甲中无法匹配"].join("\n"), false, {
      buttons: [btn("退出修甲", "退出修甲")]
    });
    return;
  }
  if (num(ctx, PATH.耐久, userId, 500) <= 0) {
    await replyText(ctx, target, [`编号:${gameId}`, "你已无耐久，请先修甲"].join("\n"), false, {
      buttons: [btn("修甲", "修复战甲")]
    });
    return;
  }
  const myScore = refreshScore(ctx, userId).score;
  const opened = 读全部(ctx, PATH.是否开号);
  const list = [];
  for (const [uid, flag] of Object.entries(opened)) {
    if (String(flag) !== "已" || uid === userId) continue;
    if (spacetimePos(ctx, uid) !== "深渊") continue;
    const gid = getGameId(ctx, uid);
    if (!gid || gid === "未知") continue;
    const score = getScore(ctx, uid);
    list.push({ uid, gid, score, diff: Math.abs(score - myScore) });
  }
  list.sort((a, b) => a.diff - b.diff || a.gid.localeCompare(b.gid));
  const MAX_REMATCH = 5;
  let rematch = 0;
  let pick = null;
  for (const cand of list) {
    if (isRepairing(ctx, cand.uid) || num(ctx, PATH.耐久, cand.uid, 500) <= 0) {
      rematch += 1;
      if (rematch > MAX_REMATCH) break;
      continue;
    }
    pick = cand;
    break;
  }
  if (!pick) {
    await replyText(
      ctx,
      target,
      [
        `编号:${gameId}`,
        `你的总评分 ${myScore}`,
        rematch > 0 ? `已重匹配 ${Math.min(rematch, MAX_REMATCH)} 次，暂无合适对手` : "暂无合适对手（需对方也在深渊）",
        "提示：对方修甲中或无耐久会跳过，最多重匹配 5 次。"
      ].join("\n"),
      false,
      {
        title: "随机挑战",
        buttons: [btn("评分榜", "评分排行榜"), btn("控制台", "星甲控制台")],
        cmds: [cmd("挑战")],
        keepCmds: true
      }
    );
    return;
  }
  await replyText(
    ctx,
    target,
    [
      `编号:${gameId}`,
      `匹配到对手 #${pick.gid}`,
      `对方评分 ${pick.score}（你 ${myScore}）`,
      rematch > 0 ? `跳过不可战目标 ${rematch} 次` : "",
      "正在开战…"
    ].filter(Boolean).join("\n")
  );
  await handleChallenge(ctx, target, userId, pick.gid);
}
async function handleMatchChallenge(ctx, target, userId) {
  await handleRandomChallenge(ctx, target, userId);
}
async function handleSpacetime(ctx, target, userId, dest) {
  const gameId = getGameId(ctx, userId);
  const cur = spacetimePos(ctx, userId);
  if (!dest) {
    await replyText(
      ctx,
      target,
      [
        `编号:${gameId}`,
        "时空隧道使用方法:",
        "时空门#芸界",
        "时空门#深渊",
        "目前仅开放俩个空间"
      ].join("\n")
    );
    return;
  }
  if (cur === dest) {
    await replyText(ctx, target, [`编号:${gameId}`, `你目前已在【${cur}】无需切换！`].join("\n"));
    return;
  }
  const last = num(ctx, PATH.时空冷却, userId, 0);
  const now = nowTs();
  if (last !== 0 && now - last < 1800) {
    const until = formatDateTime(last + 1800);
    await replyText(
      ctx,
      target,
      [`编号:${gameId}`, "时空门并不稳定", "每次传送都需要冷却30分钟", `冷却至:${until}`].join("\n")
    );
    return;
  }
  if (dest !== "芸界" && dest !== "深渊") {
    await replyText(
      ctx,
      target,
      [`编号:${gameId}`, "时空隧道使用方法:", "时空门#芸界", "时空门#深渊", "目前仅开放俩个空间"].join("\n")
    );
    return;
  }
  setPosition(ctx, userId, dest);
  写(ctx, PATH.时空冷却, userId, now);
  const greet = dest === "芸界" ? "欢迎抵达" : "欢迎回到";
  await replyText(ctx, target, [`编号:${gameId}`, `${greet}【${dest}】`].join("\n"));
}
async function handleRename(ctx, target, userId, nick) {
  const gameId = getGameId(ctx, userId);
  const cards = num(ctx, PATH.道具("改名次数"), userId, 1);
  if (cards < 1) {
    await replyText(
      ctx,
      target,
      [`编号:${gameId}`, "改名失败！你木有改名卡啦～", "【暗域商锋】可能有你需要的东西"].join("\n")
    );
    return;
  }
  if (!nick) {
    await replyText(ctx, target, [`编号:${gameId}`, "改名失败！", "昵称内容不能为空！"].join("\n"));
    return;
  }
  if (/\s/.test(nick)) {
    await replyText(ctx, target, [`编号:${gameId}`, "改名失败！", "昵称不能包含空格！"].join("\n"));
    return;
  }
  const len = [...nick].length;
  if (len < 2 || len > 15) {
    await replyText(ctx, target, [`编号:${gameId}`, "改名失败！", "昵称长度需 2~15 字"].join("\n"));
    return;
  }
  if (nick === "未设置") {
    await replyText(ctx, target, [`编号:${gameId}`, "改名失败！", "昵称为禁止使用昵称！"].join("\n"));
    return;
  }
  const ban = checkNicknameBan(ctx, nick);
  if (!ban.ok) {
    await replyText(
      ctx,
      target,
      [
        `编号:${gameId}`,
        "改名失败！",
        `昵称含有${ban.category}内容`,
        "请更换其他昵称后再试"
      ].join("\n"),
      false,
      {
        title: "昵称违规",
        cmds: [cmd("更改昵称")],
        keepCmds: true
      }
    );
    return;
  }
  const old = str(ctx, PATH.昵称, userId, "未设置");
  if (nick === old) {
    await replyText(ctx, target, [`编号:${gameId}`, "改名失败！", "与原来的昵称一致！"].join("\n"));
    return;
  }
  const dbRaw = 读(ctx, PATH.昵称库, "可用", {});
  const db = typeof dbRaw === "string" ? JSON.parse(dbRaw || "{}") : { ...dbRaw };
  if (db[nick] != null && String(db[nick]) !== String(gameId)) {
    await replyText(ctx, target, [`编号:${gameId}`, "改名失败！", `昵称:${nick}`, "已被有抢先一步占用啦！"].join("\n"));
    return;
  }
  if (old !== "未设置") delete db[old];
  db[nick] = gameId;
  写(ctx, PATH.昵称库, "可用", db);
  写(ctx, PATH.昵称, userId, nick);
  写(ctx, PATH.道具("改名次数"), userId, cards - 1);
  await replyText(
    ctx,
    target,
    [`编号:${gameId}`, "改名成功！", `旧的昵称:${old}`, `新的昵称:${nick}`].join("\n")
  );
}
async function tryHandleArmorCommand(ctx, event, target, text) {
  const msg = String(text ?? "").trim();
  const userId = 取用户Id(event);
  if (msg === "星甲系统" || msg === "/星甲系统") {
    const registered = ensureRegistered(ctx, userId);
    await replyText(
      ctx,
      target,
      registered ? "点下面就能玩。今天建议：巡游 → 探索 → 升级。" : "还没开号？先点「装甲开号」，然后去每日巡游。",
      false,
      {
        title: "星甲玩法",
        buttons: registered ? [
          btn("每日巡游", "签到"),
          btn("探索", "探索"),
          btn("每日任务", "每日任务"),
          btn("升级", "升级"),
          btn("匹配挑战", "匹配挑战"),
          btn("随机挑战", "随机挑战"),
          btn("控制台", "星甲控制台"),
          btn("商店", "商店"),
          btn("银行", "银行系统"),
          btn("联盟", "联盟系统"),
          btn("联盟战", "联盟战")
        ] : [
          btn("装甲开号", "装甲"),
          btn("今日超能力", "今日超能力"),
          btnNav("回大厅", "main_menu")
        ],
        cmds: registered ? [cmd("挑战"), cmd("更改昵称")] : void 0,
        keepCmds: registered
      }
    );
    return true;
  }
  if (msg === "联盟系统" || msg === "/联盟系统") {
    await replyText(
      ctx,
      target,
      [
        "1 以爆制爆 · +100火力 +100耐久 +20暴击",
        "2 蚀月獠牙 · +50火力 +50耐久 · 签到经验×1.5",
        "3 暗域商锋 · +200耐久 +20闪避 · 存款利率更高",
        "4 休闲至上 · 暂无战斗加成",
        "",
        "提示：点一个加入就行，随时可退。"
      ].join("\n"),
      false,
      {
        title: "联盟系统",
        buttons: [
          btn("①以爆制爆", "加入联盟 1"),
          btn("②蚀月獠牙", "加入联盟 2"),
          btn("③暗域商锋", "加入联盟 3"),
          btn("④休闲至上", "加入联盟 4"),
          btn("查看联盟", "查看联盟"),
          btn("退出联盟", "退出联盟")
        ]
      }
    );
    return true;
  }
  if (msg === "使用道具" || msg === "道具使用") {
    await replyText(
      ctx,
      target,
      [
        "红血清加上限 · 绿血清回耐久 · 强化组件随机强化",
        "刷新卡：重置时空门冷却",
        `太空废铁：每 10 个兑换随机奖励`,
        "提示：点按钮用；蓝字可改数量。"
      ].join("\n"),
      false,
      {
        title: "道具使用",
        buttons: [
          btn("红血清×1", "使用红色血清1"),
          btn("绿血清×1", "使用绿色血清1"),
          btn("强化×1", "使用强化组件1"),
          btn("刷新卡×1", "使用刷新卡1"),
          btn("废铁兑×1", "使用太空废铁10"),
          btn("去商店", "商店")
        ],
        cmds: [
          cmd("使用红色血清"),
          cmd("使用绿色血清"),
          cmd("使用强化组件"),
          cmd("使用刷新卡"),
          cmd("使用太空废铁")
        ],
        keepCmds: true
      }
    );
    return true;
  }
  if (msg === "排行榜" || msg === "/排行榜") {
    await replyText(ctx, target, "提示：点一种排行直接看。", false, {
      title: "排行榜",
      buttons: [
        btn("签到榜", "签到排行榜"),
        btn("评分榜", "评分排行榜"),
        btn("火力榜", "火力排行榜"),
        btn("耐久榜", "耐久排行榜"),
        btn("等级榜", "等级排行榜"),
        btn("星羽榜", "星羽排行榜"),
        btn("存款榜", "存款排行榜")
      ]
    });
    return true;
  }
  const rankKinds = [...RANK_COMMANDS];
  if (rankKinds.includes(msg)) {
    await handleRank(ctx, target, msg);
    return true;
  }
  if (msg === "装甲" || msg === "/装甲" || msg === "注册") {
    await handleRegister(ctx, target, userId);
    return true;
  }
  if (msg === "巡游" || msg === "签到" || msg === "/巡游" || msg === "/签到" || msg === "签到打卡") {
    await handleCheckin(ctx, event, target, userId);
    return true;
  }
  if (msg === "我的信息" || msg === "/我的信息") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    ensureAllianceBonusesApplied(ctx, userId);
    refreshScore(ctx, userId);
    const id = getGameId(ctx, userId);
    await replyText(
      ctx,
      target,
      [
        `编号:${id}`,
        `昵称:${str(ctx, PATH.昵称, userId, "未设置")}`,
        `等级:${num(ctx, PATH.等级, userId, 1)} · 经验:${num(ctx, PATH.经验, userId, 0)}`,
        `火力:${num(ctx, PATH.火力, userId, 100)}`,
        `耐久:${num(ctx, PATH.耐久, userId, 500)}/${num(ctx, PATH.耐久上限, userId, 500)}`,
        `暴击:${num(ctx, PATH.暴击, userId, 0)} · 闪避:${num(ctx, PATH.闪避, userId, 0)}`,
        `总评分:${getScore(ctx, userId)}`,
        `星羽:${num(ctx, PATH.星羽, userId, 0)} · 存款:${num(ctx, PATH.存款星羽, userId, 0)}`,
        "",
        "提示：想改名就点蓝字。"
      ].join("\n"),
      false,
      {
        title: "我的信息",
        buttons: [
          btn("每日巡游", "签到"),
          btn("控制台", "星甲控制台"),
          btn("探索", "探索"),
          btn("银行", "银行系统")
        ],
        cmds: [cmd("更改昵称")],
        keepCmds: true
      }
    );
    return true;
  }
  if (msg === "个人编号" || msg === "/个人编号" || msg === "查看个人编号" || msg === "/查看个人编号") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await replyText(
      ctx,
      target,
      [`用户ID:${userId}`, `游戏ID:${getGameId(ctx, userId)}`].join("\n")
    );
    return true;
  }
  const rename = afterPrefix(msg, "更改昵称");
  if (rename != null) {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await handleRename(ctx, target, userId, rename);
    return true;
  }
  const lookupId = afterPrefix(msg, "查编号");
  if (lookupId != null) {
    if (!/^\d+$/.test(lookupId)) {
      await replyText(ctx, target, "请输入有效游戏ID");
      return true;
    }
    const uid = userByGameId(ctx, lookupId);
    await replyText(
      ctx,
      target,
      [`目标编号:${lookupId}`, `游戏ID:${getGameId(ctx, uid)}`, `用户ID:${uid}`].join("\n")
    );
    return true;
  }
  const lookupUser = afterPrefix(msg, "查用户");
  if (lookupUser != null) {
    await replyText(
      ctx,
      target,
      [`游戏ID:${getGameId(ctx, lookupUser)}`, `用户ID:${lookupUser}`].join("\n")
    );
    return true;
  }
  if (msg === "探索") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await handleExplore(ctx, target, userId);
    return true;
  }
  if (msg === "修复战甲" || msg === "/修复战甲") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await handleRepairStart(ctx, target, userId);
    return true;
  }
  if (msg === "退出修甲" || msg === "/退出修甲" || msg === "取消修甲" || msg === "/取消修甲") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await handleRepairExit(ctx, target, userId);
    return true;
  }
  if (msg === "升级" || msg === "/升级" || msg === "/提升等级" || msg === "提升等级") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await handleUpgrade(ctx, target, userId);
    return true;
  }
  if (msg === "转生" || msg === "/转生") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await handleRebirth(ctx, target, userId);
    return true;
  }
  if (msg === "随机挑战" || msg === "/随机挑战") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await handleRandomChallenge(ctx, target, userId);
    return true;
  }
  if (msg === "匹配挑战" || msg === "/匹配挑战" || msg === "快速挑战") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await handleMatchChallenge(ctx, target, userId);
    return true;
  }
  if (msg === "每日任务" || msg === "/每日任务" || msg === "任务") {
    await handleDailyQuestPanel(ctx, target, userId);
    return true;
  }
  if (msg === "领取任务奖励" || msg === "一键领奖") {
    await handleClaimDailyQuests(ctx, target, userId);
    return true;
  }
  if (msg === "联盟战" || msg === "/联盟战") {
    await handleAllianceWarPanel(ctx, target, userId);
    return true;
  }
  if (msg === "领取联盟战奖励") {
    await handleClaimAllianceWarReward(ctx, target, userId);
    return true;
  }
  const challengeId = afterPrefix(msg, "挑战");
  if (challengeId != null) {
    const id = challengeId.replace(/^[#\s]+/, "").trim();
    if (!id) {
      await replyText(ctx, target, "提示：点蓝字填对方编号，例如挑战3", false, {
        title: "挑战",
        cmds: [cmd("挑战")],
        keepCmds: true,
        buttons: [btn("控制台", "星甲控制台"), btn("排行榜", "排行榜")]
      });
      return true;
    }
    await handleChallenge(ctx, target, userId, id);
    return true;
  }
  const stMatch = msg.match(/^(?:时空门|时空隧道)(?:#| |)(.*)$/);
  if (stMatch) {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await handleSpacetime(ctx, target, userId, String(stMatch[1] ?? "").trim());
    return true;
  }
  if (msg === "查看联盟" || msg === "/查看联盟") {
    await handleViewAlliance(ctx, target, userId);
    return true;
  }
  if (msg === "退出联盟" || msg === "/退出联盟") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await handleLeaveAlliance(ctx, target, userId);
    return true;
  }
  const join = afterPrefix(msg, "加入联盟");
  if (join != null) {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    await handleJoinAlliance(ctx, target, userId, join);
    return true;
  }
  if (await tryHandleShopCommand(ctx, target, msg)) return true;
  if (await tryHandleShopPurchase(ctx, target, userId, msg)) return true;
  if (await tryHandleConsoleCommand(ctx, target, userId, msg)) return true;
  const redM = msg.match(/^使用红色血清([0-9]{0,4})$/);
  if (redM) {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    const qty = redM[1] ? Number(redM[1]) : 1;
    await handleUseRed(ctx, target, userId, qty);
    return true;
  }
  const greenM = msg.match(/^使用绿色血清([0-9]{0,4})$/);
  if (greenM) {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    const qty = greenM[1] ? Number(greenM[1]) : 1;
    await handleUseGreen(ctx, target, userId, qty);
    return true;
  }
  const compM = msg.match(/^使用强化组件([0-9]{0,4})$/);
  if (compM) {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    const qty = compM[1] ? Number(compM[1]) : 1;
    await handleUseComponent(ctx, target, userId, qty);
    return true;
  }
  const refreshM = msg.match(/^使用刷新卡([0-9]{0,4})$/);
  if (refreshM) {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    const qty = refreshM[1] ? Number(refreshM[1]) : 1;
    await handleUseRefresh(ctx, target, userId, qty);
    return true;
  }
  const scrapM = msg.match(/^使用太空废铁([0-9]{0,4})$/);
  if (scrapM) {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    const amount = scrapM[1] ? Number(scrapM[1]) : 10;
    await handleUseScrap(ctx, target, userId, amount);
    return true;
  }
  return false;
}

function parseAmount(raw) {
  const s = String(raw ?? "").trim();
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}
function markFirstDeposit(ctx, userId, ts) {
  if (读(ctx, PATH.存款首次, userId, "未") !== "未") return;
  写(ctx, PATH.存款首次, userId, "已");
  写(ctx, PATH.存款时间, userId, ts);
}
async function doDeposit(ctx, target, userId, amount) {
  const gameId = getGameId(ctx, userId);
  const wallet = num(ctx, PATH.星羽, userId, 0);
  const deposit = num(ctx, PATH.存款星羽, userId, 0);
  if (amount > wallet) return;
  const ts = nowTs();
  写(ctx, PATH.星羽, userId, wallet - amount);
  写(ctx, PATH.存款星羽, userId, deposit + amount);
  markFirstDeposit(ctx, userId, ts);
  incTask(ctx, userId, "存款");
  await replyText(
    ctx,
    target,
    [`编号:${gameId}`, `已存入星羽${amount}`].join("\n"),
    false,
    {
      title: "存款成功",
      buttons: [btn("全部存入", "全部存入"), btn("全部取出", "全部取出"), btn("控制台", "星甲控制台")],
      cmds: [cmd("存入星羽"), cmd("取出星羽")],
      keepCmds: true
    }
  );
}
async function doWithdraw(ctx, target, userId, amount) {
  const gameId = getGameId(ctx, userId);
  const wallet = num(ctx, PATH.星羽, userId, 0);
  const deposit = num(ctx, PATH.存款星羽, userId, 0);
  if (amount > deposit) return;
  const depositTime = num(ctx, PATH.存款时间, userId, 1752631715);
  const now = nowTs();
  const alliance = getAlliance(ctx, userId);
  const { interest, hours, rate } = calcDepositInterest(deposit, depositTime, now, alliance);
  写(ctx, PATH.星羽, userId, wallet + amount + interest);
  写(ctx, PATH.存款星羽, userId, deposit - amount);
  写(ctx, PATH.存款时间, userId, now);
  incTask(ctx, userId, "取款");
  await replyText(
    ctx,
    target,
    [
      `编号:${gameId}`,
      `取出:${amount}`,
      `利率:${rate} %/2小时`,
      `利息:${Math.floor(interest)}`,
      `时长:${hours.toFixed(2)} 小时`
    ].join("\n"),
    false,
    {
      title: "取款结算",
      buttons: [btn("全部存入", "全部存入"), btn("全部取出", "全部取出"), btn("控制台", "星甲控制台")],
      cmds: [cmd("存入星羽"), cmd("取出星羽")],
      keepCmds: true
    }
  );
}
async function tryHandleBankCommand(ctx, event, target, text) {
  const msg = String(text ?? "").trim();
  const userId = 取用户Id(event);
  if (msg === "银行系统" || msg === "/银行系统") {
    await replyText(
      ctx,
      target,
      "提示：点「全部存入」最省事；自定义金额点蓝字改数字。",
      false,
      {
        title: "银行",
        buttons: [
          btn("全部存入", "全部存入"),
          btn("全部取出", "全部取出"),
          btn("控制台", "星甲控制台")
        ],
        cmds: [
          cmd("存入星羽"),
          cmd("取出星羽"),
          cmd("转账#")
        ],
        keepCmds: true
      }
    );
    return true;
  }
  const depMatch = msg.match(/^(?:存入星羽|存款)(.*)$/);
  if (depMatch) {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    const amount = parseAmount(depMatch[1] ?? "");
    if (amount == null) {
      await replyText(ctx, target, "请输入数字金额");
      return true;
    }
    const wallet = num(ctx, PATH.星羽, userId, 0);
    if (amount > wallet) return true;
    await doDeposit(ctx, target, userId, amount);
    return true;
  }
  const wdMatch = msg.match(/^(?:取出星羽|取款)(.*)$/);
  if (wdMatch) {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    const amount = parseAmount(wdMatch[1] ?? "");
    if (amount == null) {
      await replyText(ctx, target, "请输入数字金额");
      return true;
    }
    const deposit = num(ctx, PATH.存款星羽, userId, 0);
    if (amount > deposit) return true;
    await doWithdraw(ctx, target, userId, amount);
    return true;
  }
  if (msg === "全部存入" || msg === "全部存款") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    const gameId = getGameId(ctx, userId);
    const wallet = num(ctx, PATH.星羽, userId, 0);
    if (wallet <= 0) {
      await replyText(ctx, target, [`编号:${gameId}`, "你已经没有现存星羽啦～"].join("\n"));
      return true;
    }
    await doDeposit(ctx, target, userId, wallet);
    return true;
  }
  if (msg === "全部取出" || msg === "全部取款") {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    const gameId = getGameId(ctx, userId);
    const deposit = num(ctx, PATH.存款星羽, userId, 0);
    if (deposit <= 0) {
      await replyText(ctx, target, [`编号:${gameId}`, "你已经没有存款星羽啦～"].join("\n"));
      return true;
    }
    await doWithdraw(ctx, target, userId, deposit);
    return true;
  }
  const txMatch = msg.match(/^(?:转账|打钱)#(.*)#(.*)$/);
  if (txMatch) {
    if (!ensureRegistered(ctx, userId)) {
      await replyNeedRegister(ctx, target);
      return true;
    }
    const toId = String(txMatch[1] ?? "").trim();
    const amountRaw = String(txMatch[2] ?? "").trim();
    const gameId = getGameId(ctx, userId);
    const wallet = num(ctx, PATH.星羽, userId, 0);
    if (!toId || !amountRaw) {
      await replyText(
        ctx,
        target,
        [
          "格式错误",
          "例：",
          "转账#1001#20000",
          "格式：转账#编号#数量",
          "转错不回退，除非转到空账号"
        ].join("\n")
      );
      return true;
    }
    const amount = parseAmount(amountRaw);
    if (amount == null || amount > wallet) {
      await replyText(ctx, target, [`编号:${gameId}`, "你的星羽不足或数值错误"].join("\n"));
      return true;
    }
    const targetUser = userByGameId(ctx, toId);
    const targetWallet = num(ctx, PATH.星羽, targetUser, 0);
    const targetGameId = getGameId(ctx, targetUser);
    if (targetUser === "失败" && targetGameId === "未知") {
      await replyText(
        ctx,
        target,
        [
          `打款方:${gameId}`,
          `收款方:${toId}`,
          "获取对方信息失败",
          "请检查目标是否已装甲",
          "如有疑问可联系反馈"
        ].join("\n")
      );
      return true;
    }
    写(ctx, PATH.星羽, userId, wallet - amount);
    写(ctx, PATH.星羽, targetUser, targetWallet + amount);
    await replyText(
      ctx,
      target,
      [
        `打款方:${gameId}`,
        `收款方:${toId}`,
        `转移星羽:${amount}`,
        "转账成功，对方已收到你的转账",
        "如有转移错误可联系作者或反馈"
      ].join("\n")
    );
    return true;
  }
  return false;
}

const BTN_TC_SP_PRESS = "tc_sp_press";
const BTN_TC_SP_SKIP = "tc_sp_skip";
const BTN_TC_SP_NEXT = "tc_sp_next";
let cachedBank = null;
let cachedBankMtime = 0;
function loadBank(ctx) {
  const file = path.join(tcPluginDataRoot(ctx), "今日超能力题库.json");
  try {
    const mtime = fs.statSync(file).mtimeMs;
    if (cachedBank && mtime === cachedBankMtime) return cachedBank;
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    cachedBank = Array.isArray(raw.questions) ? raw.questions.filter((q) => q?.id && q.问题) : [];
    cachedBankMtime = mtime;
    return cachedBank;
  } catch {
    return cachedBank ?? [];
  }
}
function votesPath(id) {
  return `超能力/票数/${id}.json`;
}
function statusPath(userId) {
  return `超能力/已答/${userId}.json`;
}
function 取票数(ctx, id) {
  return {
    按下: Number(读(ctx, votesPath(id), "按下", 0)) || 0,
    不按: Number(读(ctx, votesPath(id), "不按", 0)) || 0
  };
}
function 构建题目Md(q, press, skip, footer) {
  const lines = [
    "## 今日超能力",
    "",
    `**问题：** ${q.问题}`,
    "",
    `**但是：** ${q.结果}`,
    "",
    `已有 **${press}** 人按下 · **${skip}** 人不按`
  ];
  if (footer) lines.push("", footer);
  else lines.push("", "_点下方按钮作答，或再发「今日超能力」换题_");
  return lines.join("\n");
}
function 题目键盘() {
  return {
    rows: [
      行(
        钮(BTN_TC_SP_PRESS, "按下", BTN_TC_SP_PRESS),
        钮(BTN_TC_SP_SKIP, "不按", BTN_TC_SP_SKIP)
      ),
      行(钮(BTN_TC_SP_NEXT, "换一题", BTN_TC_SP_NEXT))
    ]
  };
}
async function 发题目(ctx, 目标, q, footer, 互动 = false) {
  const v = 取票数(ctx, q.id);
  const seg = 段_md(构建题目Md(q, v.按下, v.不按, footer), 题目键盘());
  if (互动) await 发互动回复(ctx, 目标, [seg]);
  else await 发消息(ctx, 目标, [seg]);
}
function 用户已答(ctx, userId) {
  return 读全部(ctx, statusPath(userId));
}
function 抽题(ctx, userId) {
  const bank = loadBank(ctx);
  if (!bank.length) return null;
  const done = 用户已答(ctx, userId);
  const pool = bank.filter((q) => done[String(q.id)] !== "已处理");
  if (!pool.length) return "all_done";
  return pool[Math.floor(Math.random() * pool.length)];
}
async function 展示新题(ctx, 目标, userId, 互动 = false) {
  const picked = 抽题(ctx, userId);
  if (picked === null) {
    const msg = 段_md("## 今日超能力\n\n题库未加载，请检查 `data/tc/今日超能力题库.json`");
    if (互动) await 发互动回复(ctx, 目标, [msg]);
    else await 发消息(ctx, 目标, [msg]);
    return;
  }
  if (picked === "all_done") {
    const msg = 段_md("## 今日超能力\n\n题库题目你都答过啦～");
    if (互动) await 发互动回复(ctx, 目标, [msg]);
    else await 发消息(ctx, 目标, [msg]);
    return;
  }
  写(ctx, "超能力/当前题.json", userId, picked.id);
  await 发题目(ctx, 目标, picked, void 0, 互动);
}
async function 作答(ctx, 目标, userId, choice, 互动 = false) {
  const cur = 读(ctx, "超能力/当前题.json", userId, 0);
  if (!cur) {
    const msg = 段_md("## 今日超能力\n\n还没有题目，请先发 **今日超能力**");
    if (互动) await 发互动回复(ctx, 目标, [msg]);
    else await 发消息(ctx, 目标, [msg]);
    return;
  }
  const status = String(读(ctx, statusPath(userId), String(cur), "未处理"));
  if (status === "已处理") {
    const msg = 段_md("## 今日超能力\n\n这题你已经答过了，点「换一题」或再发 **今日超能力**");
    if (互动) await 发互动回复(ctx, 目标, [msg]);
    else await 发消息(ctx, 目标, [msg]);
    return;
  }
  const bank = loadBank(ctx);
  const q = bank.find((x) => x.id === Number(cur));
  if (!q) {
    const msg = 段_md("## 今日超能力\n\n题目不存在，请重新抽取");
    if (互动) await 发互动回复(ctx, 目标, [msg]);
    else await 发消息(ctx, 目标, [msg]);
    return;
  }
  const key = choice === "按下" ? "按下" : "不按";
  const n = Number(读(ctx, votesPath(q.id), key, 0)) || 0;
  写(ctx, votesPath(q.id), key, n + 1);
  写(ctx, statusPath(userId), String(q.id), "已处理");
  const times = Number(读(ctx, "超能力/作答次数.json", userId, 0)) || 0;
  写(ctx, "超能力/作答次数.json", userId, times + 1);
  await 发题目(ctx, 目标, q, `你选择了：**${choice}**`, 互动);
}
async function tryHandleSuperpowerText(ctx, event, 目标, text) {
  const 消息 = String(text ?? "").trim();
  const userId = 取用户Id(event);
  if (消息 === "今日超能力" || 消息 === "/今日超能力" || 消息 === "超能力" || 消息 === "/超能力") {
    await 展示新题(ctx, 目标, userId, false);
    return true;
  }
  if (消息 === "按下") {
    await 作答(ctx, 目标, userId, "按下", false);
    return true;
  }
  if (消息 === "不按") {
    await 作答(ctx, 目标, userId, "不按", false);
    return true;
  }
  return false;
}
async function tryHandleSuperpowerButton(ctx, event, 目标, data) {
  const userId = 取用户Id(event);
  if (data === BTN_TC_SP_NEXT) {
    await 展示新题(ctx, 目标, userId, true);
    return true;
  }
  if (data === BTN_TC_SP_PRESS) {
    await 作答(ctx, 目标, userId, "按下", true);
    return true;
  }
  if (data === BTN_TC_SP_SKIP) {
    await 作答(ctx, 目标, userId, "不按", true);
    return true;
  }
  return false;
}

async function tryHandleTcCommand(ctx, event, target, text) {
  if (await tryHandleSuperpowerText(ctx, event, target, text)) return true;
  if (await tryHandleArmorCommand(ctx, event, target, text)) return true;
  if (await tryHandleBankCommand(ctx, event, target, text)) return true;
  return false;
}
async function tryHandleTcButton(ctx, event, target, data) {
  if (await tryHandleSuperpowerButton(ctx, event, target, data)) return true;
  if (data.startsWith(TC_CMD_PREFIX)) {
    const cmd = data.slice(TC_CMD_PREFIX.length).trim();
    if (!cmd) return false;
    return tryHandleTcCommand(ctx, event, target, cmd);
  }
  return false;
}

async function 处理按钮指令(ctx, 目标, data, event) {
  {
    const { event_id: _drop, ...主动目标 } = 目标;
    if (await tryHandleTcButton(ctx, event, 主动目标, data)) return;
  }
  if (data === BTN_MENU_SUPERPOWER || data === "menu_go_superpower") {
    const { event_id: _drop, ...主动目标 } = 目标;
    await tryHandleTcCommand(ctx, event, 主动目标, "今日超能力");
    return;
  }
  if (data === BTN_MENU_ARMOR || data === "menu_go_armor" || data === BTN_MENU_HELP) {
    const { event_id: _drop, ...主动目标 } = 目标;
    await tryHandleTcCommand(ctx, event, 主动目标, "星甲系统");
    return;
  }
  if (data === BTN_CHECKIN || data === "menu_checkin" || data === "menu_go_checkin") {
    const { event_id: _drop, ...主动目标 } = 目标;
    if (await tryHandleTcCommand(ctx, event, 主动目标, "签到")) return;
    await tryHandleCheckinCommand(ctx, event, 主动目标, "签到");
    return;
  }
  if (data === BTN_FORTUNE_DRAW || data === "menu_fortune" || data === "menu_go_fortune") {
    const { event_id: _drop, ...主动目标 } = 目标;
    await tryHandleFortuneCommand(ctx, event, 主动目标, "今日运势");
    return;
  }
  if (data === BTN_MYINFO || data === "menu_myinfo" || data === "menu_go_myinfo") {
    const { event_id: _drop, ...主动目标 } = 目标;
    if (await tryHandleTcCommand(ctx, event, 主动目标, "我的信息")) return;
    await tryHandleMyInfoCommand(ctx, event, 主动目标, "我的信息");
    return;
  }
  if (data === BTN_MAIN_MENU || data === "main") {
    await 发送主菜单(ctx, 目标, true);
    return;
  }
  if (data === BTN_MENU_MUSIC || data === "menu_go_music") {
    await 发送音乐菜单(ctx, 目标, true);
    return;
  }
  if (data === "help") {
    const { event_id: _drop, ...主动目标 } = 目标;
    await tryHandleTcCommand(ctx, event, 主动目标, "星甲系统");
    return;
  }
  if (data === "random") {
    await 发互动回复(ctx, 目标, [段_文本(`随机数：${Math.floor(Math.random() * 100) + 1}`)]);
    return;
  }
  if (data === "confirm") {
    await 发互动回复(ctx, 目标, [
      段_md("## 确认操作\n\n要继续吗？", {
        rows: [行(钮("yes", "确认", "yes"), 钮("no", "取消", "no", 0))]
      })
    ]);
    return;
  }
  if (data === "yes") {
    await 发互动回复(ctx, 目标, [段_文本("已确认，操作完成")]);
    return;
  }
  if (data === "no") {
    await 发互动回复(ctx, 目标, [段_文本("已取消")]);
    return;
  }
  if (data === "more") {
    await 发互动回复(ctx, 目标, [
      段_md("## 二级菜单", {
        rows: [行(钮("back", "返回主菜单", BTN_MAIN_MENU), 钮("bye", "再见", "bye"))]
      })
    ]);
    return;
  }
  if (data === "bye") {
    await 发互动回复(ctx, 目标, [段_文本("再见")]);
    return;
  }
  await 发互动回复(ctx, 目标, [段_文本(`未知按钮：${data}`)]);
}
async function plugin_init(ctx) {
  registerGfWebui(ctx);
  ctx.logger?.info?.("[GF_mk] 官方机器人插件已加载");
}
async function plugin_cleanup(ctx) {
  cancelSharpDependencyInstall(ctx.logger);
  ctx.logger?.info?.("[GF_mk] 插件已卸载");
}
async function plugin_onmessage(ctx, event) {
  本次响应开始时间 = Date.now(); // ★ 新增：记录本次响应起点
  const t = String(event.t ?? "");
  if (t === "INTERACTION_CREATE") {
    const interactionId = String(event.id ?? "");
    if (!interactionId) return;
    const btn = 取按钮数据(event);
    let ackCode = 0;
    try {
      if (!btn?.data) {
        const innerType = event.data?.type;
        ctx.logger?.warn?.(
          `[GF_mk] 互动无 button_data（data.type=${String(innerType ?? "?")}），跳过业务回复`
        );
      } else {
        recordInteractionMessage(ctx, event, btn.data);
        const 目标 = 取互动目标(event);
        await 处理按钮指令(ctx, 目标, btn.data, event);
      }
    } catch (error) {
      ackCode = 1;
      ctx.logger?.error?.("[GF_mk] 按钮互动处理失败:", error);
    } finally {
      try {
        await 回应互动(ctx, interactionId, ackCode);
      } catch (error) {
        ctx.logger?.error?.("[GF_mk] 回应互动失败:", error);
      }
    }
    return;
  }
  if (await tryHandleSystemEvents(ctx, event)) {
    return;
  }
  if (t !== "GROUP_AT_MESSAGE_CREATE" && t !== "GROUP_MESSAGE_CREATE" && t !== "C2C_MESSAGE_CREATE") {
    return;
  }
  await recordInboundMessage(ctx, event);
  const 消息 = 提取纯文本(String(event.content ?? ""));
  if (!消息) return;
  const 发送目标 = 取发送目标(event);
  if (消息 === "入群欢迎" || 消息 === "/入群欢迎") {
    if (发送目标.scope === "group" && 发送目标.group_openid) {
      const role = String(
        event.author?.member_role ?? ""
      ).toLowerCase();
      if (role === "owner" || role === "admin") {
        const 群id = 发送目标.group_openid;
        const 当前开 = String(readB(ctx, "入群欢迎.json", 群id, "开启")) !== "关闭";
        const 下一开 = !当前开;
        writeB(ctx, "入群欢迎.json", 群id, 下一开 ? "开启" : "关闭");
        await 发消息(ctx, 发送目标, [
          段_md(下一开 ? "## 入群欢迎\n\n已**开启**本群进退群提示" : "## 入群欢迎\n\n已**关闭**本群进退群提示")
        ]);
      }
    }
    return;
  }
  if (消息 === "测试撤回" || 消息 === "/测试撤回") {
    const 用户消息id = String(event.id || "").trim();
    const 撤回目标 = 发送目标.scope === "group" ? { scope: "group", group_openid: 发送目标.group_openid } : { scope: "c2c", user_openid: 发送目标.user_openid };
    const 回执 = await 发消息(ctx, 发送目标, [
      段_文本("这是一条测试消息，5 秒后将尝试撤回本条" + (发送目标.scope === "group" ? "（群内权限允许时也会尝试撤回你的指令消息）" : ""))
    ]);
    const 机器人消息id = 取发送消息Id(回执);
    setTimeout(() => {
      void (async () => {
        if (机器人消息id) {
          try {
            await 撤回消息(ctx, 撤回目标, 机器人消息id);
            markMessageRecalled(ctx, 机器人消息id);
            ctx.logger?.info?.(`[GF_mk] 测试撤回：已撤回机器人消息 ${机器人消息id}`);
          } catch (error) {
            ctx.logger?.warn?.("[GF_mk] 测试撤回：撤回机器人消息失败:", error);
          }
        } else {
          ctx.logger?.warn?.("[GF_mk] 测试撤回：未拿到机器人 message_id，跳过撤回本条");
        }
        if (发送目标.scope === "group" && 用户消息id) {
          try {
            await 撤回消息(ctx, 撤回目标, 用户消息id);
            markMessageRecalled(ctx, 用户消息id);
            ctx.logger?.info?.(`[GF_mk] 测试撤回：已撤回用户消息 ${用户消息id}`);
          } catch (error) {
            ctx.logger?.info?.("[GF_mk] 测试撤回：撤回用户消息失败（可能无管理权限）:", error);
          }
        }
      })();
    }, 5e3);
    return;
  }
  if (await tryHandleMainMenuText(ctx, 发送目标, 消息)) {
    return;
  }
  if (await tryHandleTcCommand(ctx, event, 发送目标, 消息)) {
    return;
  }
  if (await tryHandleCheckinCommand(ctx, event, 发送目标, 消息)) {
    return;
  }
  if (await tryHandleMyInfoCommand(ctx, event, 发送目标, 消息)) {
    return;
  }
  if (await tryHandleFortuneCommand(ctx, event, 发送目标, 消息)) {
    return;
  }
  if (await tryHandleVideoParse(ctx, 发送目标, 消息)) {
    return;
  }
  if (await tryHandleMusicCommand(ctx, event, 发送目标, 消息)) {
    return;
  }
  if (消息 === "你好") {
    await 发消息(ctx, 发送目标, [段_文本("你好呀/n哈哈")]);
    return;
  }
  if (消息 === "测试本地图片") {
    await 发消息(ctx, 发送目标, [段_图片本地("data/shu.jpg")]);
    return;
  }
  if (消息 === "测试本地多图片") {
    await 发消息(ctx, 发送目标, [
      段_图片本地("data/shu.jpg"),
      段_图片本地("data/test.png")
    ]);
    return;
  }
  if (消息 === "测试网络多图片") {
    await 发消息(ctx, 发送目标, [
      段_图片url("https://xn--mk-ub3cl61ae1v.xn--c5w857b.xn--fiqs8s/mkbot/image/heng.jpg"),
      段_图片url("https://xn--mk-ub3cl61ae1v.xn--c5w857b.xn--fiqs8s/mkbot/image/heng.jpg")
    ]);
    return;
  }
  if (消息 === "测试本地图片文字") {
    await 发消息(ctx, 发送目标, [
      段_文本("上面是说明/n中间是本地图"),
      段_图片本地("data/shu.jpg"),
      段_文本("下面是结尾")
    ]);
    return;
  }
  if (消息 === "测试网络图片文字") {
    await 发消息(ctx, 发送目标, [
      段_文本("网络图测试"),
      段_图片url("https://xn--mk-ub3cl61ae1v.xn--c5w857b.xn--fiqs8s/mkbot/image/heng.jpg"),
      段_文本("发送完成")
    ]);
    return;
  }
  if (消息 === "测试md" || 消息 === "测试markdown") {
    await 发消息(ctx, 发送目标, [段_md(`# GF_mk 原生 Markdown

**加粗** _斜体_ ~~删除线~~

${md图片行("https://xn--mk-ub3cl61ae1v.xn--c5w857b.xn--fiqs8s/mkbot/image/heng.jpg", { alt: "横图", 宽: 800, 高: 450 })}

> 官方机器人也可以玩花活了`)]);
    return;
  }
  if (消息 === "测试按钮") {
    await 发消息(ctx, 发送目标, [
      段_md("# 互动菜单\n\n点下面按钮", {
        rows: [
          行(钮("help", "查看帮助", "help"), 钮("random", "随机数", "random")),
          行(钮("confirm", "危险操作", "confirm", 0), 钮("more", "更多", "more"))
        ]
      })
    ]);
  }
}

export { BOTAPI, md图片行, md指令输入, plugin_cleanup, plugin_init, plugin_onmessage, 发Ark, 发互动回复, 发消息, 发视频, 发音乐Ark, 发音乐卡片, 发音乐语音, 取互动目标, 取发送消息Id, 取发送目标, 取按钮数据, 取用户Id, 回应互动, 指令钮, 提取纯文本, 撤回消息, 构建点歌Footer键盘, 构建音乐信息Md, 段_md, 段_图片base64, 段_图片url, 段_图片本地, 段_文本, 段_视频url, 行, 解析插件相对路径, 钮 };