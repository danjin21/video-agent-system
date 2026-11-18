// 모듈2 섹션 전환 — 앞 섹션의 마지막 n프레임과 다음 섹션의 처음 n프레임을 @remotion/transitions로 겹쳐 n프레임짜리 조각을 만든다.
// assemble.py가 경계마다 이 조각을 렌더해 [앞 섹션 − n] + [전환 n] + [다음 섹션 − n] 으로 잇는다(경계마다 n프레임 짧아짐, 나레이션 위치도 같이 당김).
// 종류·길이는 디자인 키트(design/theme.json transitions)에서 정한다.
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {AbsoluteFill, CalculateMetadataFunction, OffthreadVideo, staticFile} from 'remotion';
import {TransitionSeries, linearTiming, springTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {flip} from '@remotion/transitions/flip';
import {clockWipe} from '@remotion/transitions/clock-wipe';
import {iris} from '@remotion/transitions/iris';

export type TransitionProps = {
  a: string; // 앞 섹션 영상 (public-dir 기준 경로)
  aFrom: number; // 앞 섹션에서 잘라 쓸 시작 프레임 (= 길이 − n)
  b: string; // 다음 섹션 영상
  n: number; // 전환 길이(프레임)
  type: string; // fade | slide | wipe | flip | clockWipe | iris | none
  direction?: string; // from-left | from-right | from-top | from-bottom 등
  timing?: string; // linear | spring
};

const SIZE = {width: 1920, height: 1080};

export const presentationOf = (type: string, direction?: string): any => {
  const dir = (direction || 'from-right') as any;
  switch (type) {
    case 'slide':
      return slide({direction: dir});
    case 'wipe':
      return wipe({direction: dir});
    case 'flip':
      return flip({direction: dir});
    case 'clockWipe':
      return clockWipe(SIZE);
    case 'iris':
      return iris(SIZE);
    default:
      return fade();
  }
};

const src = (p: string) => (/^(https?:|data:)/.test(p) ? p : staticFile(p));

export const Module2Transition: React.FC<TransitionProps> = (p) => {
  const n = Math.max(1, p.n);
  const timing = p.timing === 'spring' ? springTiming({durationInFrames: n, config: {damping: 200}}) : linearTiming({durationInFrames: n});
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={n}>
          <OffthreadVideo muted src={src(p.a)} startFrom={p.aFrom} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={presentationOf(p.type, p.direction)} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={n}>
          <OffthreadVideo muted src={src(p.b)} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

export const transitionMetadata: CalculateMetadataFunction<TransitionProps> = async ({props}) => ({
  durationInFrames: Math.max(1, props.n),
  fps: 30,
  width: 1920,
  height: 1080,
});
