/**
 * Ebenen des Editors. Jede Ebene ist eine eigene Komponente, die eine Konva-<Layer> (oder <Group>) rendert.
 * Reihenfolge (unten → oben) wird in Canvas.tsx festgelegt.
 */
export { GridLayer } from './GridLayer';
export { LowerFloorLayer } from './LowerFloorLayer';
export { HallLayer } from './HallLayer';
export { RoomsLayer } from './RoomsLayer';
export { WallsLayer } from './WallsLayer';
export { OpeningsLayer } from './OpeningsLayer';
export { ItemsLayer } from './ItemsLayer';
export { AnnotationsLayer } from './AnnotationsLayer';
export { DimensionsLayer } from './DimensionsLayer';
export { SelectionLayer } from './SelectionLayer';
export { DragPreviewLayer } from './DragPreviewLayer';
