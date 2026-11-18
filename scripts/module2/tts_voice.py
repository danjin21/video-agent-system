#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모듈2 음성 생성 — 진입점. project.json voice.provider(elevenlabs | heygen)에 따라 같은 절차로 만든다.

  tts_voice.py <project> --sections s01,s02 [--until 60]            # 보낼 문장·글자 수만 확인
  tts_voice.py <project> --sections s01,s02 [--until 60] --yes      # 생성 (사용자 승인 뒤)
  tts_voice.py <project> --sample s02:b1 --yes --variants "…"        # 목소리 비교 샘플 → 00-direction/voice_samples/
  tts_voice.py <project> --retime --sections s01,s02                 # 텀만 다시 반영 (외부 호출 없음)

ElevenLabs 비교 샘플 --variants 형식: 이름:안정성:음높이(반음):속도:스타일:끝처리(1):앞뒤맥락(1) 를 , 로 구분
  예) "A_기본:0.5:0:1.0,B_안정:0.75:0:1.0,B1_더안정:0.85:0:1.0,B2_끝차분:0.75:0:1.0:0:1:0"
HeyGen 비교 샘플 --variants 형식: 이름:표현강도(0~1 또는 -):음높이(반음)[:태그]
구현은 tts_heygen.py (두 서비스 공용). 상세 절차: skills/module2-strategy-video/SKILL.md [5]·[6]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tts_heygen  # noqa: E402

if __name__ == "__main__":
    sys.exit(tts_heygen.main() or 0)
