// anim.js(스튜디오와 공유하는 렌더 의미론) 타입 선언
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Merged = {canvas: {w: number; h: number; bg: string}; fps: number; duration: number; elements: any[]};
export type ElState = {visible: boolean; opacity: number; tx: number; ty: number; scale: number; clipL: number; clipR: number; text: number; count: number; highlight: number; echo?: number};
export function mergeSection(layout: any, timeline: any, edits: any, theme?: any): Merged;
export function resolveColors(v: any, colors: any): any;
export function applyKitTheme(theme: any): void;
export function stateAt(el: any, frame: number): ElState;
export function displayText(text: string, st: ElState | {text: number; count: number}): string;
export function richSegments(text: string, st?: ElState | {text: number; count: number}): {text: string; accent: boolean}[];
export const ENTER_EFFECTS: Record<string, string>;
export const EXIT_EFFECTS: Record<string, string>;
export const EMPHASIS: Record<string, string>;
export function fmtTime(frame: number, fps?: number): string;
// 연출 키트 (DIRECTION_KIT.md)
export const DIAGRAM_KINDS: Record<string, string>;
export const KIT_COLORS: Record<string, string>;
export function diagramSVG(el: any, localFrame: number): string;
export function brollSVG(el: any, localFrame: number, span: number): string;
export function brollCamera(el: any, localFrame: number, span: number): {scale: number; tx: number; ty: number; rotate: number};
export function transformOf(st: any, k?: number): string;
export function emphasisShadow(st: any): string;
export function emphasisFilter(st: any): string;
export function textHTML(el: any, st: any, frame: number): string;
export const HL_EFFECTS: Record<string, string>;
