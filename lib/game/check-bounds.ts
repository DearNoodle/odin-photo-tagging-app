export type Bounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export function checkBounds(x: number, y: number, bounds: Bounds): boolean {
  return (
    x > bounds.xMin && x < bounds.xMax && y > bounds.yMin && y < bounds.yMax
  );
}
