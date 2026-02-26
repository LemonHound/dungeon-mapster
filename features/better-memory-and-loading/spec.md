# Optimistic Map Loading

## Status

Done

## Purpose

Currently, the website takes a while to fetch resources from the bucket, especially larger image files for particularly
detailed maps. It would be very convenient to see some updates made to this:

1. When a user uploads a map image, cache the map image locally. Use this cached image for the selected map whenever
   possible. It will only become invalid if a new map image is uploaded for the same map object, so we should also
   remove the cached image if a new image is uploaded for the same map object, if the map object is deleted entirely, or
   if the user leaves the map.
2. When attempting to load a map preview, use shimmer skeleton placeholders while waiting on the image once the map
   details are provided by the site. For instance, if the user goes to their maps list and they are associated to 10
   maps, we want to show those maps as quickly as possible. As soon as we get the SQL results saying that there are 10
   maps, place all 10 in the list. If any have a cached image, also load that in immediately. The rest may be waiting on
   a map image (or perhaps none exists), and in those cases, use a shimmering skeleton until we either learn that no
   image exists or the image is fully downloaded locally.
3. When attempting to load a map in the editor, again we want to attempt to retrieve the map image locally if it exists
   and display it immediately. If it doesn't exist, let's add some sort of placeholder instead, which will help the user
   to know that their map is loading. We should also wait to draw the grid overlay until the map image is ready so it
   doesn't appear to be broken.

## UX

**Maps List:** Map cards render immediately upon receiving the SQL results. Each card's thumbnail area shows a shimmer
skeleton animation while its image is pending. If a cached image is available for a map, it loads into the thumbnail
instantly with no shimmer delay. Once a remote image finishes downloading, it replaces the shimmer. If a map has no
image at all (`imageUrl` is null), the shimmer resolves to the existing "No image" placeholder.

**Map Editor — image loading:** When opening a map that has an `imageUrl`, an animated shimmer fills the canvas area
while the image loads — consistent with the shimmer used in the maps list. If the image is cached, it renders
immediately and the shimmer is skipped. The grid overlay is not drawn until the map image is ready — preventing the
appearance of a broken or misaligned grid.

**Map Editor — no image yet:** When a map has no `imageUrl`, neither the image nor the grid is rendered. Instead, a
prompt is shown in the canvas area directing the user to upload an image to get started.

**After Upload:** When a user uploads a new image in the editor, it is displayed on the canvas immediately from the
file selected on their machine (before any network round-trip). In the background, the image is uploaded to GCS and
the response blob is cached for future sessions. Any prior cached entry for the same map is evicted at this point.

## Behavior

**Caching mechanism:** Use the browser's Cache API (`caches`), keyed by the image filename (e.g.
`map-images/abc123_filename.png`). Since image filenames are UUID-prefixed and unique per upload, a given cache key
always corresponds to exactly one image. The cached entry stores the raw blob response.

**Cache lookup (maps list):**

1. Maps list receives all map objects from the API.
2. For each map with an `imageUrl`, check the Cache API for a cached response.
3. If cached: create an object URL from the cached blob and populate the thumbnail immediately.
4. If not cached: show a shimmer skeleton, then fetch from `/api/upload/image/{filename}`, cache the response, and
   resolve the shimmer when the blob is ready.
5. If `imageUrl` is null: resolve the shimmer to the "No image" placeholder.

**Cache invalidation (maps list):** On load, after receiving the full maps list from the API, collect all `imageUrl`
values present in the response. Open the Cache API and delete any entries whose keys are not in this set. Since the
maps list is always the complete set for the current user, any orphaned entries (from deleted maps, left maps, or
superseded uploads) are safely removed at this point. Note: if a different user logs in on the same device, this
sweep will also remove cached images that were not shared between the two users, as their map lists will differ.

**Cache lookup (map editor):**

1. `applyMapData()` checks the Cache API for the map's `imageUrl`.
2. If cached: create an object URL, set `this.mapImage`, and call `render()` immediately (no shimmer).
3. If not cached: show a shimmer on the canvas, fetch from `/api/upload/image/{filename}`, cache the response, set
   `this.mapImage`, remove the shimmer, and call `render()`.
4. If `imageUrl` is null: show the "upload to get started" prompt. Do not render the grid.
5. Grid overlay (`drawGrid`) is only called once `this.mapImage` is set, regardless of path.

**Cache write (on upload):**

1. When `onFileSelected` triggers, immediately create an object URL from the local `File` object and render it on the
   canvas — no network round-trip required for display.
2. Upload the file to GCS via `/api/upload/image`. On success, evict any cached entry for the previous `imageUrl`
   (read from `mapData.imageUrl` before it is overwritten), then cache the new blob response under the new filename
   key.
3. Save the new `imageUrl` to `mapData` and schedule an auto-save.

**Cache service:** Introduce a shared `MapImageCacheService` to encapsulate Cache API interactions (get, put, evict,
sweep). Both `MapsListComponent` and `MapEditor` will inject this service.

## Edge Cases

* If a cached image is served to the user but the subsequent background fetch from GCS returns a different blob (e.g.
  a corrupted or stale cache entry), the new image replaces what is shown on the canvas. An info banner is displayed
  for 10 seconds: "Your cached map image was out of sync and has been updated." The stale cache entry is replaced with
  the newly fetched blob.
    * If the user has made local changes since the cached image was displayed (e.g. grid element names or variable
      values have been modified), an error banner is shown instead: "Your cached map image was out of sync. Any
      unsaved changes to this map have been lost." The banner persists until dismissed.
* The Cache API requires a secure context (HTTPS). In local development over HTTP, `caches` is unavailable. The
  `MapImageCacheService` must check for Cache API availability on init and fall through to normal remote fetch
  behavior if unavailable, with no user-visible error.
* Object URLs created from cached or uploaded blobs must be revoked via `URL.revokeObjectURL` when no longer needed,
  consistent with the existing pattern in `map-editor.ts`.
* If a user uploads an image and refreshes the page before the GCS upload completes and the blob is cached, the cache
  will not contain the new image. On reload, `mapData.imageUrl` will still reflect the previous value (the save has
  not yet completed), so the editor will load the previous image or show the "no image" prompt. The in-progress upload
  is lost. No special handling is required beyond this existing auto-save timing behavior.