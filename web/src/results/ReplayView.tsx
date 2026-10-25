import { timeline } from '@ctd/shared';
import { useEffect, useMemo, useState } from 'react';
import { NetworkGraph } from '../graph/NetworkGraph';
import { strings } from '../strings';
import { TopicLegend } from './TopicLegend';
import type { ViewProps } from './types';

const STEP_MS = 700;

/** Watch the network grow again, connection by connection, in the order people made them. */
export function ReplayView(props: ViewProps & { stepMs?: number }) {
  const { game, nodes, edges, statEdges, topicColor, animate } = props;
  const stepMs = props.stepMs ?? STEP_MS;
  const order = useMemo(() => timeline(statEdges), [statEdges]);
  const total = order.length;
  const [step, setStep] = useState(total);
  const [playing, setPlaying] = useState(false);

  const shownCount = Math.min(step, total);
  const visible = useMemo(() => {
    const ids = new Set(order.slice(0, shownCount).map((e) => e.id));
    return edges.filter((e) => ids.has(e.id));
  }, [order, edges, shownCount]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((current) => {
        if (current >= total) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, stepMs);
    return () => clearInterval(id);
  }, [playing, total, stepMs]);

  if (total === 0) return <p className="empty">{strings.noConnectionsYet}</p>;

  const last = order[shownCount - 1];
  const lastLabel = last
    ? (() => {
        const a = nodes.find((n) => n.id === last.a)?.label ?? '';
        const b = nodes.find((n) => n.id === last.b)?.label ?? '';
        const topic = game.topics.find((t) => t.id === last.topicId)?.name ?? '';
        return `${a} ↔ ${b}: ${topic}`;
      })()
    : strings.replayStart;

  function playOrPause() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (shownCount >= total) setStep(0);
    setPlaying(true);
  }

  return (
    <div className="view">
      <NetworkGraph
        nodes={nodes}
        edges={visible}
        layoutEdges={edges}
        showNames
        topicColor={topicColor}
        animate={animate}
        label={strings.graphLabel}
      />
      <div className="replay-controls">
        <button type="button" className="button" onClick={playOrPause}>
          {playing ? strings.replayPause : shownCount >= total ? strings.replayAgain : strings.replayPlay}
        </button>
        <input
          type="range"
          min={0}
          max={total}
          value={shownCount}
          aria-label={strings.replaySlider}
          onChange={(e) => {
            setPlaying(false);
            setStep(Number(e.target.value));
          }}
        />
        <span className="replay-count" aria-live="polite">
          {shownCount} / {total}
        </span>
      </div>
      <p className="replay-now">{lastLabel}</p>
      <TopicLegend topics={game.topics} topicColor={topicColor} usedTopicIds={new Set(edges.map((e) => e.topicId))} />
    </div>
  );
}
