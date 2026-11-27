import { apply, type Command, type Session } from "../src/session/session";

/** Applies commands in order, failing the test if any is rejected. */
export function run(session: Session, commands: Command[]): Session {
  return commands.reduce((s, command) => {
    const outcome = apply(s, command);
    if (outcome.rejection) throw new Error(`rejected ${command.type}: ${outcome.rejection}`);
    return outcome.session;
  }, session);
}
