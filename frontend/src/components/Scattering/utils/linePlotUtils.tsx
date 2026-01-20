/**
 * Shared utilities for H5Web line plot components.
 */

import React from 'react';
import { ScaleType, getSafeDomain } from '@h5web/lib';

export interface CurveData {
  id: string;
  abscissas: number[];
  ordinates: number[];
  color: string;
  label: string;
}

export type Domain = [number, number];

/**
 * Calculate min/max domain from an array of curves with padding.
 */
export function calculateCurveDomains(
  curves: CurveData[],
  options: {
    xPaddingPercent?: number;
    yPaddingPercent?: number;
  } = {}
): { xDomain: Domain; yDomain: Domain } {
  const { xPaddingPercent = 0.02, yPaddingPercent = 0.05 } = options;

  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;

  curves.forEach(curve => {
    curve.abscissas.forEach(v => {
      if (isFinite(v)) {
        xMin = Math.min(xMin, v);
        xMax = Math.max(xMax, v);
      }
    });
    curve.ordinates.forEach(v => {
      if (isFinite(v) && !isNaN(v)) {
        yMin = Math.min(yMin, v);
        yMax = Math.max(yMax, v);
      }
    });
  });

  if (!isFinite(xMin)) xMin = 0;
  if (!isFinite(xMax)) xMax = 1;
  if (!isFinite(yMin)) yMin = 0;
  if (!isFinite(yMax)) yMax = 1;

  const xPadding = (xMax - xMin) * xPaddingPercent || 0.1;
  const yPadding = (yMax - yMin) * yPaddingPercent || 0.1;

  return {
    xDomain: [xMin - xPadding, xMax + xPadding],
    yDomain: [yMin - yPadding, yMax + yPadding],
  };
}

/**
 * Clamp a zoomed domain to the actual data range.
 * Returns the clamped domain or null if invalid.
 */
export function clampDomainToData(
  zoomedDomain: Domain | null,
  dataDomain: Domain
): Domain | null {
  if (!zoomedDomain || dataDomain[0] === dataDomain[1]) {
    return null;
  }

  const clampedMin = Math.max(zoomedDomain[0], dataDomain[0]);
  const clampedMax = Math.min(zoomedDomain[1], dataDomain[1]);

  if (clampedMin >= clampedMax) {
    return null;
  }

  return [clampedMin, clampedMax];
}

/**
 * Make a domain safe for the given scale type.
 */
export function getSafeDomainForScale(
  domain: Domain,
  scaleType: ScaleType
): Domain {
  const [dataMin, dataMax] = domain;

  if (scaleType === ScaleType.Linear || scaleType === ScaleType.SymLog) {
    return domain;
  }

  const safeMax = dataMax > 0 ? dataMax : 1;
  const safeMin = dataMin > 0 ? dataMin : Math.min(1e-10, safeMax * 0.01);
  const fallbackDomain: Domain = [safeMin, safeMax];

  const [safeDomain] = getSafeDomain(domain, fallbackDomain, scaleType);
  return safeDomain;
}

/**
 * Find the index in an array closest to the target value.
 */
export function findClosestIndex(arr: number[], target: number): number {
  if (arr.length === 0) return 0;

  let closestIdx = 0;
  let minDist = Math.abs(arr[0] - target);

  for (let i = 1; i < arr.length; i++) {
    const dist = Math.abs(arr[i] - target);
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }

  return closestIdx;
}

/**
 * Find the curve closest to a given (x, y) position.
 */
export function findClosestCurve(curves: CurveData[], x: number, y: number): CurveData | null {
  if (curves.length === 0) return null;

  let closestCurve = curves[0];
  let minDist = Infinity;

  for (const curve of curves) {
    const xIdx = findClosestIndex(curve.abscissas, x);
    const curveY = curve.ordinates[xIdx];
    const dist = Math.abs(curveY - y);

    if (dist < minDist) {
      minDist = dist;
      closestCurve = curve;
    }
  }

  return closestCurve;
}

/**
 * Get the data point on a curve closest to the x position.
 */
export function getClosestPoint(curve: CurveData, x: number): { xVal: number; yVal: number; index: number } {
  const index = findClosestIndex(curve.abscissas, x);
  return {
    xVal: curve.abscissas[index],
    yVal: curve.ordinates[index],
    index,
  };
}

interface StandardTooltipProps {
  label: string;
  color: string;
  xLabel: string;
  xValue: number;
  xUnit?: string;
  yValue: number;
  xPrecision?: number;
}

export function StandardTooltip({
  label,
  color,
  xLabel,
  xValue,
  xUnit = '',
  yValue,
  xPrecision = 4,
}: StandardTooltipProps): React.ReactElement {
  return (
    <div className="text-xs bg-white/90 p-1 rounded shadow">
      <div className="font-medium" style={{ color }}>
        {label}
      </div>
      <div>
        {xLabel} = {xValue.toFixed(xPrecision)} {xUnit}
      </div>
      <div className="font-semibold">{yValue?.toExponential(3)}</div>
    </div>
  );
}

/**
 * Creates a renderTooltip function for TooltipMesh.
 */
export function createTooltipRenderer(
  curves: CurveData[],
  options: {
    xLabel: string;
    xUnit?: string;
    xPrecision?: number;
  }
) {
  const { xLabel, xUnit = '', xPrecision = 4 } = options;

  return (x: number, y: number): React.ReactElement | null => {
    const closestCurve = findClosestCurve(curves, x, y);
    if (!closestCurve) return null;

    const { xVal, yVal } = getClosestPoint(closestCurve, x);

    return (
      <StandardTooltip
        label={closestCurve.label}
        color={closestCurve.color}
        xLabel={xLabel}
        xValue={xVal}
        xUnit={xUnit}
        yValue={yVal}
        xPrecision={xPrecision}
      />
    );
  };
}
