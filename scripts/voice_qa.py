#!/usr/bin/env python3
"""
voice_qa.py — 슈퍼톤 음성 끝음(문장 종결) 품질 검수. 무설치(ffmpeg + Python 표준 라이브러리만).

감지 대상 (사용자 피드백 2026-06):
  - rising : 평서문인데 끝음 피치가 올라간다(의문문 억양처럼).
  - limp   : 끝이 맥아리 없이 꺼진다(에너지 급락/너무 약하게 트레일오프).

방법:
  - ffmpeg로 16k mono PCM(s16le) 추출 → 표준 라이브러리로 읽기.
  - 프레임(win 25ms / hop 10ms) RMS + 자기상관(autocorrelation) F0(80~350Hz).
  - 끝 무음 트림 후, 끝 구간(tail)에서 종결 억양/에너지 판정.
  - 출력: report.json + 파일별 SVG 곡선(F0·RMS) — 사람이 "곡률"을 눈으로 확인.

사용:
  python3 voice_qa.py <wav 또는 디렉터리> [--out OUTDIR] [--rubric voice-qa-rubric.json]
종료 코드: flag된 파일이 하나라도 있으면 1, 전부 ok면 0 (CI/루프용).
"""
import sys, os, json, math, glob, argparse, subprocess, struct

# ---------- 기본 임계값 (voice-qa-rubric.json로 오버라이드 가능) ----------
DEFAULTS = {
    "sr": 16000,
    "win_ms": 25, "hop_ms": 10,
    "f0_min": 80, "f0_max": 350,
    "voicing_min": 0.30,        # 자기상관 정규화 피크 ≥ 이면 voiced
    "silence_ratio": 0.06,      # peak RMS 대비 이 비율 이하는 무음(끝 트림 기준)
    "tail_ms": 600,             # 끝 분석 창
    "end_ms": 300,              # 종결 최종 구간 (rising 비교의 'end')
    "ref_lo_ms": 600, "ref_hi_ms": 300,  # rising 비교의 'ref' 구간 = [tail_end-600, tail_end-300]
    "rising_semitones": 1.2,    # end median F0 가 ref median 보다 이만큼(반음) 높으면 rising
    "rising_max_semitones": 7.0,  # 이보다 큰 점프는 F0 옥타브 오류로 보고 rising 제외
    "rising_min_voiced": 3,     # 종결 구간 voiced 프레임 최소 개수(노이즈 방지)
    "limp_floor_ratio": 0.06,   # 끝 150ms 평균 RMS / peak RMS < 이면 limp(절대 바닥, 안전망)
    "limp_rel_ratio": 0.22,     # 끝 150ms RMS / 발화부 median RMS < 이면 limp(상대 약함)
    "limp_corpus_frac": 0.55,   # 끝 RMS/peak 가 화자 코퍼스 median 의 이 배 미만이면 limp(평소보다 약함)
    "limp_end_ms": 150,
}


def extract_pcm(path, sr):
    """ffmpeg로 16k mono s16le 추출 → float [-1,1] 리스트."""
    cmd = ["ffmpeg", "-v", "quiet", "-i", path, "-ar", str(sr), "-ac", "1", "-f", "s16le", "-"]
    raw = subprocess.run(cmd, stdout=subprocess.PIPE, check=True).stdout
    n = len(raw) // 2
    ints = struct.unpack("<%dh" % n, raw[:n * 2])
    return [s / 32768.0 for s in ints]


def frame_rms(x, win, hop):
    out = []
    for i in range(0, max(1, len(x) - win + 1), hop):
        seg = x[i:i + win]
        if not seg:
            break
        out.append(math.sqrt(sum(v * v for v in seg) / len(seg)))
    return out


def autocorr_f0(seg, sr, fmin, fmax, voicing_min):
    """단일 프레임 F0(Hz) + voicing. 미voiced면 (0, peak).
    옥타브-다운 오류 완화: 전역 최대 대신 '가장 짧은 lag(=높은 기본주파수) 중 전역최대의 85% 이상인 국소 피크'를 택한다."""
    n = len(seg)
    m = sum(seg) / n
    s = [v - m for v in seg]
    energy = sum(v * v for v in s)
    if energy < 1e-9:
        return 0.0, 0.0
    lag_min = max(2, int(sr / fmax))
    lag_max = min(int(sr / fmin), n - 1)
    ac = [0.0] * (lag_max + 1)
    for lag in range(lag_min, lag_max + 1):
        acc = 0.0
        for i in range(n - lag):
            acc += s[i] * s[i + lag]
        ac[lag] = acc / energy
    best_val = max(ac[lag_min:lag_max + 1]) if lag_max >= lag_min else 0.0
    if best_val < voicing_min:
        return 0.0, best_val
    thr = 0.85 * best_val
    # 가장 짧은 lag의 국소 피크(>=thr)를 기본주파수로
    for lag in range(lag_min + 1, lag_max):
        if ac[lag] >= thr and ac[lag] >= ac[lag - 1] and ac[lag] >= ac[lag + 1]:
            return sr / lag, best_val
    best_lag = max(range(lag_min, lag_max + 1), key=lambda L: ac[L])
    return sr / best_lag, best_val


def median(vals):
    v = sorted(vals)
    if not v:
        return 0.0
    n = len(v)
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2


def analyze(path, cfg):
    sr = cfg["sr"]
    x = extract_pcm(path, sr)
    dur = len(x) / sr
    win = int(sr * cfg["win_ms"] / 1000)
    hop = int(sr * cfg["hop_ms"] / 1000)
    rms = frame_rms(x, win, hop)
    if not rms:
        return {"file": os.path.basename(path), "error": "empty"}
    peak = max(rms) or 1e-9

    # 끝 무음 트림 → 마지막 유효 프레임 인덱스
    end_idx = len(rms) - 1
    while end_idx > 0 and rms[end_idx] < cfg["silence_ratio"] * peak:
        end_idx -= 1
    tail_end_s = (end_idx * hop + win) / sr

    def s_to_frame(t):
        return max(0, min(len(rms) - 1, int((t * sr - win) / hop)))

    # ---- F0: tail 컨텍스트 구간만 계산(속도) ----
    ctx_start_s = max(0.0, tail_end_s - (cfg["tail_ms"] + 250) / 1000)
    f0_series = []  # (t_s, f0, voicing)
    i0 = int(ctx_start_s * sr)
    fi = i0
    while fi + win <= len(x) and fi <= end_idx * hop + win:
        f0, vc = autocorr_f0(x[fi:fi + win], sr, cfg["f0_min"], cfg["f0_max"], cfg["voicing_min"])
        f0_series.append(((fi + win / 2) / sr, f0, vc))
        fi += hop

    def voiced_f0_in(lo_s, hi_s):
        return [f for (t, f, v) in f0_series if lo_s <= t <= hi_s and f > 0]

    te = tail_end_s
    ref = voiced_f0_in(te - cfg["ref_lo_ms"] / 1000, te - cfg["ref_hi_ms"] / 1000)
    end = voiced_f0_in(te - cfg["end_ms"] / 1000, te)
    ref_f0, end_f0 = median(ref), median(end)
    slope_semi = 12 * math.log2(end_f0 / ref_f0) if (ref_f0 > 0 and end_f0 > 0) else 0.0

    # ---- RMS 종결 ----
    voiced_rms = [rms[s_to_frame(t)] for (t, f, v) in f0_series if f > 0] or rms
    sent_med_rms = median(voiced_rms)
    e0 = s_to_frame(te - cfg["limp_end_ms"] / 1000)
    e1 = s_to_frame(te)
    end_rms_vals = rms[e0:e1 + 1] or [rms[e1]]
    end_rms = sum(end_rms_vals) / len(end_rms_vals)
    tail_ratio_peak = end_rms / peak
    tail_ratio_sent = end_rms / sent_med_rms if sent_med_rms else 1.0

    svg_name = os.path.splitext(os.path.basename(path))[0] + ".contour.svg"
    return {
        "file": os.path.basename(path),
        "dur_s": round(dur, 2),
        "tail_end_s": round(tail_end_s, 2),
        "ref_f0_hz": round(ref_f0, 1), "end_f0_hz": round(end_f0, 1),
        "n_voiced_end": len(end),
        "f0_slope_semitones": round(slope_semi, 2),
        "tail_rms_ratio_peak": round(tail_ratio_peak, 3),
        "tail_rms_ratio_sent": round(tail_ratio_sent, 3),
        "flags": [], "verdict": "ok",
        "svg": svg_name,
        "_series": {"rms": rms, "hop": hop, "win": win, "sr": sr,
                    "f0": f0_series, "tail_end_s": tail_end_s,
                    "end_ms": cfg["end_ms"], "tail_ms": cfg["tail_ms"]},
    }


def decide(r, cfg, corpus_tail_median):
    """flag 판정 — 화자 코퍼스 상대 기준 포함. analyze 이후 corpus median을 알게 된 뒤 호출."""
    flags = []
    # rising: 끝이 직전 대비 충분히 높되, 옥타브 오류로 보이는 과도한 점프(>rising_max)는 제외.
    if (r["ref_f0_hz"] > 0 and r["end_f0_hz"] > 0 and r["n_voiced_end"] >= cfg["rising_min_voiced"]
            and cfg["rising_semitones"] <= r["f0_slope_semitones"] <= cfg["rising_max_semitones"]):
        flags.append("rising")
    # limp: (a) 화자 평균 종결보다 현저히 약함  또는 (b) 절대 바닥 미만  또는 (c) 발화부 대비 매우 약함
    rel_corpus = (r["tail_rms_ratio_peak"] < cfg["limp_corpus_frac"] * corpus_tail_median) if corpus_tail_median else False
    if rel_corpus or r["tail_rms_ratio_peak"] < cfg["limp_floor_ratio"] or r["tail_rms_ratio_sent"] < cfg["limp_rel_ratio"]:
        flags.append("limp")
    r["flags"] = flags
    r["verdict"] = flags[0] if flags else "ok"
    return r


def write_svg(res, out_dir):
    W, H, padL, padB, padT = 820, 300, 56, 40, 40
    s = res["_series"]
    rms, hop, sr = s["rms"], s["hop"], s["sr"]
    dur = len(rms) * hop / sr
    f0pts = s["f0"]
    te = s["tail_end_s"]
    f0v = [f for (_, f, _) in f0pts if f > 0]
    fmin = min(f0v) if f0v else 80
    fmax = max(f0v) if f0v else 350
    if fmax - fmin < 20:
        fmax = fmin + 20
    plotW, plotH = W - padL - 20, H - padB - padT

    def X(t):
        return padL + (t / dur) * plotW if dur else padL

    def Yr(r):  # RMS (하단 절반)
        peak = max(rms) or 1e-9
        return H - padB - (r / peak) * (plotH * 0.42)

    def Yf(f):  # F0 (상단)
        return padT + (1 - (f - fmin) / (fmax - fmin)) * (plotH * 0.62)

    rms_pts = " ".join("%.1f,%.1f" % (X((i * hop + s["win"] / 2) / sr), Yr(r)) for i, r in enumerate(rms))
    # F0: voiced 끊김마다 별도 폴리라인
    f0_polys, cur = [], []
    for (t, f, v) in f0pts:
        if f > 0:
            cur.append("%.1f,%.1f" % (X(t), Yf(f)))
        elif cur:
            f0_polys.append(cur); cur = []
    if cur:
        f0_polys.append(cur)

    color = {"ok": "#024ad8", "rising": "#ff5050", "limp": "#ff5050"}[res["verdict"]]
    tail_x0 = X(te - s["tail_ms"] / 1000)
    end_x0 = X(te - s["end_ms"] / 1000)
    end_x1 = X(te)
    polys_svg = "".join('<polyline fill="none" stroke="%s" stroke-width="3" points="%s"/>' % (color, " ".join(seg)) for seg in f0_polys)

    label = {"ok": "정상", "rising": "끝음 올라감(rising)", "limp": "맥아리 없음(limp)"}[res["verdict"]]
    svg = f'''<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard,Arial,sans-serif">
<rect x="0" y="0" width="{W}" height="{H}" fill="#ffffff"/>
<rect x="{end_x0:.1f}" y="{padT}" width="{(end_x1-end_x0):.1f}" height="{plotH}" fill="#ff5050" opacity="0.08"/>
<rect x="{tail_x0:.1f}" y="{padT}" width="{(end_x1-tail_x0):.1f}" height="{plotH}" fill="#024ad8" opacity="0.05"/>
<polyline fill="none" stroke="#c2c2c2" stroke-width="1.5" points="{rms_pts}"/>
{polys_svg}
<text x="{padL}" y="24" font-size="18" font-weight="700" fill="{color}">{res['file']} — {label}</text>
<text x="{padL}" y="{H-12}" font-size="13" fill="#636363">F0 기울기 {res['f0_slope_semitones']:+.2f}반음 (ref {res['ref_f0_hz']}→end {res['end_f0_hz']}Hz) · 끝RMS/peak {res['tail_rms_ratio_peak']} · 파란음영=tail, 빨간음영=종결300ms</text>
<text x="{W-150}" y="24" font-size="12" fill="#636363">파랑/빨강=F0, 회색=RMS</text>
</svg>'''
    with open(os.path.join(out_dir, res["svg"]), "w") as f:
        f.write(svg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target", help="wav 파일 또는 디렉터리")
    ap.add_argument("--out", default=None, help="출력 디렉터리(기본: <target>/voice_qa)")
    ap.add_argument("--rubric", default=None, help="voice-qa-rubric.json (임계값 오버라이드)")
    args = ap.parse_args()

    cfg = dict(DEFAULTS)
    if args.rubric and os.path.exists(args.rubric):
        cfg.update({k: v for k, v in json.load(open(args.rubric)).items() if k in cfg})

    if os.path.isdir(args.target):
        files = sorted(glob.glob(os.path.join(args.target, "*.wav")))
        base = args.target
    else:
        files = [args.target]
        base = os.path.dirname(args.target) or "."
    out_dir = args.out or os.path.join(base, "voice_qa")
    os.makedirs(out_dir, exist_ok=True)

    # pass 1: 분석
    results = []
    for p in files:
        try:
            results.append(analyze(p, cfg))
        except subprocess.CalledProcessError:
            results.append({"file": os.path.basename(p), "error": "ffmpeg_failed"})
    # 화자 코퍼스 종결 RMS median (limp 상대 판정 기준)
    tails = [r["tail_rms_ratio_peak"] for r in results if "tail_rms_ratio_peak" in r]
    corpus_tail_median = median(tails)

    # pass 2: 판정 + SVG
    flagged = 0
    for r in results:
        if "error" in r:
            continue
        decide(r, cfg, corpus_tail_median)
        write_svg(r, out_dir)
        del r["_series"]
        if r["flags"]:
            flagged += 1
        tag = ",".join(r["flags"]) or "ok"
        print(f"  {r['file']:<26} {tag:<14} slope={r['f0_slope_semitones']:>6} tailRMS={r['tail_rms_ratio_peak']}")

    report = {"rubric": cfg, "corpus_tail_median": round(corpus_tail_median, 3),
              "count": len(results), "flagged": flagged, "results": results}
    with open(os.path.join(out_dir, "report.json"), "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n→ {out_dir}/report.json  ({flagged}/{len(results)} flagged)  + 곡선 SVG")
    sys.exit(1 if flagged else 0)


if __name__ == "__main__":
    main()
