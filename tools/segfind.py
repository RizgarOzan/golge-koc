# Finds times where the on-screen drill label (top-left) changes; writes one crop per segment.
import sys, subprocess, numpy as np, cv2
video, outdir = sys.argv[1], sys.argv[2]
W, H = 300, 30
raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", video, "-vf", f"fps=2,crop=420:42:0:0,scale={W}:{H},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
segs, start, ref = [], 0, fr[0]
for i in range(1, len(fr)):
    if np.abs(fr[i] - ref).mean() > 3:
        if i - start >= 6: segs.append((start / 2, i / 2, start))
        start, ref = i, fr[i]
    else:
        ref = ref * 0.9 + fr[i] * 0.1
segs.append((start / 2, len(fr) / 2, start))
crops = []
for a, b, s in segs:
    img = cv2.cvtColor(fr[min(s + 3, len(fr) - 1)].astype(np.uint8), cv2.COLOR_GRAY2BGR)
    img = cv2.resize(img, (W * 2, H * 2))
    cv2.putText(img, f"{len(crops)}", (W * 2 - 40, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
    crops.append(img)
    print(len(crops) - 1, a, b)
cols = 3
while len(crops) % cols: crops.append(np.zeros_like(crops[0]))
rows = [np.hstack(crops[i:i + cols]) for i in range(0, len(crops), cols)]
cv2.imwrite(outdir + "/labels.png", np.vstack(rows))
