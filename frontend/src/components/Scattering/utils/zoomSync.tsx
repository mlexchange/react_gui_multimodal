/**
 * Zoom synchronization for H5Web heatmap panels.
 * Must be rendered inside a VisCanvas component.
 */

import { useRef, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useVisCanvasContext } from "@h5web/lib";

export interface ZoomState {
  scale: { x: number; y: number };
  position: { x: number; y: number };
  xVisibleDomain: [number, number];
  yVisibleDomain: [number, number];
}

const FULL_ZOOM_THRESHOLD = 0.999;
const SCALE_CHANGE_THRESHOLD = 0.0001;
const POSITION_CHANGE_THRESHOLD = 0.1;

interface ZoomBroadcasterProps {
  onZoomChange: (state: ZoomState | null) => void;
}

/**
 * Monitors camera and broadcasts zoom state to parent.
 */
export function ZoomBroadcaster({ onZoomChange }: ZoomBroadcasterProps) {
  const camera = useThree((state) => state.camera);
  const { getVisibleDomains } = useVisCanvasContext();
  const lastStateRef = useRef<string>("");
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  const broadcastZoom = useCallback(() => {
    const isFullyZoomedOut =
      camera.scale.x >= FULL_ZOOM_THRESHOLD &&
      camera.scale.y >= FULL_ZOOM_THRESHOLD;

    const stateSignature = isFullyZoomedOut
      ? "null"
      : `${camera.scale.x.toFixed(4)},${camera.scale.y.toFixed(4)},${camera.position.x.toFixed(1)},${camera.position.y.toFixed(1)}`;

    if (stateSignature === lastStateRef.current) {
      return;
    }

    lastStateRef.current = stateSignature;

    if (isFullyZoomedOut) {
      onZoomChangeRef.current(null);
    } else {
      const { xVisibleDomain, yVisibleDomain } = getVisibleDomains(camera);

      onZoomChangeRef.current({
        scale: { x: camera.scale.x, y: camera.scale.y },
        position: { x: camera.position.x, y: camera.position.y },
        xVisibleDomain: xVisibleDomain as [number, number],
        yVisibleDomain: yVisibleDomain as [number, number]
      });
    }
  }, [camera, getVisibleDomains]);

  useFrame(() => {
    broadcastZoom();
  });

  return null;
}

interface ZoomReceiverProps {
  zoomState: ZoomState | null;
}

/**
 * Applies received zoom state to this panel's camera.
 */
export function ZoomReceiver({ zoomState }: ZoomReceiverProps) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const zoomStateRef = useRef(zoomState);
  zoomStateRef.current = zoomState;

  useFrame(() => {
    const state = zoomStateRef.current;

    if (state === null) {
      if (
        camera.scale.x < FULL_ZOOM_THRESHOLD ||
        camera.scale.y < FULL_ZOOM_THRESHOLD
      ) {
        camera.scale.x = 1;
        camera.scale.y = 1;
        camera.position.x = 0;
        camera.position.y = 0;
        camera.updateMatrixWorld();
        invalidate();
      }
    } else {
      const scaleChanged =
        Math.abs(camera.scale.x - state.scale.x) > SCALE_CHANGE_THRESHOLD ||
        Math.abs(camera.scale.y - state.scale.y) > SCALE_CHANGE_THRESHOLD;
      const positionChanged =
        Math.abs(camera.position.x - state.position.x) >
          POSITION_CHANGE_THRESHOLD ||
        Math.abs(camera.position.y - state.position.y) >
          POSITION_CHANGE_THRESHOLD;

      if (scaleChanged || positionChanged) {
        camera.scale.x = state.scale.x;
        camera.scale.y = state.scale.y;
        camera.position.x = state.position.x;
        camera.position.y = state.position.y;
        camera.updateMatrixWorld();
        invalidate();
      }
    }
  });

  return null;
}
