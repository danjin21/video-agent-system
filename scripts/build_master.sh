#!/bin/zsh
# 모듈1 합본: build_master.sh <project_root>
# 비디오 전용 mp4로 분리 후 concat(오디오 길이 영향 제거, pts 정합) + 원본 WAV 나레이션 트랙 + BGM 베드 mux. -shortest 금지.
set -e
PROJ=${1:?project root}; cd "$PROJ"; OUT=final; mkdir -p $OUT
T=$(mktemp -d)
SLIDES=$(python3 -c "import json;print(' '.join(s['id'] for s in json.load(open('03-conti-timeline.json'))['slides']))")
D=$(python3 -c "import json;print(max(s['end_frame'] for s in json.load(open('03-conti-timeline.json'))['slides'])/30)")
: > $T/list.txt
for s in ${=SLIDES}; do ffmpeg -v error -y -i slide-$s/05-remotion/slide-$s.mp4 -an -c:v copy $T/s$s.mp4; echo "file '$T/s$s.mp4'" >> $T/list.txt; done
ffmpeg -v error -y -f concat -safe 0 -i $T/list.txt -c copy $OUT/master_video_clean.mp4
NF=$(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 $OUT/master_video_clean.mp4 | tr -d ',')
echo "video frames=$NF expected=$(python3 -c "print(int(float($D)*30))")"
NAR=audio/narration_timeline.wav; BED=audio/bgm_bed.wav
if [ -f $BED ]; then
ffmpeg -v error -y -i $OUT/master_video_clean.mp4 -i $NAR -i $BED -filter_complex \
 "[1:a]volume=8dB,apad=whole_dur=${D},atrim=0:${D}[n];[2:a]apad=whole_dur=${D},atrim=0:${D}[b];[n][b]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.95:level=false[a]" \
 -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k $OUT/master_bgm.mp4
fi
ffmpeg -v error -y -i $OUT/master_video_clean.mp4 -i $NAR -filter_complex "[1:a]volume=8dB,apad=whole_dur=${D},atrim=0:${D},alimiter=limit=0.95:level=false[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k $OUT/master_narration_only.mp4
echo "last-frame luminance (255=white): $(ffmpeg -v error -y -sseof -0.05 -i $OUT/master_narration_only.mp4 -frames:v 1 -vf scale=1:1 -f rawvideo -pix_fmt gray - | od -An -tu1 | tr -d ' ')"
rm -rf $T
