"""The hero's moving pictures: real footage, cropped to the hero's frame, looped and encoded for the web.

    light mode  The Rain Vortex at Jewel Changi Airport, Nirjhar Basak (Pexels, 3840 x 2160, 30 fps, tripod)
                _source/hero/src/jewel-vortex-nirjhar-basak-4k.mp4
    dark mode   The Supertree Grove at Gardens by the Bay at night, Viktor Kartinskii (Vecteezy, free licence,
                attribution required; 3840 x 2160, 25 fps, tripod)
                _source/hero/src/gardens-supertrees-viktor-kartinskii.mov

Nothing is generated or painted: each clip is only cropped, resized and looped. The loop is made by fading the
clip's last second into its first, so it plays on forever without a jump (both are tripod shots).

Each clip is made at two sizes, with a still of its first frame that shows while the video loads:
    hero-<day|night>-1920.mp4 / .webp   desktops and large screens
    hero-<day|night>-1280.mp4 / .webp   tablets and phones
All are downscaled from 4K originals; nothing is upscaled.

    blender -b --factory-startup --python _source/hero/make_hero_video.py -- <site root> [day|night]
Blender is used only as a video tool here (its sequencer and its FFmpeg encoder); any editor gives the same result.
"""
import bpy, os, sys

args = sys.argv[sys.argv.index('--') + 1:]
root, only = args[0], (args[1] if len(args) > 1 else None)

AR = 1.4098                    # the hero frame's width : height (matches --wh-ar in sg-hero-welcome.css)
FADE = 30                      # frames of crossfade that close the loop (one second)
CLIPS = {
    # name: source, the crop's centre across the frame (share of width), the first and last frame to use
    'day': ('_source/hero/src/jewel-vortex-nirjhar-basak-4k.mp4', .5, 1, 330),
    'night': ('_source/hero/src/gardens-supertrees-viktor-kartinskii.mov', .47, 1, None),
}
SIZES = ((1920, 5000), (1280, 2600))       # output width, video bitrate in kbit/s


def build(name, src, cx, first, last):
    path = os.path.join(root, src)
    if not os.path.exists(path):
        print('SKIP', name, '(no source at', src + ')'); return
    sc = bpy.data.scenes.new(name); bpy.context.window.scene = sc
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    sc.render.use_sequencer = True; sc.render.resolution_percentage = 100
    ed = sc.sequence_editor_create()

    probe = ed.strips.new_movie('probe', path, channel=1, frame_start=1)
    w, h = probe.elements[0].orig_width, probe.elements[0].orig_height
    fps = probe.fps; n = probe.frame_final_duration
    ed.strips.remove(probe)
    last = last or n
    length = last - first + 1 - FADE           # the looped clip's length
    sc.render.fps = round(fps); sc.render.fps_base = round(fps) / fps
    sc.frame_start, sc.frame_end = 1, length

    # A: the clip from (first + FADE) to the end; B: its first FADE frames, faded in over A's last FADE frames
    a = ed.strips.new_movie('a', path, channel=1, frame_start=1 - (first - 1) - FADE, fit_method='ORIGINAL')
    a.frame_offset_start = first - 1 + FADE; a.frame_offset_end = n - last
    b = ed.strips.new_movie('b', path, channel=2, frame_start=length - FADE + 1 - (first - 1), fit_method='ORIGINAL')
    b.frame_offset_start = first - 1; b.frame_offset_end = n - (first - 1 + FADE)
    x = ed.strips.new_effect('x', 'CROSS', channel=3, frame_start=length - FADE + 1, length=FADE, input1=a, input2=b)
    print(name.upper(), 'source', w, 'x', h, n, 'frames at', fps, '-> loop of', length, 'frames')

    for ow, kbps in SIZES:
        oh = round(ow / AR / 2) * 2
        assert ow <= h * AR, 'the source is too small for %d px' % ow
        sc.render.resolution_x, sc.render.resolution_y = ow, oh
        # scale the source to cover the frame, then move it so the crop centres on cx
        k = max(ow / w, oh / h)
        for s in (a, b):
            s.transform.scale_x = s.transform.scale_y = k
            s.transform.offset_x = (0.5 - cx) * w * k
        base = os.path.join(root, 'assets', 'img', 'hero', 'hero-%s-%d' % (name, ow))

        im = sc.render.image_settings
        if hasattr(im, 'media_type'): im.media_type = 'IMAGE'
        im.file_format = 'WEBP'; im.color_mode = 'RGB'; im.quality = 74
        sc.frame_set(1); sc.render.filepath = base + '.webp'
        bpy.ops.render.render(write_still=True)

        if hasattr(im, 'media_type'): im.media_type = 'VIDEO'     # Blender 5 splits stills from video
        im.file_format = 'FFMPEG'
        ff = sc.render.ffmpeg
        ff.format = 'MPEG4'; ff.codec = 'H264'; ff.audio_codec = 'NONE'
        ff.constant_rate_factor = 'NONE'; ff.video_bitrate = kbps; ff.maxrate = int(kbps * 1.5); ff.buffersize = kbps * 2
        ff.ffmpeg_preset = 'BEST'; ff.gopsize = round(fps) * 2; ff.max_b_frames = 2; ff.use_max_b_frames = True
        sc.render.filepath = base + '.mp4'; sc.render.use_file_extension = False
        bpy.ops.render.render(animation=True)
        print(name.upper(), ow, 'x', oh, os.path.getsize(base + '.mp4') // 1024, 'KB video,',
              os.path.getsize(base + '.webp') // 1024, 'KB still')


for name, spec in CLIPS.items():
    if only in (None, name):
        build(name, *spec)
