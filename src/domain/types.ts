export type LayerKind = 'flower' | 'disk' | 'circle-ring';
export interface Point { x: number; y: number }
export interface LayerStyle { stroke: string | null; strokeWidth: number; fill: string | null; opacity: number }
export interface BaseLayer { id: string; name: string; visible: boolean; locked: boolean; rotationDeg: number; style: LayerStyle }
export interface FlowerLayer extends BaseLayer { kind: 'flower'; outerRadius: number; innerRatio: number; petalCount: number }
export interface DiskLayer extends BaseLayer { kind: 'disk'; radius: number }
export interface CircleRingLayer extends BaseLayer { kind: 'circle-ring'; orbitRadius: number; circleRadius: number; circleCount: number }
export type MandalaLayer = FlowerLayer | DiskLayer | CircleRingLayer;
export interface MandalaProject { schemaVersion: 1; generatorVersion: 1; title: string; seed: string; background: string; nextLayerNumber: number; layers: MandalaLayer[] }
export type Primitive = { kind: 'circle'; center: Point; radius: number } | { kind: 'path'; points: Point[]; closed: boolean };
export interface GeneratedLayer { layerId: string; primitives: Primitive[] }
export interface ValidationIssue { path: string; message: string }
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
