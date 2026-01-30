import { HistoricalDelta } from "./HistoricalDelta";

export interface StoredHistoricalDelta {
  createdAt: string;
  deltas: HistoricalDelta;
}
