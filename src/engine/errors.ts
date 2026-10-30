export class IllegalActionError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Illegal action: ${reason}`);
    this.name = "IllegalActionError";
    this.reason = reason;
  }
}
