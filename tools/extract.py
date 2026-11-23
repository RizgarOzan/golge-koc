# Runs MediaPipe PoseLandmarker (lite, same model as the app) over a video and dumps world landmarks per frame as JSON.
import sys, json, cv2, mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
video, model, out = sys.argv[1], sys.argv[2], sys.argv[3]
opts = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=model), running_mode=vision.RunningMode.VIDEO, num_poses=1)
lm = vision.PoseLandmarker.create_from_options(opts)
cap = cv2.VideoCapture(video)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
step = max(1, round(fps / 30))
frames, i = [], 0
while True:
    ok, img = cap.read()
    if not ok: break
    if i % step == 0:
        t = i / fps
        res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)), int(t * 1000))
        if res.pose_world_landmarks:
            w = [[round(p.x, 4), round(p.y, 4), round(p.z, 4)] for p in res.pose_world_landmarks[0]]
            v = [round(p.visibility, 2) for p in res.pose_landmarks[0]]
            frames.append({"t": round(t, 3), "w": w, "v": v})
        else:
            frames.append({"t": round(t, 3), "w": None})
    i += 1
json.dump({"fps": fps / step, "frames": frames}, open(out, "w"))
print(video, "frames", len(frames), "with pose", sum(1 for f in frames if f["w"]))
