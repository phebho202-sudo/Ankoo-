import { TopicDecisionForm } from "@/components/ResearchForms";
import { Badge } from "@/components/ui";
import type { TopicItem } from "@/lib/api";
import { fmt } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function TopicCard({
  topic,
  t,
  canDecide,
  footer,
}: {
  topic: TopicItem;
  t: Dictionary;
  canDecide: boolean;
  footer?: React.ReactNode;
}) {
  const r = t.research;
  const tone = topic.status === "approved" ? "green" : topic.status === "rejected" ? "red" : "neutral";
  return (
    <article className="rounded-md border border-navy-100 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-navy">{topic.title}</h3>
        <div className="flex gap-1">
          {topic.is_sample && <Badge tone="gold">{t.episodes.sample}</Badge>}
          <Badge tone={tone}>{r.topicStatus[topic.status]}</Badge>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{topic.description}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {topic.audience_fit && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">{r.audience}</dt>
            <dd>{topic.audience_fit}</dd>
          </div>
        )}
        {topic.lesson_angle && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">{r.angle}</dt>
            <dd>{topic.lesson_angle}</dd>
          </div>
        )}
      </dl>
      {topic.decided_by && (
        <p className="mt-3 text-xs text-charcoal-400">
          {fmt(r.decidedBy, { status: r.topicStatus[topic.status], who: topic.decided_by })}
          {topic.decision_note && <> · “{topic.decision_note}”</>}
        </p>
      )}
      {canDecide && topic.status === "proposed" && <TopicDecisionForm topicId={topic.id} labels={r} />}
      {footer}
    </article>
  );
}
