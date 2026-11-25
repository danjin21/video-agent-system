#!/usr/bin/env python3
"""Envato 소재 찾기·받기 (Market API, 개인 토큰).

  envato_assets.py search "<검색어>" [--site photodune.net|videohive.net|graphicriver.net|audiojungle.net] [--n 10]
  envato_assets.py download <project> <item_id> [--name 파일이름]   # 구매한 항목만 (Market buyer download)

- 토큰: ~/.config/video-agents/secrets.env 의 ENVATO_API_TOKEN (스튜디오 '계정 연결' → Envato 카드에서 사용자가 직접 입력). 출력하지 않는다.
- Envato Elements(구독) 소재는 공개 API로 받을 수 없다 → 사이트에서 받아 global_assets/ 에 넣고 레이아웃 src로 쓴다.
- 받은 파일은 <project>/global_assets/envato/ 에 저장. 라이선스 확인은 사용자 몫(구매 항목 라이선스 범위 안에서 사용).
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import m2env  # noqa: E402

API = "https://api.envato.com"


def token():
    for line in open(m2env.SECRETS, encoding="utf-8") if os.path.exists(m2env.SECRETS) else []:
        m = re.match(r"^\s*ENVATO_API_TOKEN\s*=\s*(.+?)\s*$", line)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    sys.exit("Envato 토큰이 없습니다. 스튜디오 '계정 연결' → Envato 카드에서 넣어 주세요.")


def get(path, params=None):
    url = API + path + ("?" + urllib.parse.urlencode(params) if params else "")
    rq = urllib.request.Request(url, headers={"Authorization": "Bearer " + token(), "User-Agent": "module2-studio"})
    with urllib.request.urlopen(rq, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("term")
    s.add_argument("--site", default="")
    s.add_argument("--n", type=int, default=10)
    d = sub.add_parser("download")
    d.add_argument("project")
    d.add_argument("item_id")
    d.add_argument("--name")
    a = ap.parse_args()
    if a.cmd == "search":
        p = {"term": a.term, "page_size": a.n}
        if a.site:
            p["site"] = a.site
        r = get("/v1/discovery/search/search/item", p)
        for it in r.get("matches", []):
            print("%s\t%s\t%s\t%s" % (it.get("id"), it.get("site"), it.get("name"), it.get("url")))
        print("총 %s건" % r.get("total_hits", "?"))
        return 0
    r = get("/v3/market/buyer/download", {"item_id": a.item_id})
    url = r.get("download_url") or r.get("wordpress_theme") or r.get("wordpress_plugin")
    if not url:
        sys.exit("받을 수 있는 파일이 없습니다 (구매한 항목인지 확인): %s" % json.dumps(r, ensure_ascii=False)[:300])
    out_dir = os.path.join(os.path.abspath(a.project), "global_assets", "envato")
    os.makedirs(out_dir, exist_ok=True)
    name = a.name or ("envato_%s.zip" % a.item_id)
    out = os.path.join(out_dir, name)
    urllib.request.urlretrieve(url, out)
    print("받음:", os.path.relpath(out, os.path.abspath(a.project)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
