import math
from frame import project
def aim(cam, head, hfov, sx, top, push=0.0):
    """Look point (6 m out) that puts `head` (x, z, topY) at screen x = sx with its top at `top`."""
    best = None
    hx, hz, ht = head
    base = math.atan2(hx-cam[0], hz-cam[2]); dist = math.hypot(hx-cam[0], hz-cam[2])
    for i in range(-60, 61):
        yaw = base + i*0.004
        for j in range(-60, 61):
            pitch = math.atan2(ht-0.2-cam[1], dist) + j*0.004
            look = (cam[0]+math.sin(yaw)*math.cos(pitch)*6, cam[1]+math.sin(pitch)*6, cam[2]+math.cos(yaw)*math.cos(pitch)*6)
            x, _, _ = project(cam, look, hfov, (hx, ht-0.15, hz)); _, ty, _ = project(cam, look, hfov, (hx, ht, hz))
            e = (x-sx)**2 + (ty-top)**2
            if best is None or e < best[0]: best = (e, look)
    return tuple(round(v, 2) for v in best[1])
def orbit(actor, yaw, angle, dist, height):
    """Camera `dist` m from the actor at `angle` from its facing (positive = toward its right)."""
    a = yaw + angle
    return (round(actor[0]+math.sin(a)*dist, 2), height, round(actor[1]+math.cos(a)*dist, 2))
def check(name, cam, look, hfov, heads):
    from frame import report
    report(name, cam, look, hfov, heads)
