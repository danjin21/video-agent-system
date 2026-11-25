#!/usr/bin/env python3
"""AI 영상 B-roll 만들기 — ElevenLabs Image & Video API (POST /v1/flows/video).

  ai_video.py <project> <name> "<영문 프롬프트>" [--model veo-3.1-fast-generate-001] [--secs 8] [--res 1080p] [--aspect 16:9] [--neg "..."]
  ai_video.py <project> <name> --status <generation_id>     # 이미 만든 생성 다시 받기

- 결과: <project>/global_assets/clips/<name>.mp4 (+ <name>.json: 프롬프트·모델·생성 id). 레이아웃 broll 요소 src로 쓴다.
- 키: secrets.env 의 ELEVENLABS_API_KEY (스튜디오 '계정 연결', 키 권한에 Image & Video 필요). 출력하지 않는다.
- 크레딧이 든다(모델·해상도·길이에 따라). 실패한 생성은 과금되지 않는다. Pro 플랜 이상(아니면 402 paid_plan_required).
- 기본 모델 veo-3.1-fast-generate-001: duration 4·6·8초, 16:9, 720p/1080p, generate_audio=false (나레이션과 겹치지 않게).
- 프롬프트 요령: 실사 B-roll은 "cinematic, natural light, shallow depth of field, no text, no logos" 를 붙이고, 글자는 영상 위에 키트로 얹는다.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import m2env  # noqa: E402

API = "https://api.elevenlabs.io"


def key():
    for line in open(m2env.SECRETS, encoding="utf-8") if os.path.exists(m2env.SECRETS) else []:
        m = re.match(r"^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$", line)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    sys.exit("ElevenLabs 키가 없습니다. 스튜디오 '계정 연결'에서 넣어 주세요.")


def call(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    rq = urllib.request.Request(API + path, data=data, method=method,
                                headers={"xi-api-key": key(), "Content-Type": "application/json", "User-Agent": "module2-studio"})
    try:
        with urllib.request.urlopen(rq, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:   # 에러 원문을 그대로 보여 준다
        sys.exit("ElevenLabs %s %s → HTTP %s\n%s" % (method, path, e.code, e.read().decode("utf-8", "replace")[:1500]))


def wait(gid, limit=900):
    t0, delay = time.time(), 10
    while True:
        r = call("GET", "/v1/flows/video/%s" % gid)
        st = r.get("status")
        print("  상태:", st, flush=True)
        if st == "completed":
            return r
        if st == "failed":
            sys.exit("생성 실패: %s %s" % (r.get("failure_reason"), r.get("error_message")))
        if time.time() - t0 > limit:
            sys.exit("시간 초과 — 나중에 --status %s 로 다시 받으세요" % gid)
        time.sleep(delay)
        delay = min(60, delay + 10)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("name")
    ap.add_argument("prompt", nargs="?")
    ap.add_argument("--model", default="veo-3.1-fast-generate-001")
    ap.add_argument("--secs", type=int, default=8)
    ap.add_argument("--res", default="1080p")
    ap.add_argument("--aspect", default="16:9")
    ap.add_argument("--neg", default="text, captions, logos, watermark, distorted faces, extra fingers")
    ap.add_argument("--status")
    a = ap.parse_args()
    P = os.path.abspath(a.project)
    out_dir = os.path.join(P, "global_assets", "clips")
    os.makedirs(out_dir, exist_ok=True)
    meta_p = os.path.join(out_dir, a.name + ".json")
    if a.status:
        gid, meta = a.status, (json.load(open(meta_p, encoding="utf-8")) if os.path.exists(meta_p) else {})
    else:
        if not a.prompt:
            sys.exit("프롬프트가 필요합니다")
        body = {"model_id": a.model, "prompt": a.prompt, "duration_secs": a.secs, "resolution": a.res, "aspect_ratio": a.aspect}
        if a.model.startswith("veo"):
            body.update({"negative_prompt": a.neg, "generate_audio": False})
        else:
            body["generate_audio"] = False
        r = call("POST", "/v1/flows/video", body)
        gid = r["id"]
        meta = {"generation_id": gid, "model": a.model, "prompt": a.prompt, "secs": a.secs, "res": a.res}
        json.dump(meta, open(meta_p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("생성 시작:", gid, flush=True)
    r = wait(gid)
    out = os.path.join(out_dir, a.name + ".mp4")
    urllib.request.urlretrieve(r["content_url"], out)   # 서명 URL은 1시간 뒤 만료 → 받을 때마다 새로 조회
    meta["done"] = True
    json.dump(meta, open(meta_p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("저장:", os.path.relpath(out, P))
    return 0


if __name__ == "__main__":
    sys.exit(main())
