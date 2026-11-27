// Rules for the Score Event track and the Result.

import type { MatchEvent } from "../types";
import type { Rule } from "./violation";

const eventAt = (index: number) => ({ kind: "event", index }) as const;

/** Every Score Event falls within the Match bounds (both ends included: a tap ends the Match). */
export const scoreEventInMatch: Rule = ({ match, events }) => {
  if (!match) return [];
  return events.flatMap((event, index) =>
    event.time < match.start_offset || event.time > match.end_offset
      ? [
          {
            rule: "score-event-in-match",
            message: `Score Event at ${event.time}s is outside the Match (${match.start_offset}s to ${match.end_offset}s).`,
            target: eventAt(index),
          },
        ]
      : [],
  );
};

/** The Match has a Result. */
export const resultPresent: Rule = ({ result }) =>
  result ? [] : [{ rule: "result-present", message: "Record the Result and its Method.", target: { kind: "result" } }];

/** The Family whose Positions are Submission Positions. */
const SUBMISSION_FAMILY = "submission";

/**
 * A submission Method needs the final Score Event to be a submission finish,
 * credited to the winner, during a Submission Position the winner holds as attacker.
 */
export const submissionFinish: Rule = ({ result, events, segments }, { vocabulary }) => {
  if (result?.method !== "submission" || !result.winner) return [];
  const fail = (message: string) => [{ rule: "submission-finish", message, target: { kind: "result" } as const }];

  // The final Event: the latest, and the last recorded of any tied at that time.
  const final = events.reduce<MatchEvent | undefined>((latest, e) => (!latest || e.time >= latest.time ? e : latest), undefined);
  if (final?.score_type !== "submission_finish") {
    return fail("A submission win needs a submission-finish Score Event as the final Score Event.");
  }
  if (final.athlete !== result.winner) return fail("The final submission finish is credited to the losing Athlete.");

  // At a boundary the later Segment has just started, so it wins.
  const during = segments.filter((s) => s.start <= final.time && final.time <= s.end).at(-1);
  const position = vocabulary.positions.find((p) => p.id === during?.position_id);
  if (position?.family !== SUBMISSION_FAMILY) {
    return fail(`The submission finish at ${final.time}s isn't during a Submission Position.`);
  }
  if (during!.first_role_holder !== result.winner) {
    return fail(`The winner isn't the attacker in the ${position.name} where the submission finish happens.`);
  }
  return [];
};
