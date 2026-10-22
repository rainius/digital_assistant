"""
将逐轮次埋点记录与资源采样数据按时间窗口对齐,生成 xlsx 报告。

用法:
    python build_report.py result3.csv 3.csv -o report.xlsx

输出 xlsx 包含两个 sheet:
  - 明细: 每轮一次的埋点记录 + 各资源指标在该轮时间窗口内的峰值
  - 资源: 所有资源采样原始数据
"""

import argparse
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils.dataframe import dataframe_to_rows

# ---- 列名映射 ----

# (源列名, 表头标签, 聚合方式: "max" 或 "mean")
RESOURCE_METRICS = [
    ("cpu_percent",       "CPU平均利用率(%)",    "mean"),
    ("memory_used_gb",    "内存峰值(GB)",         "max"),
    ("memory_percent",    "内存峰值(%)",          "max"),
    ("gpu_util_percent",  "GPU平均利用率(%)",     "mean"),
    ("gpu_memory_used_mb","显存峰值(MB)",         "max"),
]


def load_trace_df(path):
    """读入埋点 CSV。"""
    df = pd.read_csv(path)
    # 确保数值列
    for c in ["t0_unix", "t5_unix"]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def load_resource_df(path):
    """读入资源采样 CSV。"""
    df = pd.read_csv(path)
    # 统一时间戳为 Unix 秒
    if "timestamp_ms" in df.columns:
        df["_ts"] = pd.to_numeric(df["timestamp_ms"], errors="coerce") / 1000.0
    elif "timestamp" in df.columns:
        df["_ts"] = pd.to_numeric(df["timestamp"], errors="coerce")
    else:
        raise ValueError("资源 CSV 中找不到 timestamp_ms 或 timestamp 列")
    # 确保数值列
    for src, _, _ in RESOURCE_METRICS:
        if src in df.columns:
            df[src] = pd.to_numeric(df[src], errors="coerce")
    df = df.sort_values("_ts").reset_index(drop=True)
    return df


def compute_peaks(trace_df, res_df):
    """为每条埋点记录追加资源统计列（利用率取均值，内存/显存取峰值）。"""
    ts = res_df["_ts"].values

    for idx, row in trace_df.iterrows():
        t0 = row["t0_unix"]
        t5 = row["t5_unix"]
        if pd.isna(t0) or pd.isna(t5):
            for src, _, _ in RESOURCE_METRICS:
                if src in res_df.columns:
                    trace_df.at[idx, src + "_val"] = None
            continue

        mask = (ts >= t0) & (ts <= t5)
        if not mask.any():
            for src, _, _ in RESOURCE_METRICS:
                if src in res_df.columns:
                    trace_df.at[idx, src + "_val"] = None
            continue

        window = res_df.loc[mask]
        for src, _, method in RESOURCE_METRICS:
            if src not in window.columns:
                continue
            if method == "mean":
                trace_df.at[idx, src + "_val"] = window[src].mean()
            else:
                trace_df.at[idx, src + "_val"] = window[src].max()

    return trace_df


def build_xlsx(trace_df, res_df, output_path):
    """生成 xlsx 报告。"""
    wb = Workbook()

    # ---- 样式定义 ----
    header_font = Font(name="微软雅黑", bold=True, size=10, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin"),
    )
    # 时延列浅蓝底色,资源列浅绿底色
    latency_fill = PatternFill(start_color="DAEEF3", end_color="DAEEF3", fill_type="solid")
    resource_fill = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")

    # ============ Sheet 1: 明细 ============
    ws1 = wb.active
    ws1.title = "明细"

    # 构建明细 DataFrame: id + 标记 + 时延段 + 资源峰值 + meta
    detail_cols = ["序号", "id", "traceId", "t0_iso", "t5_iso", "t0_unix", "t5_unix", "answer"]
    marks = [c for c in trace_df.columns if c.startswith("t") and c.endswith(("_end", "_return", "_chunk", "_sentence", "_start"))]
    # 按 tracer 顺序排
    mark_order = ["t0_speech_end", "t1_asr_return", "t2_llm_first_chunk",
                  "t3_first_sentence", "t4_tts_first_return", "t5_play_start"]
    marks = [m for m in mark_order if m in trace_df.columns]
    segs = ["ASR", "LLM首字", "首句成形", "TTS首段", "开口", "端到端"]
    segs = [s for s in segs if s in trace_df.columns]
    peak_cols = [src + "_val" for src, _, _ in RESOURCE_METRICS if src + "_val" in trace_df.columns]
    meta_cols = [c for c in trace_df.columns if c.startswith("meta.")]

    all_cols = detail_cols + marks + segs + peak_cols + meta_cols
    all_cols = [c for c in all_cols if c in trace_df.columns]

    # 给峰值列改一个好看的表头名
    rename = {}
    for src, label, _ in RESOURCE_METRICS:
        if src + "_val" in trace_df.columns:
            rename[src + "_val"] = label

    df_detail = trace_df[all_cols].copy()
    df_detail = df_detail.rename(columns=rename)

    # 写入表头
    for col_idx, col_name in enumerate(df_detail.columns, 1):
        cell = ws1.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    # 写入数据
    for row_idx, (_, row) in enumerate(df_detail.iterrows()):
        for col_idx, col_name in enumerate(df_detail.columns, 1):
            val = row[col_name]
            if pd.isna(val):
                val = ""
            elif isinstance(val, float):
                val = round(val, 1)
            cell = ws1.cell(row=row_idx + 2, column=col_idx, value=val)
            cell.alignment = cell_align
            cell.border = thin_border
            # 时延列 vs 资源列底色区分
            if col_name in segs or col_name in marks:
                cell.fill = latency_fill
            elif col_name in rename.values():
                cell.fill = resource_fill

    # 冻结首行
    ws1.freeze_panes = "A2"
    # 列宽自适应
    for col_idx, col_name in enumerate(df_detail.columns, 1):
        max_len = max(len(str(col_name)), 10)
        for row_idx in range(2, len(df_detail) + 2):
            val = ws1.cell(row=row_idx, column=col_idx).value
            if val:
                max_len = max(max_len, len(str(val)))
        ws1.column_dimensions[ws1.cell(row=1, column=col_idx).column_letter].width = min(max_len + 4, 30)

    # ============ Sheet 2: 资源原始数据 ============
    ws2 = wb.create_sheet("资源采样")
    for col_idx, col_name in enumerate(res_df.columns, 1):
        cell = ws2.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    for row_idx, (_, row) in enumerate(res_df.iterrows()):
        for col_idx, col_name in enumerate(res_df.columns, 1):
            val = row[col_name]
            if pd.isna(val):
                val = ""
            elif isinstance(val, float):
                val = round(val, 2)
            cell = ws2.cell(row=row_idx + 2, column=col_idx, value=val)
            cell.alignment = cell_align
            cell.border = thin_border

    ws2.freeze_panes = "A2"

    wb.save(output_path)
    print(f"[info] 报告已生成: {output_path}")
    print(f"  - 明细: {len(df_detail)} 轮次 × {len(df_detail.columns)} 列")
    print(f"  - 资源采样: {len(res_df)} 条记录")


def main():
    parser = argparse.ArgumentParser(description="生成埋点+资源峰值 xlsx 报告")
    parser.add_argument("trace_csv", help="逐轮次埋点 CSV (如 result3.csv)")
    parser.add_argument("resource_csv", help="资源采样 CSV (如 3.csv)")
    parser.add_argument("-o", "--output", default="report.xlsx", help="输出 xlsx 路径")
    args = parser.parse_args()

    trace_df = load_trace_df(args.trace_csv)
    print(f"[info] 埋点: {len(trace_df)} 轮次")

    res_df = load_resource_df(args.resource_csv)
    print(f"[info] 资源: {len(res_df)} 条记录, "
          f"时间范围 [{res_df['_ts'].min():.0f}, {res_df['_ts'].max():.0f}]")

    trace_df = compute_peaks(trace_df, res_df)
    build_xlsx(trace_df, res_df, args.output)


if __name__ == "__main__":
    main()
