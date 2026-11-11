// 모듈2 섹션 렌더 엔트리. render_section.py가 이 폴더를 <remotion>/codex-workspace/module2/ 로 동기화한 뒤 렌더한다.
/* eslint-disable @typescript-eslint/no-explicit-any */
import {createElement} from 'react';
import {Composition, registerRoot} from 'remotion';
import {Module2Section, sectionMetadata} from './Module2Section';

const defaultProps = {layout: {elements: []}, timeline: {fps: 30, duration: 150, elements: {}}, edits: {elements: {}}, sectionDir: '', fonts: [], audio: [], withAudio: false, draft: true};

const Root = () =>
  createElement(Composition as any, {
    id: 'Module2Section',
    component: Module2Section,
    durationInFrames: 150,
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps,
    calculateMetadata: sectionMetadata,
  });

registerRoot(Root);
