import math, sys, json
# Projects head points into the letterboxed 16:9 frame: x -1..1 (left..right), y -1..1 (bottom..top of the visible picture).
VIS = 0.76  # share of picture height between letterbox bars
def project(cam, look, hfov, p):
    fx, fy, fz = (look[i] - cam[i] for i in range(3)); n = math.sqrt(fx*fx+fy*fy+fz*fz); f = (fx/n, fy/n, fz/n)
    # Left-handed, y up: right = up x forward
    r = (f[2], 0, -f[0]); rn = math.hypot(r[0], r[2]); r = (r[0]/rn, 0, r[2]/rn)
    u = (f[1]*r[2]-f[2]*r[1], f[2]*r[0]-f[0]*r[2], f[0]*r[1]-f[1]*r[0]); u = (-u[0], -u[1], -u[2]) if u[1] < 0 else u
    d = [p[i]-cam[i] for i in range(3)]; z = sum(d[i]*f[i] for i in range(3)); x = sum(d[i]*r[i] for i in range(3)); y = sum(d[i]*u[i] for i in range(3))
    th = math.tan(math.radians(hfov)/2); tv = th*9/16*VIS
    return x/z/th, y/z/tv, z
def report(name, cam, look, hfov, heads):
    out = []
    for hn, (hx, hz, top) in heads.items():
        cx, cy, dist = project(cam, look, hfov, (hx, top-0.15, hz)); _, ty, _ = project(cam, look, hfov, (hx, top, hz)); _, chin, _ = project(cam, look, hfov, (hx, top-0.3, hz))
        out.append(f"{hn}: x {cx:+.2f} top {ty:+.2f} chin {chin:+.2f} dist {dist:.2f}")
    print(name, ' | '.join(out))
if __name__ == '__main__':
    for job in json.load(open(sys.argv[1])): report(job['name'], job['cam'], job['look'], job['fov'], {k: tuple(v) for k, v in job['heads'].items()})
