import { reject, withAnnotation, type Session } from "../state";
import type { Result } from "../types";

export interface SetResult {
  type: "set_result";
  result: Result;
}

export interface ClearResult {
  type: "clear_result";
}

export type ResultCommand = SetResult | ClearResult;

export function setResult(session: Session, command: SetResult): Session {
  const { winner, method } = command.result;
  if (method === "draw") {
    if (winner !== undefined) reject("A draw has no winner.");
    return withAnnotation(session, { result: { method } });
  }
  if (winner === undefined) reject("Pick the winner (only a draw has none).");
  if (!session.annotation.athletes.includes(winner)) reject(`"${winner}" isn't one of this Match's Athletes.`);
  return withAnnotation(session, { result: { winner, method } });
}

export function clearResult(session: Session, _command: ClearResult): Session {
  const { result: _result, ...annotation } = session.annotation;
  return { ...session, annotation };
}
