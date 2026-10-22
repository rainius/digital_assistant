"""
分析 tracer 导出的 JSONL,输出各时延段的均值/中位数/P95。

支持结合外部资源采样 CSV,按轮次时间窗口计算资源使用峰值。

用法:
    python analyze.py traces-20260705-143022.jsonl
    python analyze.py traces-*.jsonl
    python analyze.py traces.jsonl -r resources.csv
    python analyze.py traces.jsonl -r resources.csv --cpu-col cpu_usage --mem-col mem_mb

依赖: pandas (pip install pandas)
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from glob import glob
from statistics import mean, median

try:
    import pandas as pd
except ImportError:
    pd = None
    print("[warn] 未安装 pandas,只输出 mean/median。装一下: pip install pandas", file=sys.stderr)


# 与 tracer.js 中 KNOWN_MARKS 一致
MARKS = [
    "t0_speech_end",
    "t1_asr_return",
    "t2_llm_first_chunk",
    "t3_first_sentence",
    "t4_tts_first_return",
    "t5_play_start",
]

# 关心的时延段
SEGMENTS = [
    ("ASR",           "t0_speech_end",      "t1_asr_return"),
    ("LLM首字",       "t1_asr_return",      "t2_llm_first_chunk"),
    ("首句成形",      "t2_llm_first_chunk", "t3_first_sentence"),
    ("TTS首段",       "t3_first_sentence",  "t4_tts_first_return"),
    ("开口",          "t4_tts_first_return","t5_play_start"),
    ("端到端",        "t0_speech_end",      "t5_play_start"),
]

# 资源指标
RESOURCE_METRICS = ["cpu_max", "mem_max", "gpu_max", "vram_max"]

# ---- 时间戳解析 ----

def _parse_iso(iso_str):
    """解析 ISO 8601 字符串 -> Unix 秒(float)。兼容 Z 后缀和 +00:00。"""
    s = iso_str.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    return dt.timestamp()


# ---- 加载 JSONL ----

def load_traces(paths):
    """读入若干 JSONL,合并为一个 records 列表。"""
    records = []
    for p in paths:
        for fp in glob(p) or [p]:
            with open(fp, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    records.append(json.loads(line))
    return records


# ---- 加载资源 CSV ----

def _find_col(df, candidates):
    """在 DataFrame 列名中匹配第一个命中的列名。"""
    for c in candidates:
        if c in df.columns:
            return c
    return None


def load_resources(csv_path, col_map):
    """读入资源采样 CSV,归一化列名后返回 DataFrame。

    col_map 格式: { 'time': '列名', 'cpu': '列名', 'mem': '列名', 'gpu': '列名', 'vram': '列名' }
    未指定的列做自动探测。
    """
    df = pd.read_csv(csv_path)

    # 时间列
    time_col = col_map.get("time") or _find_col(df, ["timestamp", "time", "ts", "datetime"])
    if time_col is None:
        print("[error] 找不到时间列,请用 --time-col 指定", file=sys.stderr)
        print("  可用列:", list(df.columns), file=sys.stderr)
        sys.exit(1)

    # 统一时间戳为 Unix 秒
    raw_time = df[time_col]
    # 如果数值很大(> 1e12),可能是毫秒
    if pd.api.types.is_numeric_dtype(raw_time):
        if raw_time.max() > 1e12:
            df["_ts"] = raw_time / 1000.0
        else:
            df["_ts"] = raw_time.astype(float)
    else:
        df["_ts"] = pd.to_datetime(raw_time).astype("int64") / 1e9

    df = df.sort_values("_ts").reset_index(drop=True)

    # 指标列: auto-detect or use col_map
    cpu_col = col_map.get("cpu") or _find_col(df, ["cpu", "cpu_percent", "cpu_pct", "cpu_usage"])
    mem_col = col_map.get("mem") or _find_col(df, ["mem", "memory", "ram", "mem_mb", "memory_mb", "mem_usage"])
    gpu_col = col_map.get("gpu") or _find_col(df, ["gpu", "gpu_percent", "gpu_pct", "gpu_usage"])
    vram_col = col_map.get("vram") or _find_col(df, ["vram", "vram_mb", "gpu_mem", "gpu_memory", "vram_usage"])

    # 归一化列名
    renames = {"_ts": "_ts"}
    if cpu_col: renames[cpu_col] = "cpu"
    if mem_col: renames[mem_col] = "mem"
    if gpu_col: renames[gpu_col] = "gpu"
    if vram_col: renames[vram_col] = "vram"
    df = df.rename(columns={k: v for k, v in renames.items() if k != v})

    # 只保留需要的列
    keep = ["_ts"] + [v for v in ["cpu", "mem", "gpu", "vram"] if v in renames.values()]
    return df[keep]


# ---- 资源 ↔ 轮次时间窗口匹配 ----

def match_resources(records, res_df):
    """为每条 trace 记录添加资源峰值列。

    对每条记录:
      t_start = startedAt -> Unix 秒
      t_end   = t_start + marks.t5_play_start / 1000
      取 res_df 中 _ts 落在 [t_start, t_end] 的样本,求各指标 max。
    """
    # 收集所有时间窗口
    windows = []
    for r in records:
        marks_map = r.get("marks", {})
        t5_offset = marks_map.get("t5_play_start")
        if t5_offset is None:
            windows.append((None, None))  # 无 t5 的记录无法匹配
            continue
        try:
            t_start = _parse_iso(r["startedAt"])
            t_end = t_start + t5_offset / 1000.0
            windows.append((t_start, t_end))
        except (KeyError, ValueError):
            windows.append((None, None))

    ts = res_df["_ts"].values

    for i, rec in enumerate(records):
        t_start, t_end = windows[i]
        if t_start is None:
            for m in RESOURCE_METRICS:
                rec[m] = None
            continue

        mask = (ts >= t_start) & (ts <= t_end)
        if not mask.any():
            for m in RESOURCE_METRICS:
                rec[m] = None
            continue

        window = res_df.loc[mask]
        rec["cpu_max"]  = float(window["cpu"].max())  if "cpu"  in window.columns else None
        rec["mem_max"]  = float(window["mem"].max())  if "mem"  in window.columns else None
        rec["gpu_max"]  = float(window["gpu"].max())  if "gpu"  in window.columns else None
        rec["vram_max"] = float(window["vram"].max()) if "vram" in window.columns else None


# ---- 展平 ----

def to_frame(records):
    """把每条 record 展平成一行,包含绝对时间戳。"""
    rows = []
    for r in records:
        # 绝对时间: v2 用 t0UnixMs (毫秒), v1 用 t0Unix (秒)
        t0_ms = r.get("t0UnixMs")
        if t0_ms is not None:
            t0_ts = t0_ms / 1000.0
        else:
            # 兼容旧格式
            t0_ts = r.get("t0Unix") or _parse_iso(r.get("startedAt", ""))
        if t0_ts is None:
            t0_ts = None

        iso_str = r.get("startedAt", "")
        t5_offset = r.get("marks", {}).get("t5_play_start")
        # t5_offset 单位 ms
        t5_ts = (t0_ts + t5_offset / 1000.0) if (t0_ts is not None and t5_offset is not None) else None

        row = {
            "id": r.get("id"),
            "traceId": r.get("traceId", ""),
            "startedAt": iso_str,
            "t0_unix": t0_ts,
            "t5_unix": t5_ts,
            "t0_iso": iso_str,
            "t5_iso": datetime.fromtimestamp(t5_ts, tz=timezone.utc).isoformat() if t5_ts else None,
            "answer": r.get("answer", ""),
        }
        for m in MARKS:
            row[m] = r.get("marks", {}).get(m)
        # 派生时延列
        for name, a, b in SEGMENTS:
            va, vb = row.get(a), row.get(b)
            row[name] = (vb - va) if (va is not None and vb is not None) else None
        # 资源峰值
        for m in RESOURCE_METRICS:
            row[m] = r.get(m)
        # 展开 meta
        for k, v in (r.get("meta") or {}).items():
            row[f"meta.{k}"] = v
        rows.append(row)
    return rows


# ---- 汇总 ----

def summarize(rows, has_resources=False):
    if not rows:
        print("[error] 没有可用记录")
        return

    seg_names = [name for (name, _, _) in SEGMENTS]
    metric_cols = seg_names + (RESOURCE_METRICS if has_resources else [])

    if pd is not None:
        df = pd.DataFrame(rows)

        # ---- 逐轮次明细 ----
        detail_cols = ["id", "traceId", "t0_iso", "t5_iso", "t0_unix", "t5_unix", "answer"] + MARKS + seg_names
        if has_resources:
            detail_cols += [c for c in RESOURCE_METRICS if c in df.columns]
        # meta 列
        meta_cols = [c for c in df.columns if c.startswith("meta.")]
        detail_cols += meta_cols
        # 只取存在的列
        detail_cols = [c for c in detail_cols if c in df.columns]

        print("\n--- 逐轮次明细 ---")
        df_out = df[detail_cols].copy()
        df_out.insert(0, "序号", range(1, len(df) + 1))

        print("\n--- 逐轮次明细 ---")
        print(df_out.to_string(index=False))

        # ---- 汇总统计 ----
        cols = [c for c in metric_cols if c in df.columns]
        print(f"\n--- 时延汇总 ---")
        stat = df[cols].agg(["count", "mean", "std",
                             "median", lambda s: s.quantile(0.95)]).round(1)
        stat.index = ["n", "mean(ms)", "std(ms)", "p50(ms)", "p95(ms)"]
        print(stat.to_string())

        # 按 meta 分组统计
        group_cols = [c for c in df.columns if c.startswith("meta.")
                      and df[c].nunique(dropna=True) > 1]
        for gc in group_cols:
            print(f"\n== 按 {gc} 分组 ==")
            g = df.groupby(gc)[cols].agg(["mean", "std", "median",
                                          lambda s: s.quantile(0.95)]).round(1)
            print(g.to_string())

        return df, detail_cols, stat

    # fallback: 无 pandas
    for name in seg_names:
        vals = [r[name] for r in rows if r.get(name) is not None]
        if not vals:
            print(f"{name:<12}{0:>4}")
            continue
        print(f"{name:<12}{len(vals):>4}{mean(vals):>12.1f}{median(vals):>12.1f}")
    return None, None, None


# ---- 主入口 ----

def main():
    parser = argparse.ArgumentParser(
        description="分析 tracer 导出的 JSONL 时延数据,可选结合资源采样 CSV",
        epilog="示例: python analyze.py traces.jsonl -r resources.csv"
    )
    parser.add_argument("traces", nargs="+", help="JSONL 轨迹文件（支持 glob）")
    parser.add_argument("-o", "--output", help="导出逐轮次明细 CSV 文件路径")
    parser.add_argument("-s", "--summary", help="导出时延汇总统计 CSV 文件路径")
    parser.add_argument("-r", "--resources", help="资源采样 CSV 文件路径")
    parser.add_argument("--time-col", help="CSV 中的时间戳列名（自动探测）")
    parser.add_argument("--cpu-col",  help="CSV 中的 CPU 列名（自动探测）")
    parser.add_argument("--mem-col",  help="CSV 中的内存列名（自动探测）")
    parser.add_argument("--gpu-col",  help="CSV 中的 GPU 列名（自动探测）")
    parser.add_argument("--vram-col", help="CSV 中的显存列名（自动探测）")

    args = parser.parse_args()

    # 1. 加载轨迹
    records = load_traces(args.traces)
    print(f"[info] 载入 {len(records)} 条轨迹")

    # 2. (可选) 加载资源 CSV + 匹配
    has_resources = False
    if args.resources:
        if pd is None:
            print("[error] 资源分析需要 pandas,请先安装: pip install pandas", file=sys.stderr)
            sys.exit(1)
        col_map = {}
        if args.time_col: col_map["time"] = args.time_col
        if args.cpu_col:  col_map["cpu"]  = args.cpu_col
        if args.mem_col:  col_map["mem"]  = args.mem_col
        if args.gpu_col:  col_map["gpu"]  = args.gpu_col
        if args.vram_col: col_map["vram"] = args.vram_col

        res_df = load_resources(args.resources, col_map)
        print(f"[info] 载入 {len(res_df)} 条资源采样记录, 列: {list(res_df.columns)}")
        match_resources(records, res_df)
        has_resources = True

    # 3. 展平 + 汇总
    rows = to_frame(records)
    df, detail_cols, stat = summarize(rows, has_resources=has_resources)

    # 4. 导出 CSV
    if args.output and df is not None and detail_cols is not None:
        df_out = df[detail_cols].copy()
        df_out.insert(0, "序号", range(1, len(df) + 1))
        df_out.to_csv(args.output, index=False, encoding="utf-8-sig")
        print(f"[info] 明细已导出: {args.output}")

    if args.summary and stat is not None:
        stat.to_csv(args.summary, encoding="utf-8-sig")
        print(f"[info] 汇总已导出: {args.summary}")


if __name__ == "__main__":
    main()
