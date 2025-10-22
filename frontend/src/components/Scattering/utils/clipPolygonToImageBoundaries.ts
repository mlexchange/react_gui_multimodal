// Helper function for clipping polygons to image boundaries
export function clipPolygonToImageBoundaries(
    xPoints,
    yPoints,
    imageWidth,
    imageHeight
  ) {
    // We'll implement the Sutherland-Hodgman algorithm to clip the polygon
    // First, we need to ensure the polygon is properly closed
    if (xPoints.length !== yPoints.length) {
      throw new Error('X and Y point arrays must have the same length');
    }

    // Make sure the polygon is closed (last point equals first point)
    const n = xPoints.length;
    if (n < 3) {
      // Can't clip a polygon with fewer than 3 points
      return { x: xPoints, y: yPoints };
    }

    if (xPoints[0] !== xPoints[n-1] || yPoints[0] !== yPoints[n-1]) {
      xPoints = [...xPoints, xPoints[0]];
      yPoints = [...yPoints, yPoints[0]];
    }

    // Convert to array of point objects for easier processing
    let points = xPoints.map((x, i) => ({ x, y: yPoints[i] }));

    // Define the image boundary edges (left, right, top, bottom)
    const edges = [
      { x1: 0, y1: 0, x2: imageWidth, y2: 0 },           // Top edge
      { x1: imageWidth, y1: 0, x2: imageWidth, y2: imageHeight }, // Right edge
      { x1: imageWidth, y1: imageHeight, x2: 0, y2: imageHeight }, // Bottom edge
      { x1: 0, y1: imageHeight, x2: 0, y2: 0 }           // Left edge
    ];

    // Clip the polygon against each edge
    for (const edge of edges) {
      const inputPoints = [...points];
      points = [];

      // For each edge of the polygon
      for (let i = 0; i < inputPoints.length - 1; i++) {
        const current = inputPoints[i];
        const next = inputPoints[i + 1];

        // Determine if points are inside or outside the clip edge
        const currentInside = isPointInsideEdge(current, edge);
        const nextInside = isPointInsideEdge(next, edge);

        // Case 1: Both points inside - add the second point
        if (currentInside && nextInside) {
          points.push(next);
        }
        // Case 2: First inside, second outside - add intersection
        else if (currentInside && !nextInside) {
          points.push(getIntersection(current, next, edge));
        }
        // Case 3: First outside, second inside - add intersection and second point
        else if (!currentInside && nextInside) {
          points.push(getIntersection(current, next, edge));
          points.push(next);
        }
        // Case 4: Both outside - add nothing
      }

      // Close the polygon if we have points
      if (points.length > 0) {
        points.push(points[0]);
      }

      // If no points left after clipping, return empty polygon
      if (points.length < 3) {
        return { x: [], y: [] };
      }
    }

    // Convert back to separate x and y arrays
    return {
      x: points.map(p => p.x),
      y: points.map(p => p.y)
    };
  }

  // Helper function for polygons - checks if a point is inside an edge
  export function isPointInsideEdge(point, edge) {
    // Check which side of the edge the point is on
    // For top edge: y >= 0, right edge: x <= width, bottom edge: y <= height, left edge: x >= 0
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;

    // Calculate position relative to edge
    // Using cross product to determine which side of the line the point is on
    const crossProduct = (point.x - edge.x1) * dy - (point.y - edge.y1) * dx;

    // For clockwise defined image boundaries, inside is negative cross product
    return crossProduct <= 0;
  }

  // Helper function for polygons - gets the intersection point between a polygon edge and clip edge
  export function getIntersection(p1, p2, edge) {
    // Line 1: p1 to p2 (polygon edge)
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;

    // Line 2: edge.x1,edge.y1 to edge.x2,edge.y2 (clip edge)
    const dx2 = edge.x2 - edge.x1;
    const dy2 = edge.y2 - edge.y1;

    // Calculate intersection parameter t
    const det = dx1 * dy2 - dy1 * dx2;

    if (det === 0) {
      // Lines are parallel or coincident
      // Return a point on the clip edge as a fallback
      return { x: edge.x1, y: edge.y1 };
    }

    // Calculate intersection parameters
    const t = ((edge.x1 - p1.x) * dy2 - (edge.y1 - p1.y) * dx2) / det;

    // Calculate intersection point
    return {
      x: p1.x + t * dx1,
      y: p1.y + t * dy1
    };
  }
