import type { Topic } from '@ctd/shared';

/** Color key for the topic-colored lines of the graph. */
export function TopicLegend(props: {
  topics: readonly Topic[];
  topicColor: (topicId: string) => string;
  /** Only list topics that have at least one connection. */
  usedTopicIds?: ReadonlySet<string>;
}) {
  const shown = props.usedTopicIds ? props.topics.filter((t) => props.usedTopicIds?.has(t.id)) : props.topics;
  if (shown.length === 0) return null;
  return (
    <ul className="legend" aria-label="Topic colors">
      {shown.map((topic) => (
        <li key={topic.id}>
          <span className="swatch" style={{ background: props.topicColor(topic.id) }} aria-hidden="true" />
          {topic.name}
        </li>
      ))}
    </ul>
  );
}
