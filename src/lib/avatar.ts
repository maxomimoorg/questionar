// Offline avatars: the DiceBear "Critters" style (CC0) rendered on the device, with output
// identical to api.dicebear.com/10.x/critters, so no handle ever leaves the app for an avatar.
import { Avatar, Style } from "@dicebear/core";
import critters from "@dicebear/styles/critters.json";

let style: Style | undefined;
const cache = new Map<string, string>();

/** Deterministic SVG for a handle; `size` only sets the SVG's width/height attributes. */
export function avatarSvg(handle: string, size?: number): string {
  style ??= new Style(critters as ConstructorParameters<typeof Style>[0]);
  return new Avatar(style, { seed: handle, ...(size ? { size } : {}) }).toString();
}

/** Cached data: URI of the avatar, usable as <img src> and on a canvas. */
export function avatarDataUri(handle: string, size?: number): string {
  const key = `${size ?? ""}|${handle}`;
  let uri = cache.get(key);
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSvg(handle, size))}`;
    if (cache.size > 300) cache.clear();
    cache.set(key, uri);
  }
  return uri;
}
