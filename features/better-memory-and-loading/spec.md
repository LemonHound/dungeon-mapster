# Feature Name

Change this line to a name (2-6 words or so) that sufficiently captures what this feature is doing

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

How does the user interact with this? How does it fit into the user experience?

## Behavior

Step by step explanation of this feature and how it works.

## Edge Cases

* If for some reason a cached map image doesn't match the map image we get from the bucket, replace the map image on
  screen and add an info banner to the user (~10 second auto-removal timer) to let them know that their cached image was
  out of sync, or something to that effect.
    * In cases when the user has somehow started to make changes locally, such as adding names or variable values to
      grid elements, let's instead show an error banner so they are aware that their progress was just lost.

## Open Questions

Open questions that should still be addressed. Add open discussion topics to this section as they come up during
planning.

Note: This section should be cleaned / emptied before development begins.