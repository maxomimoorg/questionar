/** Existing boolean values stay valid in IndexedDB, peer snapshots and QAR1 backups. */
export type ProfileTagState = boolean | "cross";
export type ProfileTags = Record<string, ProfileTagState>;

export function isActiveTag(value: ProfileTagState | undefined) {
  return value === true || value === "cross";
}

export function nextTagState(value: ProfileTagState | undefined): ProfileTagState {
  return value === true ? "cross" : value === "cross" ? false : true;
}