// anim.js(스튜디오와 공유하는 렌더 의미론) 타입 선언
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Merged = {canvas: {w: number; h: number; bg: string}; fps: number; duration: number; elements: any[]};
export type ElState = {visible: boolean; opacity: number; tx: number; ty: number; scale: number; clipL: number; clipR: number; text: number; count: number; highlight: number};
export function mergeSection(layout: any, timeline: any, edits: any): Merged;
export function stateAt(el: any, frame: number): ElState;
export function displayText(text: string, st: ElState | {text: number; count: number}): string;
export function richSegments(text: string, st?: ElState | {text: number; count: number}): {text: string; accent: boolean}[];
export const ENTER_EFFECTS: Record<string, string>;
export const EXIT_EFFECTS: Record<string, string>;
export const EMPHASIS: Record<string, string>;
export function fmtTime(frame: number, fps?: number): string;
