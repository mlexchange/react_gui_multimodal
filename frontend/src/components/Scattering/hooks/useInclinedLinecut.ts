import { useState, useCallback, useEffect } from 'react';
import { leftImageColorPalette, rightImageColorPalette } from '../utils/constants';
import { throttle } from 'lodash';
import { InclinedLinecut } from '../types';
import { calculateInclinedQSpaceToPixelWidth } from '../utils/calculateQSpaceToPixelWidthInclinedLinecut';

/**
 * Custom hook for managing inclined linecuts in q-space
 *
 * This hook provides functionality to create, manipulate, and visualize inclined linecuts
 * on scattering images working exclusively in q-space (reciprocal space).
 *
 * @param imageData1 - 2D array of intensity values for first image
 * @param imageData2 - 2D array of intensity values for second image
 * @param qXVector - Array of q-values for X axis
 * @param qYVector - Array of q-values for Y axis
 * @param units - Units for q-values (e.g., "nm⁻¹", "Å⁻¹")
 * @returns Object with linecut data and management functions
 */
export default function useInclinedLinecut(
  imageData1: number[][],
  imageData2: number[][],
  qXVector: number[],
  qYVector: number[],
  zoomedXPixelRange: [number, number] | null, // Add these parameters
  zoomedYPixelRange: [number, number] | null, // to take the pixel ranges
) {
  // State for storing linecut definitions in q-space
  const [inclinedLinecuts, setInclinedLinecuts] = useState<InclinedLinecut[]>([]);

  // State for storing intensity data extracted for each linecut
  const [inclinedLinecutData1, setInclinedLinecutData1] = useState<{ id: number; data: number[] }[]>([]);
  const [inclinedLinecutData2, setInclinedLinecutData2] = useState<{ id: number; data: number[] }[]>([]);

  // Add state for Q-space zoom ranges
  const [zoomedXQRange, setZoomedXQRange] = useState<[number, number] | null>(null);
  // const [zoomedYQRange, setZoomedYQRange] = useState<[number, number] | null>(null);

    // Convert pixel ranges to Q ranges
    useEffect(() => {
        // Convert X pixel range to Q range
        const xQRange = zoomedXPixelRange
            ? [
                qXVector[Math.min(zoomedXPixelRange[0], qXVector.length - 1)],
                qXVector[Math.min(zoomedXPixelRange[1], qXVector.length - 1)]
            ] as [number, number]
            : null;

        // // Convert Y pixel range to Q range
        // const yQRange = zoomedYPixelRange
        //     ? [
        //         qYVector[Math.min(zoomedYPixelRange[0], qYVector.length - 1)],
        //         qYVector[Math.min(zoomedYPixelRange[1], qYVector.length - 1)]
        //     ] as [number, number]
        //     : null;

        setZoomedXQRange(xQRange);
        // setZoomedYQRange(yQRange);
        }, [zoomedXPixelRange, zoomedYPixelRange, qXVector, qYVector]);


  // Image dimensions in pixels
  const imageHeight = imageData1.length;
  const imageWidth = imageData1[0]?.length || 0;

  /**
   * Convert q-space coordinates to pixel coordinates
   *
   * @param qX - X position in q-space
   * @param qY - Y position in q-space
   * @returns Pixel coordinates [x, y]
   */
  const qToPixel = useCallback((qX: number, qY: number): [number, number] => {
    // Find index of closest q-value in qXVector
    let xPixel = 0;
    let minDiffX = Math.abs(qXVector[0] - qX);

    for (let i = 1; i < qXVector.length; i++) {
      const diff = Math.abs(qXVector[i] - qX);
      if (diff < minDiffX) {
        minDiffX = diff;
        xPixel = i;
      }
    }

    // Find index of closest q-value in qYVector
    let yPixel = 0;
    let minDiffY = Math.abs(qYVector[0] - qY);

    for (let i = 1; i < qYVector.length; i++) {
      const diff = Math.abs(qYVector[i] - qY);
      if (diff < minDiffY) {
        minDiffY = diff;
        yPixel = i;
      }
    }

    return [xPixel, yPixel];
  }, [qXVector, qYVector]);

  /**
   * Calculate endpoints of an inclined line in pixel space
   *
   * @param qXPosition - Center X position in q-space
   * @param qYPosition - Center Y position in q-space
   * @param angle - Angle in degrees
   * @returns Object with endpoints coordinates or null if invalid
   */
  const calculateLinecutEndpoints = useCallback((
    qXPosition: number,
    qYPosition: number,
    angle: number
  ) => {
    // Convert center position from q-space to pixel space
    const [centerX, centerY] = qToPixel(qXPosition, qYPosition);

    // Calculate direction vector based on angle
    const angleRad = (angle * Math.PI) / 180;
    const dirX = Math.cos(angleRad);
    const dirY = -Math.sin(angleRad); // Y-axis points downward in image coordinates

    // Extend the line to the image boundaries
    // Calculate intersection with image boundaries
    let tMin = -Infinity;
    let tMax = Infinity;

    // Intersection with x=0 boundary
    if (dirX !== 0) {
      const t = -centerX / dirX;
      if (dirX > 0) tMin = Math.max(tMin, t);
      else tMax = Math.min(tMax, t);
    }

    // Intersection with x=width-1 boundary
    if (dirX !== 0) {
      const t = (imageWidth - 1 - centerX) / dirX;
      if (dirX > 0) tMax = Math.min(tMax, t);
      else tMin = Math.max(tMin, t);
    }

    // Intersection with y=0 boundary
    if (dirY !== 0) {
      const t = -centerY / dirY;
      if (dirY > 0) tMin = Math.max(tMin, t);
      else tMax = Math.min(tMax, t);
    }

    // Intersection with y=height-1 boundary
    if (dirY !== 0) {
      const t = (imageHeight - 1 - centerY) / dirY;
      if (dirY > 0) tMax = Math.min(tMax, t);
      else tMin = Math.max(tMin, t);
    }

    // Check if line intersects the image
    if (tMin > tMax) return null;

    // Calculate endpoints
    const x0 = centerX + tMin * dirX;
    const y0 = centerY + tMin * dirY;
    const x1 = centerX + tMax * dirX;
    const y1 = centerY + tMax * dirY;

    return { x0, y0, x1, y1 };
  }, [qToPixel, imageWidth, imageHeight]);




/**
 * Compute intensity data along an inclined linecut
 */
const computeInclinedLinecutData = useCallback((
  imageData: number[][],
  qXPosition: number,
  qYPosition: number,
  angle: number,
  qWidth: number
): number[] => {
  // Calculate endpoints in pixel space
  const endpoints = calculateLinecutEndpoints(qXPosition, qYPosition, angle);
  if (!endpoints) return [];

  const { x0, y0, x1, y1 } = endpoints;

  // Calculate direction vectors
  const angleRad = (angle * Math.PI) / 180;
  const dirX = Math.cos(angleRad);
  const dirY = -Math.sin(angleRad);

  // Perpendicular vector for width calculations
  const perpX = -dirY;
  const perpY = dirX;

  // Calculate total line length in pixel space
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) return [];

  // Use the centralized function to calculate pixel width
  const pixelWidth = calculateInclinedQSpaceToPixelWidth(
    qXPosition,
    qYPosition,
    angle,
    qWidth,
    qXVector,
    qYVector,
  );

  // Sample points along the line
  const numPoints = Math.ceil(length);
  const intensities = new Array(numPoints).fill(0);
  const halfWidth = pixelWidth / 2;

  // For each point along the line
  for (let i = 0; i < numPoints; i++) {
    let sum = 0;
    let count = 0;

    // Base position along the line
    const baseX = x0 + (i / numPoints) * dx;
    const baseY = y0 + (i / numPoints) * dy;

    // Sample perpendicular to the line for width averaging
    for (let w = -halfWidth; w <= halfWidth; w += 0.5) {
      const x = Math.round(baseX + w * perpX);
      const y = Math.round(baseY + w * perpY);

      // Check if point is within bounds
      if (x >= 0 && x < imageData[0].length && y >= 0 && y < imageData.length) {
        // If value is NaN, treat it as 0
        const value = Number.isNaN(imageData[y][x]) ? 0 : imageData[y][x];
        sum += value;
        count++;
      }
    }

    intensities[i] = count > 0 ? sum / count : 0;
  }

  return intensities;
}, [calculateLinecutEndpoints, qXVector, qYVector]);


  /**
   * Create a new inclined linecut at the center of the available q-range
   */
  const addInclinedLinecut = useCallback(throttle(() => {
    // Find the next available ID for the new linecut
    const existingIds = inclinedLinecuts.map((linecut) => linecut.id);
    const newId = Math.max(0, ...existingIds) + 1;

    const defaultQX = 0;
    const defaultQY = 0;

    // Create the new linecut object with default properties
    const newLinecut: InclinedLinecut = {
      id: newId,
      qXPosition: defaultQX,
      qYPosition: defaultQY,
      angle: 45,  // Default 45-degree angle
      qWidth: 0,  // Start with zero width
      width: 0,   // Width in pixels
      // Assign colors from palette, cycling through available colors
      leftColor: leftImageColorPalette[(newId - 1) % leftImageColorPalette.length],
      rightColor: rightImageColorPalette[(newId - 1) % rightImageColorPalette.length],
      hidden: false,
      type: 'inclined'
    };

    // Add the new linecut to the state
    setInclinedLinecuts((prev) => [...prev, newLinecut]);

    // Extract and store intensity data for the new linecut from both images
    if (imageData1 && imageData1.length > 0 && imageData2 && imageData2.length > 0) {
      const data1 = computeInclinedLinecutData(
        imageData1,
        defaultQX,
        defaultQY,
        45, // Default angle
        0   // Default width
      );

      const data2 = computeInclinedLinecutData(
        imageData2,
        defaultQX,
        defaultQY,
        45, // Default angle
        0   // Default width
      );

      setInclinedLinecutData1((prev) => [...prev, { id: newId, data: data1 }]);
      setInclinedLinecutData2((prev) => [...prev, { id: newId, data: data2 }]);
    }
  }, 200), [
    inclinedLinecuts,
    computeInclinedLinecutData,
    qXVector,
    qYVector,
    imageData1,
    imageData2
  ]);

  /**
   * Updates the angle of an inclined linecut
   *
   * @param id - ID of the linecut to update
   * @param angle - New angle in degrees
   */
  const updateInclinedLinecutAngle = useCallback(throttle((
    id: number,
    angle: number
  ) => {
    // Normalize angle to -180 to 180 range
    const normalizedAngle = ((angle % 360 + 540) % 360) - 180;

    // Update the linecut with the new angle
    setInclinedLinecuts(prev =>
      prev.map(linecut =>
        linecut.id === id ? { ...linecut, angle: normalizedAngle } : linecut
      )
    );

    // Get the updated linecut to recompute the data
    const updatedLinecut = inclinedLinecuts.find(l => l.id === id);
    if (!updatedLinecut) return;

    // Recompute intensity data with the new angle
    if (imageData1.length > 0 && imageData2.length > 0) {
      const newData1 = computeInclinedLinecutData(
        imageData1,
        updatedLinecut.qXPosition,
        updatedLinecut.qYPosition,
        normalizedAngle,
        updatedLinecut.qWidth
      );

      const newData2 = computeInclinedLinecutData(
        imageData2,
        updatedLinecut.qXPosition,
        updatedLinecut.qYPosition,
        normalizedAngle,
        updatedLinecut.qWidth
      );

      // Update intensity data in both datasets
      setInclinedLinecutData1(prev =>
        prev.map(data =>
          data.id === id ? { ...data, data: newData1 } : data
        )
      );

      setInclinedLinecutData2(prev =>
        prev.map(data =>
          data.id === id ? { ...data, data: newData2 } : data
        )
      );
    }
  }, 200), [inclinedLinecuts, computeInclinedLinecutData, imageData1, imageData2]);

  /**
   * Updates the width of an inclined linecut in q-space
   *
   * @param id - ID of the linecut to update
   * @param qWidth - New width in q-space units
   */
  const updateInclinedLinecutWidth = useCallback(throttle((
    id: number,
    qWidth: number
  ) => {
    // Update the linecut with the new width
    setInclinedLinecuts(prev =>
      prev.map(linecut =>
        linecut.id === id ? { ...linecut, qWidth } : linecut
      )
    );

    // Get the updated linecut to recompute the data
    const updatedLinecut = inclinedLinecuts.find(l => l.id === id);
    if (!updatedLinecut) return;

    // Recompute intensity data with the new width
    if (imageData1.length > 0 && imageData2.length > 0) {
      const newData1 = computeInclinedLinecutData(
        imageData1,
        updatedLinecut.qXPosition,
        updatedLinecut.qYPosition,
        updatedLinecut.angle,
        qWidth
      );

      const newData2 = computeInclinedLinecutData(
        imageData2,
        updatedLinecut.qXPosition,
        updatedLinecut.qYPosition,
        updatedLinecut.angle,
        qWidth
      );

      // Update intensity data in both datasets
      setInclinedLinecutData1(prev =>
        prev.map(data =>
          data.id === id ? { ...data, data: newData1 } : data
        )
      );

      setInclinedLinecutData2(prev =>
        prev.map(data =>
          data.id === id ? { ...data, data: newData2 } : data
        )
      );
    }
  }, 200), [inclinedLinecuts, computeInclinedLinecutData, imageData1, imageData2]);

  /**
   * Updates the color of a linecut (left or right side)
   *
   * @param id - ID of the linecut to update
   * @param side - Which side to update ('left' or 'right')
   * @param color - New color in CSS format
   */
  const updateInclinedLinecutColor = useCallback((
    id: number,
    side: 'left' | 'right',
    color: string
  ) => {
    // Update the color property for the specified side of the linecut
    setInclinedLinecuts((prev) =>
      prev.map((linecut) =>
        linecut.id === id
          ? { ...linecut, [`${side}Color`]: color }
          : linecut
      )
    );
  }, []);

  /**
   * Removes a linecut and renumbers the remaining ones
   *
   * @param id - ID of the linecut to delete
   */
  const deleteInclinedLinecut = useCallback((id: number) => {
    // Remove the linecut from the list and renumber remaining linecuts
    setInclinedLinecuts((prev) => {
      const updatedLinecuts = prev.filter((linecut) => linecut.id !== id);
      // Renumber the remaining linecuts to maintain sequential IDs
      return updatedLinecuts.map((linecut, index) => ({
        ...linecut,
        id: index + 1,
      }));
    });

    // Similarly update the intensity data arrays for both images
    setInclinedLinecutData1((prev) =>
      prev.filter((data) => data.id !== id).map((data, index) => ({
        ...data,
        id: index + 1,
      }))
    );

    setInclinedLinecutData2((prev) =>
      prev.filter((data) => data.id !== id).map((data, index) => ({
        ...data,
        id: index + 1,
      }))
    );
  }, []);

  /**
   * Toggles the visibility of a linecut
   *
   * @param id - ID of the linecut to toggle
   */
  const toggleInclinedLinecutVisibility = useCallback((id: number) => {
    setInclinedLinecuts((prev) =>
      prev.map((linecut) =>
        linecut.id === id ? { ...linecut, hidden: !linecut.hidden } : linecut
      )
    );
  }, []);

  /**
   * Effect to update all linecut data when qXVector or qYVector changes
   *
   * This ensures that if the q-space mapping changes, all linecuts maintain
   * their positions in q-space but update their visualizations correctly.
   */
  useEffect(() => {
    // Skip if vectors are empty or no linecuts exist
    if (!qXVector?.length || !qYVector?.length || !inclinedLinecuts.length) return;

    // Recompute all linecut data with current q-vectors
    inclinedLinecuts.forEach(linecut => {
      if (imageData1.length > 0 && imageData2.length > 0) {
        const newData1 = computeInclinedLinecutData(
          imageData1,
          linecut.qXPosition,
          linecut.qYPosition,
          linecut.angle,
          linecut.qWidth
        );

        const newData2 = computeInclinedLinecutData(
          imageData2,
          linecut.qXPosition,
          linecut.qYPosition,
          linecut.angle,
          linecut.qWidth
        );

        setInclinedLinecutData1(prev =>
          prev.map(data =>
            data.id === linecut.id ? { ...data, data: newData1 } : data
          )
        );

        setInclinedLinecutData2(prev =>
          prev.map(data =>
            data.id === linecut.id ? { ...data, data: newData2 } : data
          )
        );
      }
    });
  }, [qXVector, qYVector, inclinedLinecuts, computeInclinedLinecutData, imageData1, imageData2]);

  // Return all the state and functions needed to use and manage linecuts in q-space
  return {
    inclinedLinecuts,
    inclinedLinecutData1,
    inclinedLinecutData2,
    addInclinedLinecut,
    // updateInclinedLinecutXPosition,
    // updateInclinedLinecutYPosition,
    updateInclinedLinecutAngle,
    updateInclinedLinecutWidth,
    updateInclinedLinecutColor,
    deleteInclinedLinecut,
    toggleInclinedLinecutVisibility,
    // calculateQPathDistance,
    zoomedXQRange,
    // zoomedYQRange,
  };
}













// import { useState, useCallback, useEffect } from 'react';
// import { leftImageColorPalette, rightImageColorPalette } from '../utils/constants';
// import { throttle } from 'lodash';
// import { InclinedLinecut } from '../types';

// /**
//  * Custom hook for managing inclined linecuts in q-space
//  *
//  * This hook provides functionality to create, manipulate, and visualize inclined linecuts
//  * on scattering images working exclusively in q-space (reciprocal space).
//  *
//  * @param imageData1 - 2D array of intensity values for first image
//  * @param imageData2 - 2D array of intensity values for second image
//  * @param qXMatrix - 2D matrix of q-values for X axis
//  * @param qYMatrix - 2D matrix of q-values for Y axis
//  * @param zoomedXPixelRange - Zoomed pixel range in X direction
//  * @param zoomedYPixelRange - Zoomed pixel range in Y direction
//  * @returns Object with linecut data and management functions
//  */
// export default function useInclinedLinecut(
//   imageData1: number[][],
//   imageData2: number[][],
//   qXMatrix: number[][],
//   qYMatrix: number[][],
//   zoomedXPixelRange: [number, number] | null,
//   zoomedYPixelRange: [number, number] | null,
// ) {
//   // State for storing linecut definitions in q-space
//   const [inclinedLinecuts, setInclinedLinecuts] = useState<InclinedLinecut[]>([]);

//   // State for storing intensity data extracted for each linecut
//   const [inclinedLinecutData1, setInclinedLinecutData1] = useState<{ id: number; data: number[] }[]>([]);
//   const [inclinedLinecutData2, setInclinedLinecutData2] = useState<{ id: number; data: number[] }[]>([]);

//   // Add state for Q-space zoom ranges
//   const [zoomedXQRange, setZoomedXQRange] = useState<[number, number] | null>(null);

//   // Convert pixel ranges to Q ranges
//   useEffect(() => {
//     if (!qXMatrix || !qXMatrix.length || !qYMatrix || !qYMatrix.length) return;

//     // Convert X pixel range to Q range
//     const xQRange = zoomedXPixelRange
//       ? [
//           qXMatrix[Math.min(Math.floor(qXMatrix.length / 2), qXMatrix.length - 1)][Math.min(zoomedXPixelRange[0], qXMatrix[0].length - 1)],
//           qXMatrix[Math.min(Math.floor(qXMatrix.length / 2), qXMatrix.length - 1)][Math.min(zoomedXPixelRange[1], qXMatrix[0].length - 1)]
//         ] as [number, number]
//       : null;

//     setZoomedXQRange(xQRange);
//   }, [zoomedXPixelRange, zoomedYPixelRange, qXMatrix, qYMatrix]);


//   // Image dimensions in pixels
//   const imageHeight = imageData1.length;
//   const imageWidth = imageData1[0]?.length || 0;

//   /**
//    * Convert q-space coordinates to pixel coordinates
//    *
//    * @param qX - X position in q-space
//    * @param qY - Y position in q-space
//    * @returns Pixel coordinates [x, y]
//    */
//   const qToPixel = useCallback((qX: number, qY: number): [number, number] => {
//     // Handle the case where matrices are empty
//     if (!qXMatrix || !qXMatrix.length || !qYMatrix || !qYMatrix.length) {
//       return [
//         Math.floor(imageWidth / 2),
//         Math.floor(imageHeight / 2)
//       ];
//     }

//     let closestX = 0;
//     let closestY = 0;
//     let minDistanceX = Infinity;
//     let minDistanceY = Infinity;

//     // Search through the matrix to find the closest point
//     for (let y = 0; y < qXMatrix.length; y++) {
//       for (let x = 0; x < qXMatrix[y].length; x++) {
//         const distX = Math.abs(qXMatrix[y][x] - qX);
//         const distY = Math.abs(qYMatrix[y][x] - qY);

//         // Find closest match for X
//         if (distX < minDistanceX) {
//           minDistanceX = distX;
//           closestX = x;
//         }

//         // Find closest match for Y
//         if (distY < minDistanceY) {
//           minDistanceY = distY;
//           closestY = y;
//         }
//       }
//     }

//     return [closestX, closestY];
//   }, [qXMatrix, qYMatrix, imageWidth, imageHeight]);

//   /**
//    * Calculate endpoints of an inclined line in pixel space
//    *
//    * @param qXPosition - Center X position in q-space
//    * @param qYPosition - Center Y position in q-space
//    * @param angle - Angle in degrees
//    * @returns Object with endpoints coordinates or null if invalid
//    */
//   const calculateLinecutEndpoints = useCallback((
//     qXPosition: number,
//     qYPosition: number,
//     angle: number
//   ) => {
//     // Convert center position from q-space to pixel space
//     const [centerX, centerY] = qToPixel(qXPosition, qYPosition);

//     // Calculate direction vector based on angle
//     const angleRad = (angle * Math.PI) / 180;
//     const dirX = Math.cos(angleRad);
//     const dirY = -Math.sin(angleRad); // Y-axis points downward in image coordinates

//     // Extend the line to the image boundaries
//     // Calculate intersection with image boundaries
//     let tMin = -Infinity;
//     let tMax = Infinity;

//     // Intersection with x=0 boundary
//     if (dirX !== 0) {
//       const t = -centerX / dirX;
//       if (dirX > 0) tMin = Math.max(tMin, t);
//       else tMax = Math.min(tMax, t);
//     }

//     // Intersection with x=width-1 boundary
//     if (dirX !== 0) {
//       const t = (imageWidth - 1 - centerX) / dirX;
//       if (dirX > 0) tMax = Math.min(tMax, t);
//       else tMin = Math.max(tMin, t);
//     }

//     // Intersection with y=0 boundary
//     if (dirY !== 0) {
//       const t = -centerY / dirY;
//       if (dirY > 0) tMin = Math.max(tMin, t);
//       else tMax = Math.min(tMax, t);
//     }

//     // Intersection with y=height-1 boundary
//     if (dirY !== 0) {
//       const t = (imageHeight - 1 - centerY) / dirY;
//       if (dirY > 0) tMax = Math.min(tMax, t);
//       else tMin = Math.max(tMin, t);
//     }

//     // Check if line intersects the image
//     if (tMin > tMax) return null;

//     // Calculate endpoints
//     const x0 = centerX + tMin * dirX;
//     const y0 = centerY + tMin * dirY;
//     const x1 = centerX + tMax * dirX;
//     const y1 = centerY + tMax * dirY;

//     return { x0, y0, x1, y1 };
//   }, [qToPixel, imageWidth, imageHeight]);

//   /**
//    * Compute intensity data along an inclined linecut
//    *
//    * @param imageData - 2D array of intensity values
//    * @param qXPosition - Center X position in q-space
//    * @param qYPosition - Center Y position in q-space
//    * @param angle - Angle in degrees
//    * @param qWidth - Width in q-space units
//    * @returns Array of intensity values along the linecut
//    */
//   const computeInclinedLinecutData = useCallback((
//     imageData: number[][],
//     qXPosition: number,
//     qYPosition: number,
//     angle: number,
//     qWidth: number
//   ): number[] => {
//     // Calculate endpoints in pixel space
//     const endpoints = calculateLinecutEndpoints(qXPosition, qYPosition, angle);
//     if (!endpoints) return [];

//     const { x0, y0, x1, y1 } = endpoints;

//     // Calculate direction vectors
//     const angleRad = (angle * Math.PI) / 180;
//     const dirX = Math.cos(angleRad);
//     const dirY = -Math.sin(angleRad);

//     // Perpendicular vector for width calculations
//     const perpX = -dirY;
//     const perpY = -dirX;

//     // Calculate total line length in pixel space
//     const dx = x1 - x0;
//     const dy = y1 - y0;
//     const length = Math.sqrt(dx * dx + dy * dy);

//     if (length === 0) return [];

//     // Convert q-width to approximate pixel width
//     // This is an approximation - in a real application you would need
//     // to consider the q-space scale factors in different directions
//     let pixelWidth = 0;

//     if (qWidth > 0) {
//       // Find two q-points separated by qWidth
//       const q1 = [qXPosition, qYPosition];
//       const q2 = [qXPosition + qWidth * Math.cos(angleRad), qYPosition - qWidth * Math.sin(angleRad)];

//       // Convert both to pixel space
//       const [p1x, p1y] = qToPixel(q1[0], q1[1]);
//       const [p2x, p2y] = qToPixel(q2[0], q2[1]);

//       // Calculate pixel distance
//       const pdx = p2x - p1x;
//       const pdy = p2y - p1y;
//       pixelWidth = Math.sqrt(pdx * pdx + pdy * pdy);
//     }

//     // Sample points along the line
//     const numPoints = Math.ceil(length);
//     const intensities = new Array(numPoints).fill(0);
//     const halfWidth = pixelWidth / 2;

//     // For each point along the line
//     for (let i = 0; i < numPoints; i++) {
//       let sum = 0;
//       let count = 0;

//       // Base position along the line
//       const baseX = x0 + (i / numPoints) * dx;
//       const baseY = y0 + (i / numPoints) * dy;

//       // Sample perpendicular to the line for width averaging
//       for (let w = -halfWidth; w <= halfWidth; w += 0.5) {
//         const x = Math.round(baseX + w * perpX);
//         const y = Math.round(baseY + w * perpY);

//         // Check if point is within bounds
//         if (x >= 0 && x < imageData[0].length && y >= 0 && y < imageData.length) {
//           sum += imageData[y][x];
//           count++;
//         }
//       }

//       intensities[i] = count > 0 ? sum / count : 0;
//     }

//     return intensities;
//   }, [calculateLinecutEndpoints, qToPixel]);


//   /**
//    * Create a new inclined linecut at the center of the available q-range
//    */
//   const addInclinedLinecut = useCallback(throttle(() => {
//     // Find the next available ID for the new linecut
//     const existingIds = inclinedLinecuts.map((linecut) => linecut.id);
//     const newId = Math.max(0, ...existingIds) + 1;

//     // Calculate default qX and qY at the center of the available range
//     let defaultQX = 0;
//     let defaultQY = 0;

//     // Find center point in q-space
//     if (qXMatrix && qXMatrix.length > 0 && qXMatrix[0] && qXMatrix[0].length > 0 &&
//         qYMatrix && qYMatrix.length > 0 && qYMatrix[0] && qYMatrix[0].length > 0) {

//       // Use the middle of the matrix as the center point
//       const midY = Math.floor(qXMatrix.length / 2);
//       const midX = Math.floor(qXMatrix[0].length / 2);

//       defaultQX = qXMatrix[midY][midX];
//       defaultQY = qYMatrix[midY][midX];
//     }

//     // Create the new linecut object with default properties
//     const newLinecut: InclinedLinecut = {
//       id: newId,
//       qXPosition: defaultQX,
//       qYPosition: defaultQY,
//       angle: 45,  // Default 45-degree angle
//       qWidth: 0,  // Start with zero width
//       width: 0,   // Width in pixels
//       // Assign colors from palette, cycling through available colors
//       leftColor: leftImageColorPalette[(newId - 1) % leftImageColorPalette.length],
//       rightColor: rightImageColorPalette[(newId - 1) % rightImageColorPalette.length],
//       hidden: false,
//       type: 'inclined'
//     };

//     // Add the new linecut to the state
//     setInclinedLinecuts((prev) => [...prev, newLinecut]);

//     // Extract and store intensity data for the new linecut from both images
//     if (imageData1 && imageData1.length > 0 && imageData2 && imageData2.length > 0) {
//       const data1 = computeInclinedLinecutData(
//         imageData1,
//         defaultQX,
//         defaultQY,
//         45, // Default angle
//         0   // Default width
//       );

//       const data2 = computeInclinedLinecutData(
//         imageData2,
//         defaultQX,
//         defaultQY,
//         45, // Default angle
//         0   // Default width
//       );

//       setInclinedLinecutData1((prev) => [...prev, { id: newId, data: data1 }]);
//       setInclinedLinecutData2((prev) => [...prev, { id: newId, data: data2 }]);
//     }
//   }, 200), [
//     inclinedLinecuts,
//     computeInclinedLinecutData,
//     qXMatrix,
//     qYMatrix,
//     imageData1,
//     imageData2
//   ]);

//   /**
//    * Updates the angle of an inclined linecut
//    *
//    * @param id - ID of the linecut to update
//    * @param angle - New angle in degrees
//    */
//   const updateInclinedLinecutAngle = useCallback(throttle((
//     id: number,
//     angle: number
//   ) => {
//     // Normalize angle to -180 to 180 range
//     const normalizedAngle = ((angle % 360 + 540) % 360) - 180;

//     // Update the linecut with the new angle
//     setInclinedLinecuts(prev =>
//       prev.map(linecut =>
//         linecut.id === id ? { ...linecut, angle: normalizedAngle } : linecut
//       )
//     );

//     // Get the updated linecut to recompute the data
//     const updatedLinecut = inclinedLinecuts.find(l => l.id === id);
//     if (!updatedLinecut) return;

//     // Recompute intensity data with the new angle
//     if (imageData1.length > 0 && imageData2.length > 0) {
//       const newData1 = computeInclinedLinecutData(
//         imageData1,
//         updatedLinecut.qXPosition,
//         updatedLinecut.qYPosition,
//         normalizedAngle,
//         updatedLinecut.qWidth
//       );

//       const newData2 = computeInclinedLinecutData(
//         imageData2,
//         updatedLinecut.qXPosition,
//         updatedLinecut.qYPosition,
//         normalizedAngle,
//         updatedLinecut.qWidth
//       );

//       // Update intensity data in both datasets
//       setInclinedLinecutData1(prev =>
//         prev.map(data =>
//           data.id === id ? { ...data, data: newData1 } : data
//         )
//       );

//       setInclinedLinecutData2(prev =>
//         prev.map(data =>
//           data.id === id ? { ...data, data: newData2 } : data
//         )
//       );
//     }
//   }, 200), [inclinedLinecuts, computeInclinedLinecutData, imageData1, imageData2]);

//   /**
//    * Updates the width of an inclined linecut in q-space
//    *
//    * @param id - ID of the linecut to update
//    * @param qWidth - New width in q-space units
//    */
//   const updateInclinedLinecutWidth = useCallback(throttle((
//     id: number,
//     qWidth: number
//   ) => {
//     // Update the linecut with the new width
//     setInclinedLinecuts(prev =>
//       prev.map(linecut =>
//         linecut.id === id ? { ...linecut, qWidth } : linecut
//       )
//     );

//     // Get the updated linecut to recompute the data
//     const updatedLinecut = inclinedLinecuts.find(l => l.id === id);
//     if (!updatedLinecut) return;

//     // Recompute intensity data with the new width
//     if (imageData1.length > 0 && imageData2.length > 0) {
//       const newData1 = computeInclinedLinecutData(
//         imageData1,
//         updatedLinecut.qXPosition,
//         updatedLinecut.qYPosition,
//         updatedLinecut.angle,
//         qWidth
//       );

//       const newData2 = computeInclinedLinecutData(
//         imageData2,
//         updatedLinecut.qXPosition,
//         updatedLinecut.qYPosition,
//         updatedLinecut.angle,
//         qWidth
//       );

//       // Update intensity data in both datasets
//       setInclinedLinecutData1(prev =>
//         prev.map(data =>
//           data.id === id ? { ...data, data: newData1 } : data
//         )
//       );

//       setInclinedLinecutData2(prev =>
//         prev.map(data =>
//           data.id === id ? { ...data, data: newData2 } : data
//         )
//       );
//     }
//   }, 200), [inclinedLinecuts, computeInclinedLinecutData, imageData1, imageData2]);

//   /**
//    * Updates the color of a linecut (left or right side)
//    *
//    * @param id - ID of the linecut to update
//    * @param side - Which side to update ('left' or 'right')
//    * @param color - New color in CSS format
//    */
//   const updateInclinedLinecutColor = useCallback((
//     id: number,
//     side: 'left' | 'right',
//     color: string
//   ) => {
//     // Update the color property for the specified side of the linecut
//     setInclinedLinecuts((prev) =>
//       prev.map((linecut) =>
//         linecut.id === id
//           ? { ...linecut, [`${side}Color`]: color }
//           : linecut
//       )
//     );
//   }, []);

//   /**
//    * Removes a linecut and renumbers the remaining ones
//    *
//    * @param id - ID of the linecut to delete
//    */
//   const deleteInclinedLinecut = useCallback((id: number) => {
//     // Remove the linecut from the list and renumber remaining linecuts
//     setInclinedLinecuts((prev) => {
//       const updatedLinecuts = prev.filter((linecut) => linecut.id !== id);
//       // Renumber the remaining linecuts to maintain sequential IDs
//       return updatedLinecuts.map((linecut, index) => ({
//         ...linecut,
//         id: index + 1,
//       }));
//     });

//     // Similarly update the intensity data arrays for both images
//     setInclinedLinecutData1((prev) =>
//       prev.filter((data) => data.id !== id).map((data, index) => ({
//         ...data,
//         id: index + 1,
//       }))
//     );

//     setInclinedLinecutData2((prev) =>
//       prev.filter((data) => data.id !== id).map((data, index) => ({
//         ...data,
//         id: index + 1,
//       }))
//     );
//   }, []);

//   /**
//    * Toggles the visibility of a linecut
//    *
//    * @param id - ID of the linecut to toggle
//    */
//   const toggleInclinedLinecutVisibility = useCallback((id: number) => {
//     setInclinedLinecuts((prev) =>
//       prev.map((linecut) =>
//         linecut.id === id ? { ...linecut, hidden: !linecut.hidden } : linecut
//       )
//     );
//   }, []);

//   /**
//    * Effect to update all linecut data when qXMatrix or qYMatrix changes
//    *
//    * This ensures that if the q-space mapping changes, all linecuts maintain
//    * their positions in q-space but update their visualizations correctly.
//    */
//   useEffect(() => {
//     // Skip if matrices are empty or no linecuts exist
//     if (!qXMatrix?.length || !qYMatrix?.length || !inclinedLinecuts.length) return;

//     // Recompute all linecut data with current q-vectors
//     inclinedLinecuts.forEach(linecut => {
//       if (imageData1.length > 0 && imageData2.length > 0) {
//         const newData1 = computeInclinedLinecutData(
//           imageData1,
//           linecut.qXPosition,
//           linecut.qYPosition,
//           linecut.angle,
//           linecut.qWidth
//         );

//         const newData2 = computeInclinedLinecutData(
//           imageData2,
//           linecut.qXPosition,
//           linecut.qYPosition,
//           linecut.angle,
//           linecut.qWidth
//         );

//         setInclinedLinecutData1(prev =>
//           prev.map(data =>
//             data.id === linecut.id ? { ...data, data: newData1 } : data
//           )
//         );

//         setInclinedLinecutData2(prev =>
//           prev.map(data =>
//             data.id === linecut.id ? { ...data, data: newData2 } : data
//           )
//         );
//       }
//     });
//   }, [qXMatrix, qYMatrix, inclinedLinecuts, computeInclinedLinecutData, imageData1, imageData2]);

//   // Return all the state and functions needed to use and manage linecuts in q-space
//   return {
//     inclinedLinecuts,
//     inclinedLinecutData1,
//     inclinedLinecutData2,
//     addInclinedLinecut,
//     updateInclinedLinecutAngle,
//     updateInclinedLinecutWidth,
//     updateInclinedLinecutColor,
//     deleteInclinedLinecut,
//     toggleInclinedLinecutVisibility,
//     zoomedXQRange,
//   };
// }
