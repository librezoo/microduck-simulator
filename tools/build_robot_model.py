#!/usr/bin/env python3
"""Build the browser robot model from the LibreZoo "microduck_927" CAD export.

Inputs
  --src   directory holding microduck_927.xml and meshes/*.stl (the team's own
          CAD export: the body that is actually printed and assembled)
  --out   app/public/robot/librezoo

Outputs (consumed by app/src/game/duck.js and game.js)
  microduck.glb                    welded, decimated visual + collision meshes
  kinematics.json                  body tree, joints and visual geoms (legs)
  kinematics_rollers.json          same tree with the roller ankle assembly
  robot_allcollisions.xml          physics MJCF (legs)
  robot_allcollisions_rollers.xml  physics MJCF (rollers)
  meshes/*.stl                     roller-only meshes (lazy-loaded)
  model-report.json                provenance and per-part statistics

What is regenerated rather than copied
  * Third-party reference parts (battery, SBC, camera, idler bearing) become
    simple proxy solids sized to their bounding boxes; vendor CAD is never
    redistributed. REF_POLLEN_* electronics are dropped entirely.
  * The TPU sole pad is not part of the CAD, so a plain slab is generated under
    each foot. Its footprint is the foot block's, its mass the 7.5 g of the
    printed pad, and its thickness restores the standing height the shipped
    policies were trained at.
  * The roller ankle (side plates, rims, tyres) is generated from primitives.
    The dynamic parameters of the roller assembly (masses, inertias, wheel
    positions) are carried over so the Drive policy keeps seeing the physics it
    was trained on.

Requires: numpy, trimesh, shapely, mapbox_earcut, lxml, fast-simplification,
mujoco.
"""

import argparse
import json
import math
import sys
from pathlib import Path

import mujoco
import numpy as np
import shapely.geometry as sg
import trimesh
from lxml import etree

# ── Part naming ────────────────────────────────────────────────────────────
ALIASES = {
    "P006": "head_dome",
    "P005": "head_band",
    "P002": "face_plate",
    "P018": "eye_ring",
    "P015": "head_base",
    "P034": "head_brace",
    "P019": "head_yoke",
    "P012": "neck_pitch_link",
    "P020": "neck_link",
    "P017": "trunk_base",
    "P024": "trunk_plate",
    "P016": "pcb_main",
    "P013__CASE": "servo_case",
    "P013__OUTPUT": "servo_horn",
    "P031__CASE": "servo_case",
    "P031__OUTPUT": "servo_horn",
    "P001": "spacer",
}
SIDE_ALIASES = {
    "P022": ("body_shell", None),  # side resolved from geometry
    "P023": ("body_shell", None),
    "P030": ("hip_cover", "left"),
    "P011": ("hip_cover", "right"),
    "P027": ("yaw_link", "left"),
    "P008": ("yaw_link", "right"),
    "P029": ("leg_plate", "left"),
    "P010": ("leg_plate", "right"),
    "P032": ("upper_leg", "left"),
    "P014": ("upper_leg", "right"),
    "P028": ("shin", "left"),
    "P009": ("shin", "right"),
    "P033": ("foot", "left"),
    "P021": ("foot", "right"),
    "P025": ("ankle_bracket_a", "left"),
    "P026": ("ankle_bracket_b", "left"),
    "P003": ("ankle_bracket_a", "right"),
    "P004": ("ankle_bracket_b", "right"),
}

# Face budgets per output mesh (prefix match). Everything is welded; the big
# organic shells are decimated so the whole robot stays near 100k triangles.
FACE_BUDGET = {
    "head_dome": 12000,
    "head_band": 7000,
    "face_plate": 7000,
    "body_shell": 7500,
    "hip_cover": 5000,
    "shin": 4000,
    "upper_leg": 4000,
    "head_base": 4500,
    "head_yoke": 4000,
    "foot": 4000,
    "pcb_main": 2500,
    "P007__DETAIL_0": 2000,
    "P007__DETAIL_1": 2000,
    "P007__DETAIL_2": 1200,
    "trunk_base": 4500,
}
DEFAULT_BUDGET = 4500
DROP_MESH_PREFIXES = ("REF_POLLEN",)  # third-party electronics, never shipped

LEFT_BODIES = {"yaw2roll", "hip_l", "upper_leg_left", "leg", "ankle_left"}
RIGHT_BODIES = {"bearing_roll", "hip_l_2", "upper_leg_right", "leg_2", "ankle_right"}

DEFAULT_POSE = [
    0, -0.08726646259971647, -0.457924, -0.004940, 0.452984,
    0.3490658503988659, 0.3490658503988659, 0, 0,
    0, 0.08726646259971647, 0.457924, 0.004940, -0.452984,
]  # fmt: skip

# kg per foot. The CAD ankle is 13 g lighter than the assembly the shipped policies
# were trained on: the 7.5 g TPU pad plus ~5.7 g of foot hardware that is not modelled.
# Matching the trained foot mass keeps the high-speed sprint policy upright; the
# measured pad alone (0.0075) lets walking through but the sprint tops out lower.
PAD_MASS = 0.0132
PAD_BOTTOM_Z = 0.0028  # m, sole height above ground at the default stance
PAD_CORNER_RADIUS = 0.004

# Parts that touch the floor in the physics model, by output mesh name. Mirrors
# the deployment stack's "all collisions" set: battery, hips, shins, head.
GROUND_COLLIDERS = {
    "battery": "box",
    "hip_cover_left": "hull",
    "hip_cover_right": "hull",
    "shin_left": "hull",
    "shin_right": "hull",
    "head_dome": "hull",
    "head_band": "hull",
}
HULL_FACES = 220

# Roller ankle assembly. These are dynamic parameters of the assembly the Drive
# policy was trained on, not geometry.
ROLLER = {
    "left": {
        "body": "ankle_l_v1",
        "inertial": ("-0.00680626 -0.0143677 -0.0151851", "0.02087",
                     "4.85529e-06 9.6767e-06 8.22681e-06 -3.18897e-07 5.6657e-08 1.31522e-07"),
        "site": ("-0 -0.0475 -0.0147", "0 -0 -0.707107 -0.707107"),
        "wheels": [("tire", "passive_LF_wheel", "-0.0395 -0.0325 -0.0147", "1 -0 0 -0"),
                   ("tire_2", "passive_LR_wheel", "0.0255 -0.0325 -0.0147", "1 -0 0 -0")],
    },
    "right": {
        "body": "ankle_r_v1",
        "inertial": ("0.00680653 -0.0143679 -0.0149822", "0.0208701",
                     "4.8595e-06 9.68066e-06 8.22663e-06 3.18865e-07 -6.7107e-08 1.66791e-07"),
        "site": ("0 -0.0475 -0.0144819", "0.707107 -0.707107 -0 0"),
        "wheels": [("tire_3", "passive_RF_wheel", "0.0395 -0.0325 -0.0144819", "0 -0 1 -0"),
                   ("tire_4", "passive_RR_wheel", "-0.0255 -0.0325 -0.0144819", "0 -0 1 -0")],
    },
}
WHEEL_INERTIAL = ("-0 0 0", "0.00447401", "2.8556e-07 2.8556e-07 5.3687e-07 -0 -6e-12 0")
WHEEL_RADIUS = 0.015
WHEEL_HALF_WIDTH = 0.00395


# ── Math helpers ───────────────────────────────────────────────────────────
def pv(s):
    return np.array([float(x) for x in s.split()])


def quat_to_mat(q):
    w, x, y, z = np.asarray(q, float) / np.linalg.norm(q)
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])  # fmt: skip


def mat_to_quat(R):
    q = np.zeros(4)
    mujoco.mju_mat2Quat(q, np.asarray(R, float).reshape(9))
    return q


def pose_matrix(pos, quat):
    T = np.eye(4)
    T[:3, :3] = quat_to_mat(quat)
    T[:3, 3] = pos
    return T


def fstr(values, nd=8):
    return " ".join(f"{float(v):.{nd}g}" for v in values)


# ── Mesh helpers ───────────────────────────────────────────────────────────
def weld(mesh):
    m = mesh.copy()
    m.merge_vertices(digits_vertex=7)
    m.update_faces(m.nondegenerate_faces())
    m.remove_unreferenced_vertices()
    return m


def decimate(mesh, budget):
    if len(mesh.faces) <= budget:
        return mesh
    import fast_simplification as fs

    v, f = fs.simplify(mesh.vertices, mesh.faces, target_count=budget, agg=7)
    out = trimesh.Trimesh(vertices=v, faces=f, process=False)
    out.remove_unreferenced_vertices()
    if len(out.faces) > budget * 1.6:  # open / non-manifold sources stall; fall back to clustering
        out = mesh.simplify_quadric_decimation(face_count=budget)
        out = out if len(out.faces) <= budget * 1.6 else trimesh.convex.convex_hull(mesh)
    return out


def budget_for(alias, source):
    for key in (alias, source):
        if key in FACE_BUDGET:
            return FACE_BUDGET[key]
    for key, value in FACE_BUDGET.items():
        if alias.startswith(key):
            return value
    return DEFAULT_BUDGET


def box_mesh(lo, hi):
    b = trimesh.creation.box(extents=np.asarray(hi) - np.asarray(lo))
    b.apply_translation((np.asarray(hi) + np.asarray(lo)) / 2)
    return b


def cylinder_mesh(radius, length, axis=2, sections=48):
    c = trimesh.creation.cylinder(radius=radius, height=length, sections=sections)
    if axis == 0:
        c.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
    elif axis == 1:
        c.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    return c


def rounded_polygon_slab(poly, thickness, z0=0.0):
    mesh = trimesh.creation.extrude_polygon(poly, height=thickness)
    mesh.apply_translation([0, 0, z0])
    return mesh


def rounded_rect(lo, hi, radius, steps=8):
    pts = []
    for cx, cy, a0 in ((hi[0] - radius, hi[1] - radius, 0), (lo[0] + radius, hi[1] - radius, 90),
                       (lo[0] + radius, lo[1] + radius, 180), (hi[0] - radius, lo[1] + radius, 270)):
        for i in range(steps + 1):
            a = math.radians(a0 + 90 * i / steps)
            pts.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
    return sg.Polygon(pts)


def capsule_hull(p0, p1, radius):
    return sg.Point(*p0).buffer(radius, 16).union(sg.Point(*p1).buffer(radius, 16)).convex_hull


def collision_hull(mesh, faces=HULL_FACES):
    hull = mesh.convex_hull
    if len(hull.faces) > faces:
        hull = hull.simplify_quadric_decimation(face_count=faces)
        hull = hull.convex_hull
    return hull


# ── Builder ────────────────────────────────────────────────────────────────
class Builder:
    def __init__(self, src: Path, out: Path):
        self.src, self.out = src, out
        self.tree = etree.parse(str(src / "microduck_927.xml"))
        self.root = self.tree.getroot()
        files = {m.get("name"): m.get("file") for m in self.root.iter("mesh")}
        self.raw = {}
        for name, file in files.items():
            if name.startswith(DROP_MESH_PREFIXES):
                continue
            self.raw[name] = weld(trimesh.load(str(src / "meshes" / file), process=False))
        self.meshes = {}  # alias -> trimesh in its own (CAD) frame
        self.report = {"source": "microduck_927", "parts": {}, "notes": []}
        self.spec = mujoco.MjSpec.from_file(str(src / "microduck_927.xml"))
        self.spec.meshdir = str(src / "meshes")
        self.model = self.spec.compile()
        self.data = mujoco.MjData(self.model)
        self.data.qpos[7:21] = DEFAULT_POSE
        mujoco.mj_forward(self.model, self.data)
        self.world0 = {}
        self._accumulate(self.root.find("worldbody").find("body"), np.eye(4))

    def _accumulate(self, b, parent_T):
        T = parent_T @ pose_matrix(pv(b.get("pos")), pv(b.get("quat", "1 0 0 0")))
        self.world0[b.get("name")] = T
        for c in b.findall("body"):
            self._accumulate(c, T)

    # naming
    def resolve_name(self, mesh_name, body_name, world_y):
        if mesh_name in SIDE_ALIASES:
            base, side = SIDE_ALIASES[mesh_name]
            if side is None:
                side = "left" if world_y >= 0 else "right"
            return f"{base}_{side}"
        return ALIASES.get(mesh_name, mesh_name)

    def proxy_for(self, mesh_name):
        m = self.raw[mesh_name]
        lo, hi = m.bounds
        ext = hi - lo
        if mesh_name == "REF_F550":
            return box_mesh(lo, hi), "battery"
        if mesh_name == "REF_RADXA_ZERO3W":
            return box_mesh(lo, hi), "sbc"
        if mesh_name == "REF_REAR_IDLER":
            axis = int(np.argmin(ext))
            c = cylinder_mesh(float(np.delete(ext, axis).min()) / 2, ext[axis], axis=axis)
            c.apply_translation((lo + hi) / 2)
            return c, "idler_bearing"
        if mesh_name == "REF_CAMERA_200":
            axis = int(np.argmax(ext))
            c = cylinder_mesh(float(np.delete(ext, axis).min()) / 2, ext[axis], axis=axis)
            c.apply_translation((lo + hi) / 2)
            return c, "lens"
        return None, None

    def register(self, alias, mesh, source, proxy):
        if alias in self.meshes:
            return
        self.meshes[alias] = decimate(mesh, budget_for(alias, source))
        self.report["parts"][alias] = {
            "source": source, "faces_src": int(len(mesh.faces)),
            "faces": int(len(self.meshes[alias].faces)), "proxy": proxy,
        }  # fmt: skip

    # ── kinematic tree + visual geoms ─────────────────────────────────────
    def build_bodies(self):
        ctrl = [a.get("joint") for a in self.root.iter("position")]
        out = []

        def walk(el, parent):
            body = {"name": el.get("name"), "parent": parent,
                    "pos": [float(x) for x in el.get("pos").split()],
                    "quat": [float(x) for x in el.get("quat", "1 0 0 0").split()], "geoms": []}  # fmt: skip
            j = el.find("joint")
            if j is not None:
                body["joint"] = {"name": j.get("name"), "axis": [float(x) for x in j.get("axis").split()],
                                 "type": j.get("type", "hinge"), "pos": [0.0, 0.0, 0.0],
                                 "range": [float(x) for x in j.get("range").split()],
                                 "actuator_index": ctrl.index(j.get("name"))}  # fmt: skip
            seen = set()
            for g in el.findall("geom"):
                if not g.get("name", "").startswith("physical"):
                    continue
                src = g.get("mesh")
                if src.startswith(DROP_MESH_PREFIXES):
                    continue
                pos, quat = pv(g.get("pos")), pv(g.get("quat", "1 0 0 0"))
                if any(o == src and np.linalg.norm(op - pos) < 5e-4
                       and abs(np.dot(oq, quat) / (np.linalg.norm(oq) * np.linalg.norm(quat))) > 0.9995
                       for o, op, oq in seen):  # the CAD lists a few solids twice at (nearly) the same pose
                    continue
                seen.add((src, tuple(pos), tuple(quat)))
                centre = quat_to_mat(quat) @ self.raw[src].bounds.mean(0) + pos
                wy = (self.world0[el.get("name")] @ np.append(centre, 1))[1]
                alias = self.resolve_name(src, el.get("name"), wy)
                proxy, proxy_alias = self.proxy_for(src) if src.startswith("REF_") else (None, None)
                if proxy is not None:
                    alias = proxy_alias
                self.register(alias, proxy if proxy is not None else self.raw[src], src, proxy is not None)
                body["geoms"].append({"type": "mesh", "mesh": f"{alias}.stl",
                                      "pos": [round(float(x), 7) for x in pos],
                                      "quat": [round(float(x), 7) for x in quat],
                                      "color": [float(x) for x in g.get("rgba").split()]})  # fmt: skip
            out.append(body)
            for c in el.findall("body"):
                walk(c, el.get("name"))

        walk(self.root.find("worldbody").find("body"), None)
        self.bodies = {b["name"]: b for b in out}
        self.body_list = out

    # ── sole pads ─────────────────────────────────────────────────────────
    def make_pads(self):
        """One pad per foot, flush under the foot block at the default stance."""
        m, d = self.model, self.data
        self.pads = {}
        for side, gname, ankle in (("left", "collision_42", "ankle_left"), ("right", "collision_47", "ankle_right")):
            g = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_GEOM, gname)
            mid = m.geom_dataid[g]
            V = m.mesh_vert[m.mesh_vertadr[mid]:m.mesh_vertadr[mid] + m.mesh_vertnum[mid]]
            W = V @ d.geom_xmat[g].reshape(3, 3).T + d.geom_xpos[g]
            lo, hi = W.min(0), W.max(0)
            assert abs(lo[2] - 0.0057) < 0.001, "foot block no longer sits where the pad was designed"
            thickness = lo[2] - PAD_BOTTOM_Z
            # slab in world axes at the default stance, then expressed in the ankle frame
            centre_w = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2] - thickness / 2])
            b = mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_BODY, ankle)
            Rb = d.xmat[b].reshape(3, 3)
            pos_b = Rb.T @ (centre_w - d.xpos[b])
            quat_b = mat_to_quat(Rb.T)
            half = np.array([(hi[0] - lo[0]) / 2, (hi[1] - lo[1]) / 2, thickness / 2])
            slab = rounded_polygon_slab(
                rounded_rect(-half[:2], half[:2], PAD_CORNER_RADIUS), thickness, z0=-half[2])
            self.pads[side] = {"body": ankle, "pos": pos_b, "quat": quat_b, "half": half,
                               "mesh": slab, "thickness": float(thickness)}  # fmt: skip
        self.report["notes"].append(
            f"sole pad {self.pads['left']['thickness'] * 1000:.2f} mm, {PAD_MASS * 1000:.1f} g per foot (foot mass matched to the trained assembly)")

    def add_pad_visuals(self):
        self.register("sole_pad", self.pads["left"]["mesh"], "generated", True)
        for side, pad in self.pads.items():
            self.bodies[pad["body"]]["geoms"].append({
                "type": "mesh", "mesh": "sole_pad.stl",
                "pos": [round(float(x), 7) for x in pad["pos"]],
                "quat": [round(float(x), 7) for x in pad["quat"]],
                "color": [0.6, 0.6, 0.6, 1.0]})  # fmt: skip
            # mirror = the left/right pad meshes are identical boxes, same mesh

    # ── physics MJCF ──────────────────────────────────────────────────────
    def combine_inertial(self, el, pad):
        """Parallel-axis merge of the ankle's CAD inertial and the pad slab."""
        inr = el.find("inertial")
        m1, c1 = float(inr.get("mass")), pv(inr.get("pos"))
        fi = pv(inr.get("fullinertia"))
        I1 = np.array([[fi[0], fi[3], fi[4]], [fi[3], fi[1], fi[5]], [fi[4], fi[5], fi[2]]])
        h = pad["half"]
        Ip_local = PAD_MASS / 3.0 * np.diag([h[1] ** 2 + h[2] ** 2, h[0] ** 2 + h[2] ** 2, h[0] ** 2 + h[1] ** 2])
        R = quat_to_mat(pad["quat"])
        Ip = R @ Ip_local @ R.T
        m2, c2 = PAD_MASS, pad["pos"]
        M = m1 + m2
        c = (m1 * c1 + m2 * c2) / M

        def shift(I, mass, cc):
            r = cc - c
            return I + mass * (np.dot(r, r) * np.eye(3) - np.outer(r, r))

        I = shift(I1, m1, c1) + shift(Ip, m2, c2)
        inr.set("mass", f"{M:.9g}")
        inr.set("pos", fstr(c, 10))
        inr.set("fullinertia", fstr([I[0, 0], I[1, 1], I[2, 2], I[0, 1], I[0, 2], I[1, 2]], 9))

    def base_xml(self):
        """927 MJCF with every geom stripped; colliders are added per variant."""
        root = etree.fromstring(etree.tostring(self.root))
        comp = root.find("compiler")
        comp.set("meshdir", "assets")
        comp.attrib.pop("inertiafromgeom", None)  # the runtime appends a ball body that relies on geom inertia
        for tag in ("asset",):
            for el in root.findall(tag):
                root.remove(el)
        for g in list(root.find("worldbody").iter("geom")):
            g.getparent().remove(g)
        # keep the stand-alone sites the runtime reads; imu follows the trunk
        return root

    def add_collider(self, body_el, kind, alias, geom_src, names):
        pos, quat = geom_src["pos"], geom_src["quat"]
        attrs = {"class": "collision", "pos": fstr(pos, 9), "quat": fstr(quat, 9)}
        if kind == "box":
            lo, hi = self.meshes[alias].bounds
            attrs.update(type="box", size=fstr((hi - lo) / 2, 6))
            ctr = (lo + hi) / 2
            R = quat_to_mat(quat)
            attrs["pos"] = fstr(np.asarray(pos) + R @ ctr, 9)
        else:
            hull_name = f"col_{alias}"
            if hull_name not in self.meshes:
                self.meshes[hull_name] = collision_hull(self.meshes[alias])
                self.report["parts"][hull_name] = {"source": alias, "faces": int(len(self.meshes[hull_name].faces)),
                                                   "proxy": True, "collision": True}  # fmt: skip
            attrs.update(type="mesh", mesh=hull_name)
            names.add(hull_name)
        etree.SubElement(body_el, "geom", attrs)

    def physics(self, variant):
        root = self.base_xml()
        asset = etree.Element("asset")
        names = set()
        wb = {b.get("name"): b for b in root.iter("body")}
        # colliders from the visual instances
        for bname, body in self.bodies.items():
            if bname not in wb:
                continue
            if variant == "rollers" and bname in ("ankle_left", "ankle_right"):
                continue
            for g in body["geoms"]:
                alias = g["mesh"][:-4]
                kind = GROUND_COLLIDERS.get(alias)
                if kind:
                    self.add_collider(wb[bname], kind, alias, g, names)
        # feet
        for side, pad in self.pads.items():
            el = wb[pad["body"]]
            if variant == "legs":
                self.combine_inertial(el, pad)
                etree.SubElement(el, "geom", {
                    "name": f"{side}_foot_collision", "class": "collision", "type": "box",
                    "pos": fstr(pad["pos"], 9), "quat": fstr(pad["quat"], 9), "size": fstr(pad["half"], 6)})  # fmt: skip
        if variant == "rollers":
            for side, spec in ROLLER.items():
                ankle = wb["ankle_left" if side == "left" else "ankle_right"]
                ankle.set("name", spec["body"])
                for child in list(ankle):
                    if child.tag in ("inertial", "site", "geom"):
                        ankle.remove(child)
                pos, mass, inertia = spec["inertial"]
                etree.SubElement(ankle, "inertial", {"pos": pos, "mass": mass, "fullinertia": inertia})
                sp, sq = spec["site"]
                etree.SubElement(ankle, "site", {"group": "3", "name": f"{side}_foot", "pos": sp, "quat": sq})
                for wname, jname, wpos, wquat in spec["wheels"]:
                    wb_el = etree.SubElement(ankle, "body", {"name": wname, "pos": wpos, "quat": wquat})
                    etree.SubElement(wb_el, "joint", {"axis": "0 0 1", "name": jname, "class": "passive_joint"})
                    ip, im, ii = WHEEL_INERTIAL
                    etree.SubElement(wb_el, "inertial", {"pos": ip, "mass": im, "fullinertia": ii})
                    etree.SubElement(wb_el, "geom", {
                        "class": "collision", "type": "cylinder", "pos": "0 0 0",
                        "size": f"{WHEEL_RADIUS} {WHEEL_HALF_WIDTH}"})  # fmt: skip
        for n in sorted(names):
            etree.SubElement(asset, "mesh", {"file": f"{n}.stl"})
        # asset must precede worldbody? MuJoCo accepts any order; keep it before actuators
        act = root.find("actuator")
        act.addprevious(asset)
        xml = etree.tostring(root, pretty_print=True, xml_declaration=True, encoding="utf-8").decode()
        return xml

    # ── roller visual assembly ────────────────────────────────────────────
    def roller_bodies(self):
        bodies = json.loads(json.dumps(self.body_list))
        by = {b["name"]: b for b in bodies}
        extra = {"roller_tire": self.make_tire(), "roller_rim": self.make_rim(),
                 "axle_cap": cylinder_mesh(0.0032, 0.0016, axis=2, sections=24)}  # fmt: skip
        thick = 0.003
        gap = WHEEL_HALF_WIDTH + 0.0012
        for side, spec in ROLLER.items():
            old = "ankle_left" if side == "left" else "ankle_right"
            ankle = by[old]
            ankle["geoms"] = [g for g in ankle["geoms"] if g["mesh"].startswith("ankle_bracket")]
            ankle["name"] = spec["body"]
            for child in bodies:
                if child["parent"] == old:
                    child["parent"] = spec["body"]
            wz = [float(x) for x in spec["wheels"][0][2].split()][2]
            xs = sorted(float(w[2].split()[0]) for w in spec["wheels"])
            outer_z, inner_z = wz - gap - thick, wz + gap
            plate = f"roller_plate_{side}"
            extra[plate] = rounded_roller_plate(xs[0], xs[1], thick)
            for z0 in (outer_z, inner_z):
                ankle["geoms"].append({"type": "mesh", "mesh": f"{plate}.stl", "pos": [0.0, 0.0, round(z0, 6)],
                                       "quat": [1.0, 0.0, 0.0, 0.0], "color": [0.5, 0.5, 0.5, 1.0]})  # fmt: skip
            for wname, jname, wpos, wquat in spec["wheels"]:
                wp = [float(x) for x in wpos.split()]
                for zc in (outer_z - 0.0008, inner_z + thick + 0.0008):
                    ankle["geoms"].append({"type": "mesh", "mesh": "axle_cap.stl", "pos": [wp[0], wp[1], zc],
                                           "quat": [1.0, 0.0, 0.0, 0.0], "color": [0.3, 0.3, 0.3, 1.0]})  # fmt: skip
                bodies.append({"name": wname, "parent": spec["body"],
                               "pos": [float(x) for x in wpos.split()],
                               "quat": [float(x) for x in wquat.split()],
                               "geoms": [{"type": "mesh", "mesh": "roller_tire.stl", "pos": [0, 0, 0],
                                          "quat": [1, 0, 0, 0], "color": [0.1, 0.1, 0.1, 1]},
                                         {"type": "mesh", "mesh": "roller_rim.stl", "pos": [0, 0, 0],
                                          "quat": [1, 0, 0, 0], "color": [0.8, 0.8, 0.8, 1]}],
                               "joint": {"name": jname, "axis": [0.0, 0.0, 1.0], "type": "hinge",
                                         "pos": [0, 0, 0], "range": None}})  # fmt: skip
        return bodies, extra

    def make_tire(self):
        # rounded shoulder tyre: lathe of a rounded rectangle profile around the axle
        r, hw, rr = WHEEL_RADIUS, WHEEL_HALF_WIDTH, 0.0018
        prof = [(r - 0.0042, -hw), (r - rr, -hw), (r, -hw + rr), (r, hw - rr), (r - rr, hw), (r - 0.0042, hw)]
        pts = []
        for i, (x, z) in enumerate(prof):
            pts.append((x, z))
        return lathe(pts, 64)

    def make_rim(self):
        hw = WHEEL_HALF_WIDTH - 0.0004
        pts = [(0.0, -hw), (0.0098, -hw), (0.0106, -hw + 0.0006), (0.0106, hw - 0.0006), (0.0098, hw), (0.0, hw)]
        return lathe(pts, 48)

    # ── outputs ───────────────────────────────────────────────────────────
    def write(self):
        out = self.out
        (out / "meshes").mkdir(parents=True, exist_ok=True)
        kin_legs = {"bodies": self.body_list, "actuated_joints": [a.get("joint") for a in self.root.iter("position")],
                    "mesh_dir": "./robot/librezoo/meshes"}  # fmt: skip
        rollers, extra = self.roller_bodies()
        kin_rollers = {"bodies": rollers, "actuated_joints": kin_legs["actuated_joints"], "mesh_dir": kin_legs["mesh_dir"]}
        (out / "kinematics.json").write_text(json.dumps(kin_legs, indent=1))
        (out / "kinematics_rollers.json").write_text(json.dumps(kin_rollers, indent=1))
        (out / "robot_allcollisions.xml").write_text(self.physics("legs"))
        (out / "robot_allcollisions_rollers.xml").write_text(self.physics("rollers"))
        glb = {k: v for k, v in self.meshes.items()}
        write_glb(glb, out / "microduck.glb")
        for name, mesh in extra.items():
            mesh.export(str(out / "meshes" / f"{name}.stl"))
        total = sum(len(m.faces) for m in glb.values() if not m is None)
        self.report["glb_faces"] = int(total)
        self.report["notes"].append("REF_POLLEN_* electronics dropped; REF_* parts replaced by bounding-box proxies")
        (out / "model-report.json").write_text(json.dumps(self.report, indent=1))
        print(f"wrote {out} | glb {Path(out / 'microduck.glb').stat().st_size / 1e6:.2f} MB, {total} faces")


def lathe(profile, sections):
    """Revolve (radius, z) profile pairs around z."""
    pts = np.array(profile, float)
    n = len(pts)
    verts, faces = [], []
    for s in range(sections):
        a = 2 * math.pi * s / sections
        for r, z in pts:
            verts.append([r * math.cos(a), r * math.sin(a), z])
    for s in range(sections):
        s2 = (s + 1) % sections
        for i in range(n):
            i2 = (i + 1) % n
            a, b, c, d = s * n + i, s2 * n + i, s2 * n + i2, s * n + i2
            faces += [[a, b, c], [a, c, d]]
    m = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=True)
    m.fix_normals()
    return m


def rounded_roller_plate(x0, x1, thickness):
    """Side plate of the roller skate frame, in the ankle frame (xy), extruded in z."""
    wheel_y = -0.0325
    wheel_poly = capsule_hull((x0, wheel_y), (x1, wheel_y), 0.0072)
    mount = rounded_rect(np.array([x0 + 0.006, -0.026]), np.array([x1 - 0.004, -0.0095]), 0.0035)
    poly = wheel_poly.union(mount).convex_hull
    mesh = trimesh.creation.extrude_polygon(poly, height=thickness)
    return mesh


def write_glb(meshes, path):
    scene = trimesh.Scene()
    for name, mesh in sorted(meshes.items()):
        mesh = mesh.copy()
        mesh.visual = trimesh.visual.ColorVisuals(mesh)
        # three's GLTFLoader strips "." from node names, so the file name travels as extras.
        mesh.metadata = {"meshFile": f"{name}.stl"}
        scene.add_geometry(mesh, node_name=f"{name}.stl", geom_name=f"{name}.stl")
    Path(path).write_bytes(scene.export(file_type="glb"))


def main():
    global PAD_MASS
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--pad-mass", type=float, default=PAD_MASS, help="sole pad mass per foot, kg")
    args = ap.parse_args()
    PAD_MASS = args.pad_mass
    b = Builder(Path(args.src), Path(args.out))
    b.build_bodies()
    b.make_pads()
    b.add_pad_visuals()
    b.write()


if __name__ == "__main__":
    sys.exit(main())
