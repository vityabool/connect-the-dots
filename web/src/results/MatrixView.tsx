import { pairCountKey, pairCounts } from '@ctd/shared';
import { useMemo } from 'react';
import { strings } from '../strings';
import type { ViewProps } from './types';

/** Who talked to whom: people on both axes, a filled cell for every connected pair. */
export function MatrixView(props: ViewProps) {
  const { people, statEdges } = props;
  const ordered = useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name)), [people]);
  const counts = useMemo(() => pairCounts(statEdges), [statEdges]);

  if (ordered.length === 0) return <p className="empty">{strings.noConnectionsYet}</p>;

  const cell = Math.max(12, Math.min(34, Math.floor(620 / ordered.length)));
  const fontSize = Math.min(14, cell);
  // Rough width of a name (an average character is about 0.6 em). Row names sit left of the grid, column names
  // are slanted by 60 degrees and rise above it and lean to the right, so each side gets the room it needs.
  const widthOf = (name: string) => name.length * fontSize * 0.6;
  const longest = Math.max(...ordered.map((p) => widthOf(p.name)));
  const left = Math.ceil(longest + 12);
  const top = Math.ceil(longest * 0.866 + 12);
  const right = Math.ceil(widthOf(ordered[ordered.length - 1]?.name ?? '') * 0.5 + 8);
  const width = left + cell * ordered.length + right;
  const height = top + cell * ordered.length;
  const font = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const max = Math.max(1, ...counts.values());

  return (
    <div className="view">
      <svg
        className="matrix"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={strings.viewMatrix}
        fontFamily={font}
        style={{ width: '100%', maxWidth: `${Math.max(width, 560)}px` }}
      >
        {ordered.map((person, i) => (
          <g key={person.id}>
            <text
              className="matrix-label"
              fill="#e2e8f0"
              x={left - 6}
              y={top + i * cell + cell / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={fontSize}
            >
              {person.name}
            </text>
            <text
              className="matrix-label"
              fill="#e2e8f0"
              transform={`translate(${left + i * cell + cell / 2} ${top - 6}) rotate(-60)`}
              textAnchor="start"
              fontSize={fontSize}
            >
              {person.name}
            </text>
          </g>
        ))}
        {ordered.map((row, r) =>
          ordered.map((col, c) => {
            const x = left + c * cell;
            const y = top + r * cell;
            if (r === c) {
              return (
                <rect
                  key={`${row.id}-${col.id}`}
                  className="matrix-self"
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  fill="#334155"
                  stroke="#0f172a"
                  strokeWidth={1}
                />
              );
            }
            const n = counts.get(pairCountKey(row.id, col.id)) ?? 0;
            return (
              <rect
                key={`${row.id}-${col.id}`}
                className={n > 0 ? 'matrix-cell filled' : 'matrix-cell'}
                data-testid={n > 0 ? 'matrix-filled' : undefined}
                x={x}
                y={y}
                width={cell}
                height={cell}
                fill={n > 0 ? '#38bdf8' : '#1e293b'}
                stroke="#0f172a"
                strokeWidth={1}
                opacity={n > 0 ? 0.35 + 0.65 * (n / max) : undefined}
              >
                {n > 0 && (
                  <title>
                    {row.name} ↔ {col.name}: {n}
                  </title>
                )}
              </rect>
            );
          }),
        )}
      </svg>
      <p className="muted">{strings.matrixHint}</p>
    </div>
  );
}
