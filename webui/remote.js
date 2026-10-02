import { jsxs as r, jsx as e, Fragment as Ue } from "react/jsx-runtime";
import { useRef as N, useState as k, useMemo as je, useEffect as M, useCallback as H } from "react";
function We(a, i) {
  const t = a.replace(/\/$/, "") + "/gfmk";
  async function o(s) {
    if (!s.ok) {
      const m = await s.text().catch(() => "");
      throw new Error(`HTTP ${s.status}${m ? ` - ${m}` : ""}`);
    }
    return await s.json();
  }
  return {
    async get(s, m) {
      const p = new URLSearchParams();
      if (m)
        for (const [c, u] of Object.entries(m))
          u === void 0 || u === "" || p.set(c, String(u));
      const f = p.toString(), x = t + s + (f ? `?${f}` : "");
      return o(await i(x, { credentials: "include" }));
    },
    async post(s, m) {
      return o(
        await i(t + s, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(m ?? {})
        })
      );
    }
  };
}
function He() {
  const a = /* @__PURE__ */ new Date(), i = (t) => String(t).padStart(2, "0");
  return `${a.getFullYear()}-${i(a.getMonth() + 1)}-${i(a.getDate())}`;
}
function P(a) {
  const i = String(a || "");
  return i.length <= 16 ? i : `${i.slice(0, 8)}…${i.slice(-6)}`;
}
function Ge(a, i) {
  const t = i ? new Date(i) : new Date(a || 0);
  if (Number.isNaN(t.getTime())) return String(a || "");
  const o = (s) => String(s).padStart(2, "0");
  return `${o(t.getMonth() + 1)}-${o(t.getDate())} ${o(t.getHours())}:${o(t.getMinutes())}:${o(t.getSeconds())}`;
}
function Ve(a, i) {
  const t = i ? new Date(i) : new Date(a || 0);
  if (Number.isNaN(t.getTime())) return "";
  const o = (p) => String(p).padStart(2, "0"), s = /* @__PURE__ */ new Date();
  return t.getFullYear() === s.getFullYear() && t.getMonth() === s.getMonth() && t.getDate() === s.getDate() ? `${o(t.getHours())}:${o(t.getMinutes())}` : `${o(t.getMonth() + 1)}-${o(t.getDate())} ${o(t.getHours())}:${o(t.getMinutes())}`;
}
function Ke({ hourly: a }) {
  const i = N(null), [t, o] = k(0), s = je(() => {
    const h = Array.isArray(a) ? a.map((w) => Number(w) || 0) : [];
    for (; h.length < 24; ) h.push(0);
    return h.slice(0, 24);
  }, [a]);
  M(() => {
    const h = i.current;
    if (!h || typeof ResizeObserver > "u") {
      o(h?.clientWidth || 0);
      return;
    }
    const w = new ResizeObserver(() => o(Math.round(h.clientWidth)));
    return w.observe(h), o(Math.round(h.clientWidth)), () => w.disconnect();
  }, []);
  const m = Math.max(1, ...s), p = 180, f = 2, x = Math.max(1, t), c = p - f * 2, y = s.map((h, w) => {
    const z = w / 23 * x, g = f + (1 - h / m) * c;
    return [z, g];
  }).map((h, w) => `${w === 0 ? "M" : "L"}${h[0].toFixed(2)},${h[1].toFixed(2)}`).join(" "), l = `${y} L${x.toFixed(2)},${(f + c).toFixed(2)} L0,${(f + c).toFixed(2)} Z`, $ = /* @__PURE__ */ new Set([0, 3, 6, 9, 12, 15, 18, 21, 23]);
  return /* @__PURE__ */ r("div", { className: "chart-wrap", children: [
    /* @__PURE__ */ r("div", { className: "chart-body", children: [
      /* @__PURE__ */ r("div", { className: "chart-y", children: [
        /* @__PURE__ */ e("span", { children: m }),
        /* @__PURE__ */ e("span", { children: Math.round(m / 2) }),
        /* @__PURE__ */ e("span", { children: "0" })
      ] }),
      /* @__PURE__ */ e("div", { className: "chart-plot", ref: i, children: x > 0 ? /* @__PURE__ */ r("svg", { viewBox: `0 0 ${x} ${p}`, width: x, height: p, "aria-hidden": !0, children: [
        [0, 0.5, 1].map((h) => {
          const w = (f + (1 - h) * c).toFixed(2);
          return /* @__PURE__ */ e(
            "line",
            {
              x1: 0,
              y1: w,
              x2: x,
              y2: w,
              stroke: "rgba(100,116,139,0.25)",
              strokeWidth: 1,
              strokeDasharray: "4 4"
            },
            h
          );
        }),
        /* @__PURE__ */ e("path", { d: l, fill: "rgba(13,148,136,0.18)" }),
        /* @__PURE__ */ e(
          "path",
          {
            d: y,
            fill: "none",
            stroke: "#0d9488",
            strokeWidth: 2.5,
            strokeLinejoin: "round",
            strokeLinecap: "round"
          }
        )
      ] }) : null })
    ] }),
    /* @__PURE__ */ e("div", { className: "chart-x", children: Array.from({ length: 24 }, (h, w) => /* @__PURE__ */ e("span", { children: $.has(w) ? `${w}h` : "" }, w)) })
  ] });
}
function B(a) {
  return String(a ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function Je(a) {
  const i = String(a || "");
  return i ? /(^|\n)\s{0,3}#{1,6}\s|!\[[^\]]*\]\(|\[[^\]]+\]\([^)]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|(^|\n)\s{0,3}[-*+]\s|(^|\n)\s{0,3}\d+\.\s|(^|\n)\s{0,3}>\s|(^|\n)\s*\|.+\||(^|\n)\s*---\s*($|\n)/m.test(i) : !1;
}
function O(a) {
  let i = B(a);
  return i = i.replace(
    /!\[([^\]]*?)\]\((https?:\/\/[^)\s]+)\)/g,
    (t, o, s) => {
      const m = String(o || ""), p = m.match(/^(.*?)(?:#(\d+)px\s*#(\d+)px)?$/), f = (p && p[1] ? p[1] : m).trim() || "img";
      return `<img class="im-zoom-img" src="${B(s)}" alt="${B(f)}" loading="lazy" />`;
    }
  ), i = i.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'), i = i.replace(/`([^`\n]+)`/g, "<code>$1</code>"), i = i.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>"), i = i.replace(/__([^_\n]+)__/g, "<strong>$1</strong>"), i = i.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>"), i;
}
function Qe(a) {
  const i = String(a ?? "").replace(/\r\n/g, `
`).trim();
  if (!i) return { html: "", isMd: !1 };
  if (!Je(i))
    return { html: B(i).replace(/\n/g, "<br>"), isMd: !1 };
  const t = i.split(`
`), o = [];
  let s = 0, m = !1, p = [], f = null, x = [];
  const c = () => {
    f && (o.push(f === "ol" ? "</ol>" : "</ul>"), f = null);
  }, u = () => {
    if (!x.length) return;
    const y = x.slice();
    x = [];
    const l = y.filter(($, h) => !(h === 1 && $.every((w) => /^:?-+:?$/.test(w.replace(/\s/g, "")))));
    l.length && (o.push("<table>"), l.forEach(($, h) => {
      const w = h === 0 ? "th" : "td";
      o.push(`<tr>${$.map((z) => `<${w}>${O(z.trim())}</${w}>`).join("")}</tr>`);
    }), o.push("</table>"));
  };
  for (; s < t.length; ) {
    const y = t[s];
    if (m) {
      /^```/.test(y) ? (o.push(`<pre><code>${B(p.join(`
`))}</code></pre>`), p = [], m = !1) : p.push(y), s += 1;
      continue;
    }
    if (/^```/.test(y)) {
      c(), u(), m = !0, p = [], s += 1;
      continue;
    }
    if (/^\s*\|/.test(y) && y.indexOf("|", 1) >= 0) {
      c(), x.push(y.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|")), s += 1;
      continue;
    }
    if (u(), /^\s*---+\s*$/.test(y)) {
      c(), o.push("<hr>"), s += 1;
      continue;
    }
    const l = y.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    if (l) {
      c();
      const g = l[1].length;
      o.push(`<h${g}>${O(l[2])}</h${g}>`), s += 1;
      continue;
    }
    const $ = y.match(/^\s{0,3}>\s?(.*)$/);
    if ($) {
      c(), o.push(`<blockquote><p>${O($[1])}</p></blockquote>`), s += 1;
      continue;
    }
    const h = y.match(/^\s{0,3}[-*+]\s+(.+)$/);
    if (h) {
      f !== "ul" && (c(), o.push("<ul>"), f = "ul"), o.push(`<li>${O(h[1])}</li>`), s += 1;
      continue;
    }
    const w = y.match(/^\s{0,3}\d+\.\s+(.+)$/);
    if (w) {
      f !== "ol" && (c(), o.push("<ol>"), f = "ol"), o.push(`<li>${O(w[1])}</li>`), s += 1;
      continue;
    }
    if (!y.trim()) {
      c(), s += 1;
      continue;
    }
    c();
    const z = [y];
    for (s += 1; s < t.length; ) {
      const g = t[s];
      if (!g.trim() || /^\s{0,3}#{1,6}\s|^\s{0,3}[-*+]\s|^\s{0,3}\d+\.\s|^\s{0,3}>|^\s*```|^\s*\|/.test(g)) break;
      z.push(g), s += 1;
    }
    o.push(`<p>${z.map(O).join("<br>")}</p>`);
  }
  return c(), u(), m && o.push(`<pre><code>${B(p.join(`
`))}</code></pre>`), { html: o.join(""), isMd: !0 };
}
function te({ list: a, empty: i, mode: t }) {
  return a.length ? /* @__PURE__ */ e("ul", { className: "rank-list", children: a.map((o, s) => {
    const m = String(o.id || ""), p = t === "user" ? String(o.name || "").trim() || "未知昵称" : P(m);
    return /* @__PURE__ */ r("li", { className: "rank-row", children: [
      /* @__PURE__ */ r("div", { className: "rank-row-main", children: [
        /* @__PURE__ */ e("span", { className: "rank-idx", children: s + 1 }),
        /* @__PURE__ */ e("img", { src: o.avatar || "", alt: "", onError: (f) => {
          f.target.style.visibility = "hidden";
        } }),
        /* @__PURE__ */ r("div", { className: "rank-name", children: [
          /* @__PURE__ */ e("span", { className: "rank-nick", title: t === "user" ? p : m, children: p }),
          /* @__PURE__ */ e("span", { className: "rank-id", title: m, children: m })
        ] })
      ] }),
      /* @__PURE__ */ e("span", { className: "rank-count", children: o.count ?? 0 })
    ] }, `${m}-${s}`);
  }) }) : /* @__PURE__ */ r("div", { className: "empty rank-empty", children: [
    /* @__PURE__ */ e("div", { className: "empty-icon", "aria-hidden": !0 }),
    /* @__PURE__ */ e("span", { children: i })
  ] });
}
function Xe() {
  const a = "gfmk-manrope-font";
  if (document.getElementById(a)) return;
  const i = document.createElement("link");
  i.id = a, i.rel = "stylesheet", i.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap", document.head.appendChild(i);
}
function Ze({
  api: a,
  toast: i
}) {
  const [t, o] = k("dash"), [s, m] = k(""), [p, f] = k(!1);
  M(() => {
    Xe();
  }, []), M(() => {
    t !== "chats" && f(!1);
  }, [t]);
  const x = [
    ["dash", "仪表盘", "概览"],
    ["ranks", "使用排行", "排行"],
    ["chats", "查看消息", "消息"],
    ["settings", "系统设置", "设置"]
  ];
  return /* @__PURE__ */ r(Ue, { children: [
    /* @__PURE__ */ r("aside", { className: "sidebar", children: [
      /* @__PURE__ */ r("div", { className: "brand", children: [
        /* @__PURE__ */ e("span", { className: "mark", children: "GF_mk" }),
        /* @__PURE__ */ e("small", { children: "console" })
      ] }),
      x.slice(0, 3).map(([c, u]) => /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: `nav-item${t === c ? " active" : ""}`,
          onClick: () => o(c),
          children: u
        },
        c
      )),
      /* @__PURE__ */ e("div", { className: "nav-label", children: "系统" }),
      /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: `nav-item${t === "settings" ? " active" : ""}`,
          onClick: () => o("settings"),
          children: "系统设置"
        }
      )
    ] }),
    /* @__PURE__ */ r(
      "main",
      {
        className: `main${p ? " chat-open" : ""}`,
        style: t === "chats" ? { display: "flex", flexDirection: "column", minHeight: 0 } : void 0,
        children: [
          t === "dash" ? /* @__PURE__ */ e(en, { api: a, onError: m }) : null,
          t === "ranks" ? /* @__PURE__ */ e(nn, { api: a, onError: m }) : null,
          t === "chats" ? /* @__PURE__ */ e(
            tn,
            {
              api: a,
              toast: i,
              onError: m,
              onScreenChange: (c) => f(c === "chat")
            }
          ) : null,
          t === "settings" ? /* @__PURE__ */ e(an, { api: a, toast: i, onError: m }) : null,
          s ? /* @__PURE__ */ e("div", { className: "err", children: s }) : null
        ]
      }
    ),
    /* @__PURE__ */ e("nav", { className: `mobile-tabbar${p ? " is-hidden" : ""}`, "aria-label": "主导航", children: x.map(([c, , u]) => /* @__PURE__ */ e(
      "button",
      {
        type: "button",
        className: `mobile-tab${t === c ? " active" : ""}`,
        onClick: () => o(c),
        children: /* @__PURE__ */ e("span", { className: "mobile-tab-label", children: u })
      },
      c
    )) })
  ] });
}
function en({ api: a, onError: i }) {
  const [t, o] = k(He()), [s, m] = k(null), p = H(async () => {
    i("");
    try {
      const u = await a.get("/dashboard", { date: t });
      m(u.data || {});
    } catch (u) {
      i(u instanceof Error ? u.message : String(u));
    }
  }, [a, t, i]);
  M(() => {
    p();
  }, [p]);
  const f = s?.bot || {}, x = Number(s?.groupMessages) || 0, c = Number(s?.privateMessages) || 0;
  return /* @__PURE__ */ r("section", { children: [
    /* @__PURE__ */ e("h1", { className: "page-title", children: "仪表盘" }),
    /* @__PURE__ */ r("div", { className: "toolbar toolbar-glass", children: [
      /* @__PURE__ */ r("label", { children: [
        "日期",
        /* @__PURE__ */ e("input", { type: "date", value: t, onChange: (u) => o(u.target.value) })
      ] }),
      /* @__PURE__ */ e("button", { type: "button", className: "btn btn-ghost", onClick: () => void p(), children: "刷新" })
    ] }),
    /* @__PURE__ */ r("div", { className: "stats", children: [
      /* @__PURE__ */ r("div", { className: "stat-card", children: [
        /* @__PURE__ */ e("div", { className: "label", children: "Bot" }),
        /* @__PURE__ */ r("div", { className: "bot-row", children: [
          /* @__PURE__ */ e("img", { src: f.avatar || "", alt: "", onError: (u) => {
            u.target.style.visibility = "hidden";
          } }),
          /* @__PURE__ */ r("div", { className: "bot-meta", children: [
            /* @__PURE__ */ e("div", { className: "bot-name", title: f.name || "GF Bot", children: f.name || "GF Bot" }),
            /* @__PURE__ */ e("div", { className: "bot-sub", children: f.appId ? `AppID ${f.appId}` : "—" })
          ] }),
          /* @__PURE__ */ e("span", { className: `status-pill${f.running ? "" : " off"}`, children: f.running ? "运行中" : "未启用" })
        ] })
      ] }),
      /* @__PURE__ */ r("div", { className: "stat-card", children: [
        /* @__PURE__ */ e("div", { className: "label", children: "今日消息" }),
        /* @__PURE__ */ e("div", { className: "value", children: x + c }),
        /* @__PURE__ */ r("div", { className: "hint", children: [
          "群聊 ",
          x,
          " · 私聊 ",
          c
        ] })
      ] }),
      /* @__PURE__ */ r("div", { className: "stat-card", children: [
        /* @__PURE__ */ e("div", { className: "label", children: "今日群聊消息" }),
        /* @__PURE__ */ e("div", { className: "value", children: x }),
        /* @__PURE__ */ r("div", { className: "hint", children: [
          s?.groupCount || 0,
          " 个群 · ",
          s?.userCount || 0,
          " 个用户"
        ] })
      ] }),
      /* @__PURE__ */ r("div", { className: "stat-card", children: [
        /* @__PURE__ */ e("div", { className: "label", children: "今日私聊消息" }),
        /* @__PURE__ */ e("div", { className: "value", children: c }),
        /* @__PURE__ */ e("div", { className: "hint", children: "合并日志可筛「私聊」" })
      ] })
    ] }),
    /* @__PURE__ */ r("div", { className: "panel", children: [
      /* @__PURE__ */ e("h3", { children: "今日消息时段分布" }),
      /* @__PURE__ */ e(Ke, { hourly: s?.hourly })
    ] }),
    /* @__PURE__ */ r("div", { className: "split", children: [
      /* @__PURE__ */ r("div", { className: "panel", children: [
        /* @__PURE__ */ e("h3", { children: "群聊使用排行 Top5" }),
        /* @__PURE__ */ e(te, { list: s?.groupTop || [], empty: "暂无群聊数据", mode: "group" })
      ] }),
      /* @__PURE__ */ r("div", { className: "panel", children: [
        /* @__PURE__ */ e("h3", { children: "用户使用排行 Top5" }),
        /* @__PURE__ */ e(te, { list: s?.userTop || [], empty: "暂无用户数据", mode: "user" })
      ] })
    ] })
  ] });
}
function nn({ api: a, onError: i }) {
  const [t, o] = k(He()), [s, m] = k([]), [p, f] = k([]), x = H(async () => {
    i("");
    try {
      const c = await a.get("/rankings", { date: t });
      m(c.data?.groups || []), f(c.data?.users || []);
    } catch (c) {
      i(c instanceof Error ? c.message : String(c));
    }
  }, [a, t, i]);
  return M(() => {
    x();
  }, [x]), /* @__PURE__ */ r("section", { className: "ranks-page", children: [
    /* @__PURE__ */ e("h1", { className: "page-title", children: "使用排行" }),
    /* @__PURE__ */ r("div", { className: "toolbar toolbar-glass", children: [
      /* @__PURE__ */ r("label", { children: [
        "日期",
        /* @__PURE__ */ e("input", { type: "date", value: t, onChange: (c) => o(c.target.value) })
      ] }),
      /* @__PURE__ */ e("button", { type: "button", className: "btn btn-ghost", onClick: () => void x(), children: "刷新" })
    ] }),
    /* @__PURE__ */ r("div", { className: "split ranks-split", children: [
      /* @__PURE__ */ r("div", { className: "panel ranks-panel", children: [
        /* @__PURE__ */ e("h3", { children: "群聊使用排行" }),
        /* @__PURE__ */ e(te, { list: s, empty: "暂无群聊数据", mode: "group" })
      ] }),
      /* @__PURE__ */ r("div", { className: "panel ranks-panel", children: [
        /* @__PURE__ */ e("h3", { children: "用户使用排行" }),
        /* @__PURE__ */ e(te, { list: p, empty: "暂无用户数据", mode: "user" })
      ] })
    ] })
  ] });
}
function tn({
  api: a,
  toast: i,
  onError: t,
  onScreenChange: o
}) {
  const [s, m] = k(""), [p, f] = k("all"), [x, c] = k([]), [u, y] = k("list"), [l, $] = k(null), [h, w] = k([]), [z, g] = k(""), [C, ae] = k(!1), [R, be] = k(!1), [I, Re] = k(() => {
    try {
      return localStorage.getItem("gfmk-im-send-md") === "1";
    } catch {
      return !1;
    }
  }), [Fe, re] = k(!1), [oe, se] = k(0), [W, G] = k(null), [V, ue] = k(!1), [he, le] = k(0), [xe, K] = k(""), de = N(null), ke = N(null), J = N(null), we = N(u), ve = N(l), ye = N(0), ce = N(!1), Q = N(null), E = N(null), Ne = N(0), me = N(!1), X = N(null), Y = N(null), $e = N(0), ze = N(!1), Z = N(null), fe = N(!1);
  we.current = u, ve.current = l, ye.current = h.length;
  const L = H((n) => {
    const d = n || J.current;
    d && (d.style.height = "auto", d.style.height = `${Math.min(120, Math.max(48, d.scrollHeight))}px`);
  }, []), F = H(async (n) => {
    n?.silent || t("");
    try {
      const d = await a.get("/chats", {
        days: 30,
        q: s.trim() || void 0
      });
      c(d.data?.sessions || []);
    } catch (d) {
      n?.silent || t(d instanceof Error ? d.message : String(d));
    }
  }, [a, s, t]), ee = H(() => {
    const n = de.current;
    n && (n.scrollTop = n.scrollHeight), ke.current?.scrollIntoView({ block: "end" });
  }, []), q = H(async (n, d, b) => {
    try {
      const v = await a.get("/chats/messages", {
        scope: n,
        id: d,
        days: 30,
        limit: 120,
        offset: 0
      }), T = v.data?.list || [], D = v.data?.peer || b?.peerHint || null;
      D && $(D);
      const j = ye.current, U = (() => {
        const S = de.current;
        return S ? S.scrollHeight - S.scrollTop - S.clientHeight < 80 : !0;
      })();
      w(T);
      const A = T.length > j;
      (!b?.silent || A && U) && requestAnimationFrame(() => ee());
    } catch (v) {
      b?.silent || t(v instanceof Error ? v.message : String(v));
    }
  }, [a, t, ee]), Ae = H(async (n, d, b) => {
    t(""), be(!0), y("chat"), o?.("chat"), g(""), b && $(b);
    try {
      await q(n, d, { peerHint: b });
    } finally {
      be(!1);
    }
  }, [t, o, q]), Pe = () => {
    y("list"), o?.("list"), $(null), w([]), g(""), F({ silent: !0 });
  };
  M(() => {
    F();
  }, [F]), M(() => {
    u === "chat" && L();
  }, [u, z, L]), M(() => {
    const n = async () => {
      if (!ce.current) {
        ce.current = !0;
        try {
          if (we.current === "list")
            await F({ silent: !0 });
          else {
            const b = ve.current;
            b && await q(b.scope, b.id, { silent: !0, peerHint: b });
          }
        } finally {
          ce.current = !1;
        }
      }
    }, d = window.setInterval(() => {
      n();
    }, 1e3);
    return () => window.clearInterval(d);
  }, [F, q]), M(() => {
    if (u !== "chat" || R) return;
    const n = () => ee();
    n();
    const d = window.setTimeout(n, 0), b = window.setTimeout(n, 80);
    return requestAnimationFrame(() => requestAnimationFrame(n)), () => {
      window.clearTimeout(d), window.clearTimeout(b);
    };
  }, [u, R, ee]);
  const Le = async () => {
    if (!(!l || !z.trim())) {
      ae(!0);
      try {
        await a.post("/chats/send", {
          scope: l.scope,
          id: l.id,
          content: z.trim(),
          format: I ? "md" : "text"
        }), g(""), i(I ? "已发送（Markdown）" : "已发送"), requestAnimationFrame(() => L()), await q(l.scope, l.id, { peerHint: l }), await F({ silent: !0 });
      } catch (n) {
        const d = n instanceof Error ? n.message : String(n);
        t(d), i(d);
      } finally {
        ae(!1);
      }
    }
  }, qe = (n) => {
    const d = String(n.userId || "").trim();
    if (!d || d === "bot" || d === "unknown") return;
    const b = `<@${d}>`, v = J.current, T = z;
    let D;
    if (v && typeof v.selectionStart == "number") {
      const j = v.selectionStart, U = v.selectionEnd, A = T.slice(0, j), S = T.slice(U), _ = A.length > 0 && !/\s$/.test(A), ie = S.length > 0 && !/^\s/.test(S), De = `${_ ? " " : ""}${b}${ie ? " " : ""}`;
      D = A + De + S, g(D), requestAnimationFrame(() => {
        const Ie = A.length + De.length;
        v.focus(), v.setSelectionRange(Ie, Ie), L(v);
      });
    } else {
      const j = T.length > 0 && !/\s$/.test(T);
      D = `${T}${j ? " " : ""}${b} `, g(D), requestAnimationFrame(() => {
        J.current?.focus(), L();
      });
    }
    i(`已艾特 ${n.userName || P(d)}`);
  }, ne = () => {
    Q.current != null && (window.clearTimeout(Q.current), Q.current = null), E.current != null && (window.cancelAnimationFrame(E.current), E.current = null), se(0);
  }, pe = () => {
    X.current != null && (window.clearTimeout(X.current), X.current = null), Y.current != null && (window.cancelAnimationFrame(Y.current), Y.current = null), le(0), Z.current = null;
  };
  M(() => () => {
    ne(), pe();
  }, []);
  const _e = (n) => {
    if (C) return;
    n.preventDefault(), me.current = !1, Ne.current = Date.now(), se(0);
    const d = () => {
      const b = Math.min(1, (Date.now() - Ne.current) / 3e3);
      se(b), b < 1 && (E.current = window.requestAnimationFrame(d));
    };
    E.current = window.requestAnimationFrame(d), Q.current = window.setTimeout(() => {
      me.current = !0, ne(), re(!0);
    }, 3e3);
  }, Oe = () => {
    const n = me.current;
    ne(), !n && !C && z.trim() && Le();
  }, Se = () => {
    ne();
  }, Ce = (n) => {
    Re(n);
    try {
      localStorage.setItem("gfmk-im-send-md", n ? "1" : "0");
    } catch {
    }
    i(n ? "已切换：Markdown 输出" : "已切换：普通文本");
  }, Be = (n, d) => {
    if (!String(d.msgId || "").trim() || n.button != null && n.button !== 0) return;
    ze.current = !1, Z.current = d, $e.current = Date.now(), le(0);
    const b = () => {
      const v = Math.min(1, (Date.now() - $e.current) / 3e3);
      le(v), v < 1 && (Y.current = window.requestAnimationFrame(b));
    };
    Y.current = window.requestAnimationFrame(b), X.current = window.setTimeout(() => {
      ze.current = !0, fe.current = !0;
      const v = Z.current;
      pe(), v?.msgId && G(v);
    }, 3e3);
  }, ge = () => {
    pe();
  }, Ee = async () => {
    if (!(!l || !W?.msgId)) {
      ue(!0);
      try {
        await a.post("/chats/recall", {
          scope: l.scope,
          id: l.id,
          msgId: W.msgId
        }), i("已撤回"), G(null), await q(l.scope, l.id, { peerHint: l });
      } catch (n) {
        const d = n instanceof Error ? n.message : String(n);
        t(d), i(d);
      } finally {
        ue(!1);
      }
    }
  }, Me = async (n) => {
    try {
      const d = await a.post("/chats/pin", { key: n });
      i(d.data?.pinned ? "已置顶" : "已取消置顶"), await F(), l?.key === n && $((b) => b && { ...b, pinned: !!d.data?.pinned });
    } catch (d) {
      t(d instanceof Error ? d.message : String(d));
    }
  }, Te = x.filter((n) => p === "all" ? !0 : n.scope === p), Ye = l ? l.scope === "private" ? l.title || P(l.id) : l.title && l.title !== l.id ? l.title : P(l.id) : "";
  return u === "chat" && l ? /* @__PURE__ */ e("section", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }, children: /* @__PURE__ */ e("div", { className: "im-shell im-shell-page", children: /* @__PURE__ */ r("div", { className: "im-pane im-pane-full", children: [
    /* @__PURE__ */ r("div", { className: "im-pane-head", children: [
      /* @__PURE__ */ e("button", { type: "button", className: "im-back", onClick: Pe, "aria-label": "返回列表", children: "← 返回" }),
      /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
        /* @__PURE__ */ r("div", { className: "im-pane-title", children: [
          Ye,
          l.msgCount ? ` (${l.msgCount})` : ""
        ] }),
        /* @__PURE__ */ e("div", { className: "im-pane-sub", children: l.id })
      ] }),
      /* @__PURE__ */ r("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
        /* @__PURE__ */ e("span", { className: `im-pane-type ${l.scope}`, children: l.scope === "group" ? "群聊" : "私聊" }),
        /* @__PURE__ */ e(
          "button",
          {
            type: "button",
            className: `im-pin-btn${l.pinned ? " on" : ""}`,
            title: l.pinned ? "取消星标" : "星标置顶",
            "aria-label": l.pinned ? "取消星标" : "星标置顶",
            onClick: () => void Me(l.key),
            children: l.pinned ? "★" : "☆"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ r("div", { className: "im-messages", ref: de, children: [
      R && !h.length ? /* @__PURE__ */ e("div", { className: "im-empty", children: "加载中…" }) : null,
      !R && !h.length ? /* @__PURE__ */ e("div", { className: "im-empty", children: "该会话暂无消息" }) : null,
      h.map((n, d) => {
        const b = n.direction === "out", v = !b && !!n.userId && n.userId !== "bot" && n.userId !== "unknown", T = !!String(n.msgId || "").trim(), D = he > 0 && !!n.msgId && Z.current?.msgId === n.msgId;
        let j = String(n.content || "");
        j = j.replace(/\[按钮\]\s*([^\n\]]+)/g, "`$1`");
        const { html: U, isMd: A } = Qe(j);
        return /* @__PURE__ */ r("div", { className: `im-msg${b ? " out" : ""}`, children: [
          /* @__PURE__ */ e(
            "img",
            {
              src: n.userAvatar || "",
              alt: "",
              className: v ? "im-avatar-at" : void 0,
              title: v ? `点击艾特 ${n.userName || P(n.userId || "")}` : void 0,
              onClick: () => {
                v && qe(n);
              },
              onError: (S) => {
                S.target.style.visibility = "hidden";
              }
            }
          ),
          /* @__PURE__ */ r("div", { className: "im-msg-body", children: [
            /* @__PURE__ */ r("div", { className: "im-msg-head", children: [
              /* @__PURE__ */ e("span", { className: "im-msg-name", children: n.userName || P(n.userId || "") }),
              /* @__PURE__ */ e("span", { className: "im-msg-time", children: Ge(n.ts, n.time) })
            ] }),
            /* @__PURE__ */ e(
              "div",
              {
                className: `im-bubble${A ? " md" : ""}${T ? " recallable" : ""}${D ? " holding" : ""}`,
                style: D ? { "--hold": String(he) } : void 0,
                title: T ? "长按 3 秒可撤回 · 点击图片可放大" : "点击图片可放大",
                onPointerDown: (S) => Be(S, n),
                onPointerUp: ge,
                onPointerLeave: ge,
                onPointerCancel: ge,
                onContextMenu: (S) => {
                  T && S.preventDefault();
                },
                onClick: (S) => {
                  if (fe.current) {
                    fe.current = !1;
                    return;
                  }
                  const _ = S.target;
                  if (_ && _.tagName === "IMG") {
                    const ie = _.currentSrc || _.src;
                    ie && K(ie);
                  }
                },
                dangerouslySetInnerHTML: { __html: U }
              }
            )
          ] })
        ] }, d);
      }),
      /* @__PURE__ */ e("div", { ref: ke, "aria-hidden": !0, className: "im-scroll-anchor" })
    ] }),
    /* @__PURE__ */ e("div", { className: "im-dock", children: /* @__PURE__ */ r("div", { className: "im-compose", children: [
      /* @__PURE__ */ e(
        "textarea",
        {
          ref: J,
          rows: 1,
          placeholder: I ? l.scope === "group" ? "Markdown 发送到该群…" : "Markdown 私聊…" : l.scope === "group" ? "发送到该群…" : "发送私聊…",
          value: z,
          onChange: (n) => {
            g(n.target.value), L(n.target);
          },
          onInput: (n) => L(n.currentTarget)
        }
      ),
      /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: `btn-send${I ? " md-on" : ""}${oe > 0 ? " holding" : ""}${z.trim() ? "" : " is-empty"}`,
          disabled: C,
          style: oe > 0 ? { "--hold": String(oe) } : void 0,
          title: "单击发送 · 长按 3 秒打开格式设置",
          onPointerDown: _e,
          onPointerUp: Oe,
          onPointerLeave: Se,
          onPointerCancel: Se,
          onContextMenu: (n) => n.preventDefault(),
          children: I ? "MD" : "发送"
        }
      )
    ] }) }),
    Fe ? /* @__PURE__ */ e("div", { className: "im-send-cfg-mask", onClick: () => re(!1), children: /* @__PURE__ */ r("div", { className: "im-send-cfg", role: "dialog", "aria-label": "发送格式", onClick: (n) => n.stopPropagation(), children: [
      /* @__PURE__ */ e("div", { className: "im-send-cfg-title", children: "发送格式" }),
      /* @__PURE__ */ e("p", { className: "im-send-cfg-hint", children: "长按发送按钮 3 秒可打开本设置。Markdown 将按官方原生 md 消息发出。" }),
      /* @__PURE__ */ r("label", { className: `im-send-cfg-opt${I ? "" : " on"}`, children: [
        /* @__PURE__ */ e(
          "input",
          {
            type: "radio",
            name: "im-send-fmt",
            checked: !I,
            onChange: () => Ce(!1)
          }
        ),
        /* @__PURE__ */ r("span", { children: [
          /* @__PURE__ */ e("strong", { children: "普通文本" }),
          /* @__PURE__ */ e("em", { children: "content 文本消息" })
        ] })
      ] }),
      /* @__PURE__ */ r("label", { className: `im-send-cfg-opt${I ? " on" : ""}`, children: [
        /* @__PURE__ */ e(
          "input",
          {
            type: "radio",
            name: "im-send-fmt",
            checked: I,
            onChange: () => Ce(!0)
          }
        ),
        /* @__PURE__ */ r("span", { children: [
          /* @__PURE__ */ e("strong", { children: "Markdown" }),
          /* @__PURE__ */ e("em", { children: "原生 markdown.content" })
        ] })
      ] }),
      /* @__PURE__ */ e("button", { type: "button", className: "im-send-cfg-close", onClick: () => re(!1), children: "完成" })
    ] }) }) : null,
    W ? /* @__PURE__ */ e("div", { className: "im-send-cfg-mask", onClick: () => !V && G(null), children: /* @__PURE__ */ r("div", { className: "im-send-cfg", role: "dialog", "aria-label": "撤回消息", onClick: (n) => n.stopPropagation(), children: [
      /* @__PURE__ */ e("div", { className: "im-send-cfg-title", children: "撤回消息" }),
      /* @__PURE__ */ e("p", { className: "im-send-cfg-hint", children: "确认撤回这条消息吗？群内撤回用户消息需要机器人具备管理权限；自己发出的消息通常限 2 分钟内。" }),
      /* @__PURE__ */ e("div", { className: "im-recall-preview", children: String(W.content || "").slice(0, 120) || "(无内容)" }),
      /* @__PURE__ */ r("div", { className: "im-recall-actions", children: [
        /* @__PURE__ */ e(
          "button",
          {
            type: "button",
            className: "im-send-cfg-close ghost",
            disabled: V,
            onClick: () => G(null),
            children: "取消"
          }
        ),
        /* @__PURE__ */ e(
          "button",
          {
            type: "button",
            className: "im-send-cfg-close danger",
            disabled: V,
            onClick: () => void Ee(),
            children: V ? "撤回中…" : "确认撤回"
          }
        )
      ] })
    ] }) }) : null,
    xe ? /* @__PURE__ */ r(
      "div",
      {
        className: "im-lightbox",
        role: "dialog",
        "aria-label": "图片预览",
        onClick: () => K(""),
        onKeyDown: (n) => {
          n.key === "Escape" && K("");
        },
        children: [
          /* @__PURE__ */ e("button", { type: "button", className: "im-lightbox-close", onClick: () => K(""), children: "关闭" }),
          /* @__PURE__ */ e(
            "img",
            {
              src: xe,
              alt: "预览",
              onClick: (n) => n.stopPropagation()
            }
          )
        ]
      }
    ) : null
  ] }) }) }) : /* @__PURE__ */ e("section", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }, children: /* @__PURE__ */ e("div", { className: "im-shell im-shell-page", children: /* @__PURE__ */ r("div", { className: "im-list-col im-list-full", children: [
    /* @__PURE__ */ e("div", { className: "im-list-head", children: /* @__PURE__ */ e(
      "input",
      {
        type: "search",
        placeholder: "搜索会话…",
        value: s,
        onChange: (n) => m(n.target.value),
        onKeyDown: (n) => {
          n.key === "Enter" && F();
        }
      }
    ) }),
    /* @__PURE__ */ e("div", { className: "im-tabs", role: "tablist", children: [
      ["all", "全部"],
      ["private", "私聊"],
      ["group", "群聊"]
    ].map(([n, d]) => /* @__PURE__ */ e(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": p === n,
        className: `im-tab${p === n ? " active" : ""}`,
        onClick: () => f(n),
        children: d
      },
      n
    )) }),
    /* @__PURE__ */ r("div", { className: "im-sessions", children: [
      Te.length ? null : /* @__PURE__ */ e("div", { className: "im-empty", children: "暂无会话" }),
      Te.map((n) => {
        const d = n.scope === "private" ? n.title || P(n.id) : n.title && n.title !== n.id ? n.title : P(n.id);
        return /* @__PURE__ */ r(
          "div",
          {
            className: `im-session${n.pinned ? " pinned" : ""}`,
            onClick: () => void Ae(n.scope, n.id, n),
            children: [
              /* @__PURE__ */ e("img", { src: n.avatar || "", alt: "", onError: (b) => {
                b.target.style.visibility = "hidden";
              } }),
              /* @__PURE__ */ r("div", { className: "im-session-body", children: [
                /* @__PURE__ */ r("div", { className: "im-session-top", children: [
                  /* @__PURE__ */ e("span", { className: `im-type ${n.scope}`, children: n.scope === "group" ? "群聊" : "私聊" }),
                  /* @__PURE__ */ e("span", { className: "im-session-title", title: d, children: d }),
                  /* @__PURE__ */ e(
                    "button",
                    {
                      type: "button",
                      className: `im-pin-btn${n.pinned ? " on" : ""}`,
                      title: n.pinned ? "取消星标" : "星标置顶",
                      "aria-label": n.pinned ? "取消星标" : "星标置顶",
                      onClick: (b) => {
                        b.stopPropagation(), Me(n.key);
                      },
                      children: n.pinned ? "★" : "☆"
                    }
                  )
                ] }),
                /* @__PURE__ */ r("div", { className: "im-session-bottom", children: [
                  /* @__PURE__ */ e("div", { className: "im-session-preview", children: n.lastContent || " " }),
                  /* @__PURE__ */ e("span", { className: "im-session-time", children: Ve(n.lastTs, n.lastTime) })
                ] })
              ] })
            ]
          },
          n.key
        );
      })
    ] })
  ] }) }) });
}
function an({
  api: a,
  toast: i,
  onError: t
}) {
  const [o, s] = k(!1), [m, p] = k(null), f = N(null), x = H((g) => {
    p(g), !!(g.installing || g.phase === "running") && !f.current && (f.current = window.setInterval(async () => {
      try {
        const R = (await a.get("/sharp-deps/status")).data || {};
        p(R), R.installing || R.phase === "running" || (f.current && window.clearInterval(f.current), f.current = null, i("Sharp 状态已更新"));
      } catch {
      }
    }, 2e3));
  }, [a, i]), c = H(async () => {
    t("");
    try {
      const [g, C] = await Promise.all([
        a.get("/config"),
        a.get("/sharp-deps/status")
      ]);
      s(!!g.data?.调试开关), x(C.data || {});
    } catch (g) {
      t(g instanceof Error ? g.message : String(g));
    }
  }, [a, x, t]);
  M(() => (c(), () => {
    f.current && window.clearInterval(f.current);
  }), [c]);
  const u = async () => {
    const g = !o;
    try {
      const C = await a.post("/config", { 调试开关: g });
      s(!!C.data?.调试开关), i(C.message || (g ? "调试开关已开启" : "调试开关已关闭"));
    } catch (C) {
      t(C instanceof Error ? C.message : String(C));
    }
  }, y = async () => {
    try {
      const g = await a.post("/sharp-deps/install", {});
      i(g.message || "已开始安装"), x(g.data || { phase: "running", installing: !0, percent: 8 }), await c();
    } catch (g) {
      i(g instanceof Error ? g.message : String(g));
    }
  }, l = String(m?.phase || ""), $ = !!m?.available, h = l === "running" ? "run" : $ ? "ok" : l === "failed" ? "fail" : "", w = l === "running" ? "安装中" : $ ? "可用" : l === "failed" ? "失败" : "未安装", z = !!(m?.installing || l === "running");
  return /* @__PURE__ */ r("section", { children: [
    /* @__PURE__ */ e("h1", { className: "page-title", children: "系统设置" }),
    /* @__PURE__ */ r("div", { className: "panel", style: { marginBottom: 12 }, children: [
      /* @__PURE__ */ r("div", { className: "row", style: { marginTop: 0, justifyContent: "space-between" }, children: [
        /* @__PURE__ */ e("h3", { style: { margin: 0 }, children: "调试开关" }),
        /* @__PURE__ */ e("span", { className: `badge${o ? " run" : ""}`, children: o ? "已开启" : "关闭" })
      ] }),
      /* @__PURE__ */ r("p", { className: "setting-desc", children: [
        "开启后，签到、今日运势、音乐收藏等",
        /* @__PURE__ */ e("strong", { children: "用户性功能只读不写" }),
        "：仍可正常读取并出图/回复，但不会落盘更新用户数据。日志与消息记录不受影响。"
      ] }),
      /* @__PURE__ */ r("div", { className: "switch-row", children: [
        /* @__PURE__ */ r("div", { children: [
          /* @__PURE__ */ e("div", { className: "label", children: "用户数据只读模式" }),
          /* @__PURE__ */ e("div", { className: "hint", children: "适合联调、演示、压测时避免污染正式签到/运势数据" })
        ] }),
        /* @__PURE__ */ e("button", { type: "button", className: `switch${o ? " on" : ""}`, "aria-pressed": o, onClick: () => void u() })
      ] })
    ] }),
    /* @__PURE__ */ r("div", { className: "panel", children: [
      /* @__PURE__ */ r("div", { className: "row", style: { marginTop: 0, justifyContent: "space-between" }, children: [
        /* @__PURE__ */ e("h3", { style: { margin: 0 }, children: "Sharp 运行时依赖" }),
        /* @__PURE__ */ e("span", { className: `badge ${h}`, children: w })
      ] }),
      /* @__PURE__ */ e("div", { className: "status", children: String(m?.message || m?.detail || "正在检测…") }),
      /* @__PURE__ */ e("div", { className: `progress${z ? " show" : ""}`, children: /* @__PURE__ */ e("i", { style: { width: `${Math.max(5, Number(m?.percent) || 8)}%` } }) }),
      m?.manualHint && (l === "failed" || !$) ? /* @__PURE__ */ e("pre", { className: "status", style: { marginTop: 10, fontSize: 11 }, children: String(m.manualHint) }) : null,
      /* @__PURE__ */ r("div", { className: "row", children: [
        /* @__PURE__ */ e("button", { type: "button", className: "btn btn-solid", disabled: z || $, onClick: () => void y(), children: "安装 Sharp 依赖" }),
        /* @__PURE__ */ e("button", { type: "button", className: "btn btn-secondary", onClick: () => void c(), children: "刷新状态" })
      ] })
    ] })
  ] });
}
const rn = '.gfmk-admin{--ink: #0b1220;--surface: rgba(255, 255, 255, .2);--surface-strong: rgba(255, 255, 255, .3);--surface-soft: rgba(255, 255, 255, .1);--sidebar: rgba(255, 255, 255, .3);--text: #0f172a;--heading: #1e293b;--muted: #64748b;--accent: #0f766e;--accent-2: #0d9488;--accent-soft: rgba(15, 118, 110, .12);--ok: #059669;--warn: #b45309;--fail: #dc2626;--chip-group: rgba(224, 242, 254, .75);--chip-group-t: #0369a1;--chip-priv: rgba(255, 228, 230, .75);--chip-priv-t: #be123c;--radius: 16px;--radius-sm: 10px;--font: "Manrope", "PingFang SC", "Microsoft YaHei", sans-serif;--display: "Manrope", "PingFang SC", "Microsoft YaHei", sans-serif;--mono: ui-monospace, Consolas, monospace;--sidebar-w: 220px;--shadow: 0 8px 24px rgba(148, 163, 184, .18);--glass-blur: blur(16px);--safe-bottom: env(safe-area-inset-bottom, 0px);--mobile-nav-h: 4.25rem;box-sizing:border-box;display:flex;min-height:100%;height:100%;max-height:none;color:var(--text);font-family:var(--font);border-radius:0;overflow:hidden;background:radial-gradient(900px 520px at 8% -6%,rgba(45,212,191,.28),transparent 55%),radial-gradient(780px 480px at 96% 4%,rgba(56,189,248,.2),transparent 52%),radial-gradient(640px 420px at 70% 110%,rgba(165,243,252,.18),transparent 50%),linear-gradient(155deg,#e0f2fe,#ecfeff 42%,#e0f7f4)}.gfmk-admin *,.gfmk-admin *:before,.gfmk-admin *:after{box-sizing:border-box}.gfmk-admin *{scrollbar-width:none}.gfmk-admin *::-webkit-scrollbar{display:none}.gfmk-admin .sidebar{width:var(--sidebar-w);flex-shrink:0;display:flex;flex-direction:column;gap:4px;padding:18px 12px;color:var(--heading);background:#ffffff4d;backdrop-filter:var(--glass-blur);-webkit-backdrop-filter:var(--glass-blur);border-right:1px solid rgba(255,255,255,.4);overflow:auto}.gfmk-admin .brand{font-family:var(--display);font-weight:800;font-size:1.35rem;padding:8px 10px 18px;line-height:1.1}.gfmk-admin .brand .mark{background:linear-gradient(120deg,#0f766e 10%,#0d9488,#38bdf8);-webkit-background-clip:text;background-clip:text;color:transparent}.gfmk-admin .brand small{display:block;margin-top:6px;font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#475569a6}.gfmk-admin .nav-label{font-size:10px;color:#64748bd9;letter-spacing:.14em;text-transform:uppercase;padding:14px 10px 6px;font-weight:600}.gfmk-admin .nav-item{display:flex;align-items:center;gap:8px;width:100%;padding:10px 12px;border-radius:12px;border:1px solid transparent;background:transparent;color:#334155d1;font:inherit;font-size:13px;font-weight:600;text-align:left;cursor:pointer;transition:.2s}.gfmk-admin .nav-item:hover{background:#ffffff73;color:var(--heading)}.gfmk-admin .nav-item.active{background:#14b8a633;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(45,212,191,.4);color:#0f766e;font-weight:600;box-shadow:0 4px 14px #14b8a61f}.gfmk-admin .main{flex:1;min-width:0;overflow:auto;padding:20px 22px 28px}.gfmk-admin .page-title{margin:0 0 14px;font-family:var(--display);font-size:1.45rem;font-weight:800;color:var(--heading)}.gfmk-admin .toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}.gfmk-admin .toolbar-glass{padding:12px;border-radius:12px;background:#fff3;border:1px solid rgba(255,255,255,.4);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 6px 18px #94a3b81f}.gfmk-admin .toolbar label{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#1e293b;background:#ffffff38;border:1px solid rgba(255,255,255,.35);border-radius:10px;padding:6px 10px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}.gfmk-admin .toolbar label input,.gfmk-admin .toolbar label select{border:0;background:transparent;font:inherit;color:var(--text)}.gfmk-admin .toolbar label input::placeholder{color:#94a3b8}.gfmk-admin .btn{font:inherit;font-size:13px;font-weight:600;border-radius:var(--radius-sm);padding:9px 13px;cursor:pointer;transition:background .2s,border-color .2s,color .2s,transform .15s}.gfmk-admin .btn-ghost{background:transparent;border:1px solid rgba(255,255,255,.55);color:#0f766e;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}.gfmk-admin .btn-ghost:hover{background:#ffffff59;border-color:#fffc;color:#0d9488}.gfmk-admin .btn-solid{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border:0;box-shadow:0 8px 20px #0f766e47}.gfmk-admin .btn-solid:disabled{opacity:.5;cursor:not-allowed}.gfmk-admin .btn-secondary{background:#fff3;border:1px solid rgba(255,255,255,.4);color:var(--text)}.gfmk-admin .seg{display:inline-flex;border:1px solid rgba(255,255,255,.4);border-radius:var(--radius-sm);overflow:hidden;background:#fff3}.gfmk-admin .seg button{border:0;background:transparent;padding:9px 13px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;color:var(--text)}.gfmk-admin .seg button.active{background:#0f766e38;color:var(--accent-2)}.gfmk-admin .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:14px}.gfmk-admin .stat-card,.gfmk-admin .panel{background:#fff3;border:1px solid rgba(255,255,255,.4);border-radius:1rem;padding:16px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 10px 28px #94a3b82e;transition:background .25s,transform .25s,box-shadow .25s}.gfmk-admin .stat-card{background:#ffffff47;display:flex;flex-direction:column;gap:4px}.gfmk-admin .stat-card:hover{background:#ffffff5c;transform:translateY(-2px);box-shadow:0 14px 32px #94a3b83d}.gfmk-admin .stat-card .label{color:#475569;font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;margin-bottom:2px}.gfmk-admin .stat-card .value{font-family:var(--display);font-size:1.5rem;font-weight:800;color:#0d9488;font-variant-numeric:tabular-nums;line-height:1.2}.gfmk-admin .stat-card .hint{color:#94a3b8;font-size:12px;margin-top:2px}.gfmk-admin .bot-row{display:flex;align-items:center;gap:10px;margin-top:2px}.gfmk-admin .bot-row img{width:40px;height:40px;border-radius:12px;object-fit:cover;background:#e2e8f08c;flex-shrink:0}.gfmk-admin .bot-meta{flex:1;min-width:0}.gfmk-admin .bot-name{font-family:var(--display);font-size:1.25rem;font-weight:800;color:var(--heading);line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gfmk-admin .bot-sub{margin-top:4px;font-size:11px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gfmk-admin .status-pill{flex-shrink:0;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#4ade8033;color:#16a34a}.gfmk-admin .status-pill.off{background:#94a3b840;color:#64748b}.gfmk-admin .panel{background:#fff3}.gfmk-admin .ranks-panel{min-height:280px}.gfmk-admin .panel h3{margin:0 0 12px;font-family:var(--display);font-size:1.02rem;font-weight:700;color:#1e293b}.gfmk-admin .split{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;align-items:stretch}.gfmk-admin .split>.panel{display:flex;flex-direction:column;min-height:160px}.gfmk-admin .ranks-split>.panel{min-height:280px}.gfmk-admin .rank-list{list-style:none;margin:0;padding:0;flex:1;display:flex;flex-direction:column;gap:8px}.gfmk-admin .rank-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:12px;border:1px solid transparent;background:#ffffff14;cursor:default;transition:background .2s,border-color .2s}.gfmk-admin .rank-row:hover{background:#ffffff38;border-color:#ffffff52}.gfmk-admin .rank-row-main{display:flex;align-items:center;gap:12px;flex:1;min-width:0;overflow:hidden}.gfmk-admin .rank-idx{width:24px;height:24px;border-radius:999px;background:#ffffff4d;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.4);color:#64748b;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:var(--mono);flex-shrink:0}.gfmk-admin .rank-list img,.gfmk-admin .rank-row img{width:40px;height:40px;border-radius:999px;object-fit:cover;flex-shrink:0;background:#ffffff1f;border:1px solid rgba(255,255,255,.22)}.gfmk-admin .rank-name{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.gfmk-admin .rank-nick{display:block;font-size:13px;font-weight:600;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}.gfmk-admin .rank-id{display:block;color:#94a3b8;font-size:10px;font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}.gfmk-admin .rank-count{flex-shrink:0;font-weight:700;font-size:13px;color:#0f766e;font-family:var(--display);padding:2px 12px;border-radius:8px;background:#14b8a633;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(45,212,191,.3);box-shadow:0 2px 8px #14b8a614}.gfmk-admin .empty{margin:auto;color:#94a3b8;font-size:13px;text-align:center;background:transparent;border:0;padding:28px 16px;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}.gfmk-admin .rank-empty{flex:1;min-height:160px;margin:4px 0 0;background:#ffffff1a;border:1px solid rgba(255,255,255,.2);border-radius:12px;color:#94a3b8}.gfmk-admin .empty-icon{width:40px;height:40px;border-radius:12px;border:1.5px dashed rgba(148,163,184,.45);background:#94a3b814}.gfmk-admin .err{color:var(--fail);font-size:13px;margin-top:8px;font-weight:600}.gfmk-admin .chart-wrap{border-radius:14px;padding:12px 10px 8px;background:#0f172a0d;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.25)}.gfmk-admin .chart-body{display:grid;grid-template-columns:36px 1fr;gap:8px}.gfmk-admin .chart-y{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;height:180px;font-size:11px;color:#94a3b8;font-variant-numeric:tabular-nums}.gfmk-admin .chart-plot{height:180px;border-left:1px solid rgba(15,23,42,.1);border-bottom:1px solid rgba(15,23,42,.1);border-radius:0 12px 0 0;background:transparent;overflow:hidden}.gfmk-admin .chart-plot svg{display:block;width:100%;height:180px;filter:drop-shadow(0 0 6px rgba(0,200,150,.4))}.gfmk-admin .chart-x{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));margin:8px 0 0 44px;font-size:11px;color:#94a3b8}.gfmk-admin .chart-x span{text-align:center}.gfmk-admin .im-shell{flex:1;min-height:0;height:100%;display:flex;flex-direction:column;border-radius:1rem;overflow:hidden;border:1px solid rgba(255,255,255,.4);background:#ffffff1f;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 10px 32px #94a3b826}.gfmk-admin .im-shell-page{min-height:0}.gfmk-admin .im-list-col{display:flex;flex-direction:column;min-height:0;flex:1;background:#fff3;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.gfmk-admin .im-list-full,.gfmk-admin .im-pane-full{flex:1;min-height:0;width:100%;position:relative}.gfmk-admin .im-tabs{display:flex;gap:6px;padding:8px 10px 0}.gfmk-admin .im-tab{flex:1;border:1px solid transparent;background:transparent;border-radius:999px;padding:7px 10px;font:inherit;font-size:12px;font-weight:600;color:#64748b;cursor:pointer;transition:.2s}.gfmk-admin .im-tab:hover{background:#fff3;color:#334155}.gfmk-admin .im-tab.active{background:#14b8a62e;border-color:#2dd4bf66;color:#0f766e;box-shadow:0 4px 12px #14b8a61a}.gfmk-admin .im-back{flex-shrink:0;border:1px solid rgba(255,255,255,.4);background:#ffffff38;backdrop-filter:blur(6px);border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:600;color:#0f766e;cursor:pointer;transition:background .15s,transform .15s}.gfmk-admin .im-back:hover{background:#ffffff61;transform:translate(-1px)}.gfmk-admin .im-list-head{display:flex;gap:8px;padding:10px;border-bottom:1px solid rgba(255,255,255,.25);background:#ffffff14}.gfmk-admin .im-list-head input{flex:1;min-width:0;border:1px solid rgba(255,255,255,.4);background:#fff3;backdrop-filter:blur(6px);border-radius:12px;padding:8px 10px;font:inherit;font-size:13px;color:#334155}.gfmk-admin .im-list-head input::placeholder{color:#94a3b8}.gfmk-admin .im-sessions{flex:1;overflow:auto;min-height:0;padding:10px;display:flex;flex-direction:column;gap:10px}.gfmk-admin .im-session{display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:center;padding:12px;cursor:pointer;border-radius:14px;border:1px solid rgba(255,255,255,.42);background:#ffffff2e;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 4px 14px #94a3b81a;transition:background .2s,border-color .2s,box-shadow .2s}.gfmk-admin .im-session:hover{background:#ffffff47;border-color:#ffffff94;box-shadow:0 8px 20px #94a3b829}.gfmk-admin .im-session.active{background:#ffffff42;border-color:#2dd4bf73;box-shadow:0 6px 18px #14b8a61f}.gfmk-admin .im-session.pinned{border-color:#2dd4bf80;background:#ffffff38;box-shadow:inset 3px 0 #0d9488a6,0 4px 14px #94a3b81a}.gfmk-admin .im-session img{width:44px;height:44px;border-radius:14px;object-fit:cover;background:#e2e8f08c;border:1px solid rgba(255,255,255,.35)}.gfmk-admin .im-session-body{min-width:0;display:flex;flex-direction:column;gap:4px}.gfmk-admin .im-session-top{display:flex;align-items:center;gap:6px;min-width:0}.gfmk-admin .im-session-title{flex:1;min-width:0;font-size:13px;font-weight:700;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gfmk-admin .im-session-bottom{display:flex;align-items:center;gap:8px;min-width:0}.gfmk-admin .im-session-preview{flex:1;min-width:0;margin-top:0;font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gfmk-admin .im-session-meta{display:none}.gfmk-admin .im-type,.gfmk-admin .im-pane-type{flex-shrink:0;font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px;border:1px solid transparent;letter-spacing:.02em}.gfmk-admin .im-type.group,.gfmk-admin .im-pane-type.group{background:#bae6fdbf;border-color:#38bdf859;color:#0369a1}.gfmk-admin .im-type.private,.gfmk-admin .im-pane-type.private{background:#fecdd3bf;border-color:#fb718559;color:#be123c}.gfmk-admin .im-pane-type.idle{background:#ffffff38;color:#64748b;border:1px solid rgba(255,255,255,.3)}.gfmk-admin .im-session-time{flex-shrink:0;font-size:11px;color:#94a3b8}.gfmk-admin .im-pin-btn{flex-shrink:0;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.45);background:#ffffff47;border-radius:9px;padding:0;cursor:pointer;font-size:14px;line-height:1;color:#94a3b8;backdrop-filter:blur(4px);transition:background .15s,color .15s,border-color .15s}.gfmk-admin .im-pin-btn:hover{background:#ffffff6b;color:#0d9488}.gfmk-admin .im-pin-btn.on{color:#0d9488;background:#0d948829;border-color:#2dd4bf73}.gfmk-admin .im-pane{display:flex;flex-direction:column;min-width:0;min-height:0;flex:1;background:#fff3;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}.gfmk-admin .im-pane-head{min-height:56px;padding:8px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(255,255,255,.3);background:#ffffff1f;backdrop-filter:blur(10px)}.gfmk-admin .im-pane-title{font-weight:700;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gfmk-admin .im-pane-sub{font-size:12px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gfmk-admin .im-messages{flex:1;min-height:0;overflow:auto;padding:16px 18px;display:flex;flex-direction:column;gap:14px;background:transparent}.gfmk-admin .im-empty{margin:auto;padding:12px 20px;color:#94a3b8;font-size:13px;text-align:center;background:#ffffff26;border:1px solid rgba(255,255,255,.25);border-radius:12px;backdrop-filter:blur(6px)}.gfmk-admin .im-msg{display:grid;grid-template-columns:36px 1fr;gap:10px;max-width:78%;align-self:flex-start}.gfmk-admin .im-msg.out{grid-template-columns:1fr 36px;align-self:flex-end}.gfmk-admin .im-msg img{width:36px;height:36px;border-radius:999px;object-fit:cover;background:#e2e8f08c}.gfmk-admin .im-msg img.im-avatar-at{cursor:pointer;transition:box-shadow .15s,transform .15s}.gfmk-admin .im-msg img.im-avatar-at:hover{transform:scale(1.06);box-shadow:0 0 0 2px #14b8a68c}.gfmk-admin .im-msg.out img{order:2}.gfmk-admin .im-msg.out .im-msg-body{order:1;text-align:right}.gfmk-admin .im-msg-head{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;margin-bottom:4px}.gfmk-admin .im-msg.out .im-msg-head{justify-content:flex-end}.gfmk-admin .im-msg-name{font-size:13px;font-weight:600;color:#475569}.gfmk-admin .im-msg-time{font-size:10px;color:#94a3b8}.gfmk-admin .im-bubble{margin-top:0;display:inline-block;max-width:100%;background:#ffffff4d;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.5);border-radius:1rem;border-top-left-radius:4px;padding:10px 14px;font-size:13px;line-height:1.55;text-align:left;color:#1e293b;overflow-wrap:anywhere;word-break:break-word;box-shadow:0 4px 14px #94a3b81f;position:relative;overflow:hidden;user-select:none;touch-action:manipulation}.gfmk-admin .im-bubble.recallable{cursor:pointer}.gfmk-admin .im-bubble.holding:after{content:"";position:absolute;left:0;bottom:0;height:3px;width:calc(var(--hold, 0) * 100%);background:#14b8a6f2;pointer-events:none}.gfmk-admin .im-msg.out .im-bubble{background:#14b8a6cc;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.3);border-radius:1rem;border-top-right-radius:4px;color:#fff;box-shadow:0 10px 24px #14b8a638}.gfmk-admin .im-bubble.md p{margin:0 0 .5em}.gfmk-admin .im-bubble.md p:last-child{margin-bottom:0}.gfmk-admin .im-bubble.md img,.gfmk-admin .im-bubble img.im-zoom-img{max-width:min(100%,720px);width:auto;height:auto;max-height:min(70vh,960px);border-radius:10px;display:block;margin:.4em 0;cursor:zoom-in;object-fit:contain;background:#0f172a0a}.gfmk-admin .im-bubble.md code,.gfmk-admin .im-btn-chip{display:inline-block;margin:2px 0;padding:6px 12px;border-radius:8px;background:#fff3;border:1px solid rgba(255,255,255,.3);color:#334155;font-family:inherit;font-size:12px;font-weight:600;transition:background .15s}.gfmk-admin .im-msg.out .im-bubble.md code,.gfmk-admin .im-msg.out .im-btn-chip{background:#ffffff2e;border-color:#ffffff47;color:#fff}.gfmk-admin .im-dock{border-top:1px solid rgba(255,255,255,.3);background:#ffffff1a;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.gfmk-admin .im-compose{border-top:0;padding:12px 14px;display:flex;flex-direction:row;gap:12px;align-items:flex-end;background:transparent}.gfmk-admin .im-compose textarea{flex:1 1 0;min-width:0;width:auto;height:48px;min-height:48px;max-height:120px;resize:none;border:1px solid rgba(255,255,255,.4);border-radius:12px;padding:13px 12px;font:inherit;font-size:13px;line-height:1.4;color:#334155;background:#fff3;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);outline:none;transition:background .2s,box-shadow .2s;overflow-y:auto;box-sizing:border-box}.gfmk-admin .im-compose textarea::placeholder{color:#94a3b8}.gfmk-admin .im-compose textarea:focus{background:#ffffff4d;box-shadow:0 0 0 2px #14b8a647}.gfmk-admin .im-compose textarea:disabled{opacity:.55}.gfmk-admin .im-compose .btn-send{flex:0 0 auto;flex-shrink:0;align-self:flex-end;position:relative;width:auto;max-width:5.5rem;height:48px;min-height:48px;min-width:4.5rem;padding:0 18px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:#14b8a6cc;backdrop-filter:blur(6px);color:#fff;font:inherit;font-size:13px;font-weight:700;line-height:1;cursor:pointer;user-select:none;touch-action:none;box-shadow:0 10px 24px #14b8a638;transition:background .2s,transform .15s,opacity .15s;overflow:hidden}.gfmk-admin .im-compose .btn-send.md-on{background:#0e7490e0;box-shadow:0 10px 24px #0e749040}.gfmk-admin .im-compose .btn-send.is-empty:not(.holding):not(:disabled){opacity:.55}.gfmk-admin .im-compose .btn-send.holding{transform:scale(.97)}.gfmk-admin .im-compose .btn-send.holding:after{content:"";position:absolute;left:0;bottom:0;height:3px;width:calc(var(--hold, 0) * 100%);background:#fffffff2;pointer-events:none}.gfmk-admin .im-compose .btn-send:hover:not(:disabled){background:#14b8a6;transform:translateY(-1px)}.gfmk-admin .im-compose .btn-send.md-on:hover:not(:disabled){background:#0e7490}.gfmk-admin .im-compose .btn-send:disabled{opacity:.5;cursor:not-allowed;transform:none}.gfmk-admin .im-send-cfg-mask{position:absolute;inset:0;z-index:40;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:#0f172a47;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}.gfmk-admin .im-send-cfg{width:min(360px,100%);border-radius:16px;border:1px solid rgba(255,255,255,.45);background:#ffffffd1;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 18px 40px #0f172a2e;padding:16px 16px 14px;margin-bottom:8px}.gfmk-admin .im-send-cfg-title{font-size:15px;font-weight:800;color:#0f172a;margin-bottom:6px}.gfmk-admin .im-send-cfg-hint{margin:0 0 12px;font-size:12px;line-height:1.45;color:#64748b}.gfmk-admin .im-send-cfg-opt{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.35);background:#ffffff73;margin-bottom:8px;cursor:pointer;transition:border-color .15s,background .15s}.gfmk-admin .im-send-cfg-opt.on{border-color:#14b8a68c;background:#14b8a61f}.gfmk-admin .im-send-cfg-opt input{margin-top:3px;accent-color:#14b8a6}.gfmk-admin .im-send-cfg-opt span{display:flex;flex-direction:column;gap:2px;min-width:0}.gfmk-admin .im-send-cfg-opt strong{font-size:13px;color:#0f172a}.gfmk-admin .im-send-cfg-opt em{font-style:normal;font-size:11px;color:#64748b}.gfmk-admin .im-send-cfg-close{width:100%;margin-top:4px;height:40px;border-radius:11px;border:1px solid rgba(255,255,255,.35);background:#14b8a6d9;color:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.gfmk-admin .im-send-cfg-close.ghost{background:#ffffff73;color:#334155;border-color:#94a3b859}.gfmk-admin .im-send-cfg-close.danger{background:#dc2626d9;box-shadow:0 8px 18px #dc262633}.gfmk-admin .im-send-cfg-close:disabled{opacity:.55;cursor:not-allowed}.gfmk-admin .im-recall-preview{margin:0 0 12px;padding:10px 12px;border-radius:10px;background:#0f172a0f;border:1px solid rgba(148,163,184,.28);font-size:12px;line-height:1.45;color:#475569;white-space:pre-wrap;word-break:break-word;max-height:96px;overflow:auto}.gfmk-admin .im-recall-actions{display:flex;gap:8px}.gfmk-admin .im-recall-actions .im-send-cfg-close{flex:1;margin-top:0}.gfmk-admin .im-lightbox{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:16px;background:#020617c7;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);cursor:zoom-out}.gfmk-admin .im-lightbox img{max-width:min(96vw,1400px);max-height:92vh;width:auto;height:auto;object-fit:contain;border-radius:12px;box-shadow:0 24px 64px #00000073;background:#0b1220;cursor:default}.gfmk-admin .im-lightbox-close{position:absolute;top:max(12px,env(safe-area-inset-top,0px));right:max(12px,env(safe-area-inset-right,0px));height:40px;min-width:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:#ffffff24;color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer}.gfmk-admin .im-scroll-anchor{width:100%;height:1px;flex-shrink:0}.gfmk-admin .mobile-tabbar{display:none}.gfmk-admin .log-table{width:100%;border-collapse:collapse;font-size:13px}.gfmk-admin .log-table th,.gfmk-admin .log-table td{text-align:left;padding:10px 8px;border-bottom:1px solid rgba(15,23,42,.06);vertical-align:top}.gfmk-admin .log-table th{color:var(--muted);font-size:12px;font-weight:700}.gfmk-admin .chip{display:inline-block;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700}.gfmk-admin .chip.group{background:var(--chip-group);color:var(--chip-group-t)}.gfmk-admin .chip.private{background:var(--chip-priv);color:var(--chip-priv-t)}.gfmk-admin .mono{font-family:var(--mono);font-size:12px;color:var(--muted)}.gfmk-admin .content-cell{max-width:420px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}.gfmk-admin .pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:10px;font-size:13px;color:var(--muted)}.gfmk-admin .pager button{font:inherit;font-size:13px;font-weight:600;border:1px solid rgba(255,255,255,.4);background:#fff3;border-radius:var(--radius-sm);padding:7px 11px;cursor:pointer}.gfmk-admin .pager button:disabled{opacity:.45;cursor:not-allowed}.gfmk-admin .badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:8px;font-size:12px;font-weight:700;background:var(--accent-soft);color:var(--accent-2)}.gfmk-admin .badge.ok{background:#0596691f;color:var(--ok)}.gfmk-admin .badge.run{background:#b453091f;color:var(--warn)}.gfmk-admin .badge.fail{background:#dc26261f;color:var(--fail)}.gfmk-admin .setting-desc{margin:8px 0 0;font-size:13px;color:var(--muted);line-height:1.55}.gfmk-admin .switch-row{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:12px;padding:12px 14px;border-radius:12px;background:#ffffff29;border:1px solid rgba(255,255,255,.35)}.gfmk-admin .switch-row .label{font-size:14px;font-weight:700;color:var(--heading)}.gfmk-admin .switch-row .hint{margin-top:4px;font-size:12px;color:var(--muted)}.gfmk-admin .switch{position:relative;width:46px;height:26px;flex-shrink:0;border-radius:999px;border:none;cursor:pointer;background:#cbd5e1}.gfmk-admin .switch.on{background:var(--accent)}.gfmk-admin .switch:after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 2px 6px #0000002e}.gfmk-admin .switch.on:after{transform:translate(20px)}.gfmk-admin .status{white-space:pre-wrap;font-size:13px;line-height:1.5;margin-top:10px;background:#ffffff2e;border:1px solid rgba(255,255,255,.35);border-radius:12px;padding:10px 12px}.gfmk-admin .progress{display:none;margin-top:10px;height:8px;background:#ffffff40;border-radius:999px;overflow:hidden}.gfmk-admin .progress>i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--accent),#2dd4bf);transition:width .25s}.gfmk-admin .progress.show{display:block}.gfmk-admin .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}.gfmk-admin .toast{position:fixed;left:50%;top:max(16px,env(safe-area-inset-top,0px));bottom:auto;right:auto;z-index:80;transform:translate(-50%) translateY(-8px);background:#0b1220c7;color:#fff;padding:10px 16px;border-radius:12px;font-size:13px;font-weight:600;opacity:0;pointer-events:none;transition:opacity .22s,transform .22s;border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);max-width:min(90vw,320px);text-align:center;box-shadow:0 10px 28px #0f172a2e}.gfmk-admin .toast.show{opacity:1;transform:translate(-50%) translateY(0)}.gfmk-admin .search{min-width:180px;border:1px solid rgba(255,255,255,.4);background:#fff3;border-radius:var(--radius-sm);padding:9px 13px;font:inherit;font-size:13px;backdrop-filter:blur(6px)}@media(max-width:980px){.gfmk-admin .stats{grid-template-columns:repeat(2,1fr)}.gfmk-admin .split{grid-template-columns:1fr}}@media(max-width:820px){.gfmk-admin{flex-direction:column;max-height:none}.gfmk-admin .sidebar{display:none}.gfmk-admin .main{padding:14px 12px calc(var(--mobile-nav-h) + var(--safe-bottom) + 1.75rem)}.gfmk-admin .main.chat-open{padding:0;flex:1;min-height:0;overflow:hidden}.gfmk-admin .main.chat-open>section{flex:1;min-height:0;height:100%}.gfmk-admin .main.chat-open .im-shell{border-radius:0;border:none;box-shadow:none;min-height:100%;height:100%}.gfmk-admin .main.chat-open .im-compose{padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px))}.gfmk-admin .mobile-tabbar{position:fixed;left:1rem;right:1rem;bottom:calc(.75rem + var(--safe-bottom));z-index:40;display:flex;width:auto;max-width:none;transform:none;border-radius:1.25rem;padding:.45rem;gap:.25rem;justify-content:space-around;align-items:center;background:#ffffff47;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.42);box-shadow:0 16px 40px #0f172a29}.gfmk-admin .mobile-tabbar.is-hidden{display:none}.gfmk-admin .mobile-tab{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:1px solid transparent;background:transparent;border-radius:.9rem;padding:.55rem .35rem;font:inherit;font-size:10px;font-weight:600;color:#64748b;cursor:pointer;transition:color .25s,background .25s,border-color .25s,box-shadow .25s}.gfmk-admin .mobile-tab:hover{color:#334155;background:#fff3}.gfmk-admin .mobile-tab.active{color:#0f766e;background:#14b8a633;border-color:#2dd4bf66;box-shadow:0 4px 12px #14b8a61f}.gfmk-admin .mobile-tab-label{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gfmk-admin .im-shell{height:auto;min-height:calc(100dvh - var(--mobile-nav-h) - 3.5rem)}.gfmk-admin .main.chat-open .im-shell{min-height:100dvh;height:100dvh}.gfmk-admin .im-pane{min-height:48vh}.gfmk-admin .main.chat-open .im-pane{min-height:0;height:100%}.gfmk-admin .im-pane-head{flex-wrap:wrap}.gfmk-admin .stats{grid-template-columns:1fr}}';
function on(a) {
  M(() => {
    const i = document.createElement("style");
    return i.setAttribute("data-gfmk-admin", "1"), i.textContent = a, document.head.appendChild(i), () => {
      i.remove();
    };
  }, [a]);
}
function sn() {
  const [a, i] = k(""), [t, o] = k(!1);
  return M(() => {
    if (!t) return;
    const s = window.setTimeout(() => o(!1), 2200);
    return () => window.clearTimeout(s);
  }, [t, a]), {
    node: /* @__PURE__ */ e("div", { className: `toast${t ? " show" : ""}`, children: a }),
    toast: (s) => {
      i(s), o(!0);
    }
  };
}
function cn(a) {
  on(rn);
  const i = je(() => We(a.apiBase, a.fetch), [a.apiBase, a.fetch]), { node: t, toast: o } = sn();
  return /* @__PURE__ */ r("div", { className: "gfmk-admin", style: { position: "relative", height: "100%", minHeight: "100%" }, children: [
    /* @__PURE__ */ e(Ze, { api: i, toast: o }),
    t
  ] });
}
export {
  cn as default
};
