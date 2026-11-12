/** Generates time-ordered unique ids (UUIDv7 in production). */
export interface IdGenerator {
  next(): string;
}
