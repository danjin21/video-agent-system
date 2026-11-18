// 모듈2 섹션 렌더 엔트리. render_section.py가 이 폴더를 <remotion>/codex-workspace/module2/ 로 동기화한 뒤 렌더한다.
/* eslint-disable @typescript-eslint/no-explicit-any */
import {Fragment, createElement} from 'react';
import {Composition, registerRoot} from 'remotion';
import {Module2Section, sectionMetadata} from './Module2Section';
import {Module2Transition, transitionMetadata} from './Transition';
import {Module2Milestones, milestoneMetadata} from './Milestones';

const defaultProps = {layout: {elements: []}, timeline: {fps: 30, duration: 150, elements: {}}, edits: {elements: {}}, sectionDir: '', fonts: [], audio: [], withAudio: false, draft: true};

const transitionDefaults = {a: '', aFrom: 0, b: '', n: 15, type: 'fade'};

const Root = () =>
  createElement(Fragment, null,
  createElement(Composition as any, {
    id: 'Module2Section',
    component: Module2Section,
    durationInFrames: 150,
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps,
    calculateMetadata: sectionMetadata,
  }),
  // 섹션 전환 조각 (assemble.py가 경계마다 렌더)
  createElement(Composition as any, {
    id: 'Module2Transition',
    component: Module2Transition,
    durationInFrames: 15,
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps: transitionDefaults,
    calculateMetadata: transitionMetadata,
  }),
  // 전체 영상 위 마일스톤 바 (assemble.py가 합본 길이만큼 투명 배경으로 렌더)
  createElement(Composition as any, {
    id: 'Module2Milestones',
    component: Module2Milestones,
    durationInFrames: 300,
    fps: 30,
    width: 1920,
    height: 64,
    defaultProps: {total: 300, fps: 30, chapters: []},
    calculateMetadata: milestoneMetadata,
  }));

registerRoot(Root);
