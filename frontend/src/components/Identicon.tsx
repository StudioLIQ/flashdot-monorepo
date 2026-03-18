"use client";

/**
 * Deterministic 5×5 grid identicon based on Ethereum address.
 * No external dependencies — pure SVG.
 */

interface IdenticonProps {
  address: string;
  size?: number;
  className?: string;
}

function getIdenticonData(address: string): {
  color: string;
  grid: boolean[][];
} {
  const seed = address.toLowerCase().replace(/^0x/, "").padEnd(40, "0");

  // Color from first 3 bytes of address
  const r = parseInt(seed.slice(0, 2), 16);
  const g = parseInt(seed.slice(2, 4), 16);
  const b = parseInt(seed.slice(4, 6), 16);
  // Ensure reasonable saturation/lightness — blend toward a mint-ish range
  const color = `rgb(${Math.max(r, 60)},${Math.max(g, 80)},${Math.max(b, 60)})`;

  // Generate 5×3 cells (mirrored to 5×5) using bytes 6..21
  const grid: boolean[][] = [];
  for (let row = 0; row < 5; row++) {
    const rowCells: boolean[] = [];
    for (let col = 0; col < 3; col++) {
      const hexIdx = 6 + row * 3 + col;
      const val = parseInt(seed[hexIdx] ?? "0", 16);
      rowCells.push(val >= 8);
    }
    grid.push(rowCells);
  }

  return { color, grid };
}

export function Identicon({
  address,
  size = 32,
  className,
}: IdenticonProps): JSX.Element {
  const { color, grid } = getIdenticonData(address);
  const bg = "transparent";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      aria-hidden="true"
      className={className}
      style={{ background: bg }}
    >
      {grid.map((row, rowIdx) =>
        [0, 1, 2, 3, 4].map((col) => {
          const mirrorCol = col <= 2 ? col : 4 - col;
          const filled = row[mirrorCol];
          if (!filled) return null;
          return (
            <rect
              key={`${rowIdx}-${col}`}
              x={col}
              y={rowIdx}
              width={1}
              height={1}
              fill={color}
            />
          );
        })
      )}
    </svg>
  );
}
