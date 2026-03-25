import json
import math


EPSILON = 1e-9
ADVANCE_EPSILON = 1e-7


def theta_to_vector(theta_deg):
    radians = math.radians(theta_deg)
    return (math.sin(radians), math.cos(radians))


def vector_to_theta(vector):
    return math.degrees(math.atan2(vector[0], vector[1]))


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def subtract(a, b):
    return (a[0] - b[0], a[1] - b[1])


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def scale(vector, factor):
    return (vector[0] * factor, vector[1] * factor)


def normalize(vector):
    length = math.hypot(vector[0], vector[1])
    if length < EPSILON:
        raise ValueError("Zero-length vector is not valid.")
    return (vector[0] / length, vector[1] / length)


def reflect(direction, normal):
    factor = 2.0 * dot(direction, normal)
    return normalize(subtract(direction, scale(normal, factor)))


def signed_area(vertices):
    area = 0.0
    for index, current in enumerate(vertices):
        nxt = vertices[(index + 1) % len(vertices)]
        area += current[0] * nxt[1] - nxt[0] * current[1]
    return area / 2.0


def point_in_polygon(point, vertices):
    inside = False
    x, y = point
    for index, current in enumerate(vertices):
        nxt = vertices[(index + 1) % len(vertices)]
        x1, y1 = current
        x2, y2 = nxt
        intersects = ((y1 > y) != (y2 > y))
        if intersects:
            x_intersection = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < x_intersection:
                inside = not inside
    return inside


def as_point(pair):
    return (float(pair[0]), float(pair[1]))


def dedupe_vertices(vertices):
    cleaned = []
    for vertex in vertices:
        point = as_point(vertex)
        if not cleaned or math.hypot(point[0] - cleaned[-1][0], point[1] - cleaned[-1][1]) > EPSILON:
            cleaned.append(point)
    if len(cleaned) > 1 and math.hypot(cleaned[0][0] - cleaned[-1][0], cleaned[0][1] - cleaned[-1][1]) <= EPSILON:
        cleaned.pop()
    return cleaned


def unwrap_angle(angle, start_angle):
    while angle - start_angle > 180.0:
        angle -= 360.0
    while angle - start_angle < -180.0:
        angle += 360.0
    return angle


def angle_on_arc(angle, start_angle, end_angle):
    adjusted = unwrap_angle(angle, start_angle)
    delta = end_angle - start_angle
    if delta >= 0:
        return start_angle - 1e-7 <= adjusted <= end_angle + 1e-7
    return end_angle - 1e-7 <= adjusted <= start_angle + 1e-7


def sample_arc_points(current, segment):
    center = as_point(segment["center"])
    radius = float(segment.get("radius", math.hypot(current[0] - center[0], current[1] - center[1])))
    start_angle = float(
        segment.get(
            "start_angle",
            math.degrees(math.atan2(current[1] - center[1], current[0] - center[0])),
        )
    )
    end_angle = float(segment["end_angle"])
    steps = max(2, int(segment.get("segments", 32)))
    points = []
    for index in range(1, steps + 1):
        t = index / steps
        angle = math.radians(start_angle + (end_angle - start_angle) * t)
        points.append(
            (
                center[0] + radius * math.cos(angle),
                center[1] + radius * math.sin(angle),
            )
        )
    return points


def sample_parabola_points(current, segment):
    control = as_point(segment["control"])
    end = as_point(segment["to"])
    steps = max(2, int(segment.get("segments", 32)))
    points = []
    for index in range(1, steps + 1):
        t = index / steps
        omt = 1.0 - t
        x = omt * omt * current[0] + 2.0 * omt * t * control[0] + t * t * end[0]
        y = omt * omt * current[1] + 2.0 * omt * t * control[1] + t * t * end[1]
        points.append((x, y))
    return points


def sample_polynomial_points(current, segment):
    end = as_point(segment["to"])
    coefficients = [float(value) for value in segment.get("coefficients", [])]
    steps = max(2, int(segment.get("segments", 48)))
    points = []
    for index in range(1, steps + 1):
        t = index / steps
        base_x = current[0] + (end[0] - current[0]) * t
        base_y = current[1] + (end[1] - current[1]) * t
        offset = 0.0
        for power, coefficient in enumerate(coefficients):
            offset += coefficient * (t ** (power + 1)) * (1.0 - t)
        points.append((base_x, base_y + offset))
    return points


def build_line_entity(start, end, orientation):
    edge = subtract(end, start)
    normal = (-edge[1], edge[0]) if orientation > 0 else (edge[1], -edge[0])
    return {
        "type": "line",
        "start": start,
        "end": end,
        "edge": edge,
        "normal": normalize(normal),
    }


def build_line_entities(vertices, orientation):
    entities = []
    for index, start in enumerate(vertices):
        end = vertices[(index + 1) % len(vertices)]
        entities.append(build_line_entity(start, end, orientation))
    return entities


def build_trace_boundary(shape):
    current = as_point(shape["start"])
    vertices = [current]
    entities = []
    for segment in shape["segments"]:
        kind = segment["type"]
        if kind == "line":
            end = as_point(segment["to"])
            vertices.append(end)
            current = end
            continue
        if kind == "arc":
            center = as_point(segment["center"])
            radius = float(segment.get("radius", math.hypot(current[0] - center[0], current[1] - center[1])))
            start_angle = float(
                segment.get(
                    "start_angle",
                    math.degrees(math.atan2(current[1] - center[1], current[0] - center[0])),
                )
            )
            end_angle = float(segment["end_angle"])
            entities.append(
                {
                    "type": "arc",
                    "center": center,
                    "radius": radius,
                    "start_angle": start_angle,
                    "end_angle": end_angle,
                    "ccw": end_angle >= start_angle,
                }
            )
            points = sample_arc_points(current, segment)
        elif kind == "parabola":
            points = sample_parabola_points(current, segment)
        elif kind == "polynomial":
            points = sample_polynomial_points(current, segment)
        else:
            raise ValueError("Unsupported trace segment type: {0}".format(kind))
        vertices.extend(points)
        current = vertices[-1]

    if shape.get("closed", True):
        vertices.append(vertices[0])
    vertices = dedupe_vertices(vertices)
    orientation = signed_area(vertices)
    if abs(orientation) < EPSILON:
        raise ValueError("Polygon area is zero. Check the chamber vertices.")

    if not entities:
        return {
            "vertices": vertices,
            "entities": build_line_entities(vertices, orientation),
            "orientation": orientation,
        }

    exact_entities = []
    cursor = vertices[0]
    trace_index = 1
    for segment in shape["segments"]:
        kind = segment["type"]
        if kind == "line":
            end = as_point(segment["to"])
            exact_entities.append(build_line_entity(cursor, end, orientation))
            cursor = end
        elif kind == "arc":
            center = as_point(segment["center"])
            radius = float(segment.get("radius", math.hypot(cursor[0] - center[0], cursor[1] - center[1])))
            start_angle = float(
                segment.get(
                    "start_angle",
                    math.degrees(math.atan2(cursor[1] - center[1], cursor[0] - center[0])),
                )
            )
            end_angle = float(segment["end_angle"])
            exact_entities.append(
                {
                    "type": "arc",
                    "center": center,
                    "radius": radius,
                    "start_angle": start_angle,
                    "end_angle": end_angle,
                    "ccw": end_angle >= start_angle,
                }
            )
            cursor = sample_arc_points(cursor, segment)[-1]
        else:
            if kind == "parabola":
                points = sample_parabola_points(cursor, segment)
            else:
                points = sample_polynomial_points(cursor, segment)
            local_vertices = [cursor] + points
            for index in range(len(local_vertices) - 1):
                exact_entities.append(
                    build_line_entity(local_vertices[index], local_vertices[index + 1], orientation)
                )
            cursor = points[-1]

    if shape.get("closed", True) and math.hypot(cursor[0] - vertices[0][0], cursor[1] - vertices[0][1]) > EPSILON:
        exact_entities.append(build_line_entity(cursor, vertices[0], orientation))

    return {
        "vertices": vertices,
        "entities": exact_entities,
        "orientation": orientation,
    }


def approximate_chaos_shape(width, radius, segments=48):
    return {
        "start": [-width / 2.0, -radius],
        "closed": True,
        "segments": [
            {"type": "line", "to": [width / 2.0, -radius]},
            {
                "type": "arc",
                "center": [width / 2.0, 0.0],
                "radius": radius,
                "end_angle": 90.0,
                "segments": segments,
            },
            {"type": "line", "to": [-width / 2.0, radius]},
            {
                "type": "arc",
                "center": [-width / 2.0, 0.0],
                "radius": radius,
                "end_angle": 270.0,
                "segments": segments,
            },
        ],
    }


def build_boundary(mode, dim=None, shape_file=None):
    if mode == "rectangular":
        width, half_height = dim
        vertices = [
            (-width / 2.0, -half_height),
            (width / 2.0, -half_height),
            (width / 2.0, half_height),
            (-width / 2.0, half_height),
        ]
        orientation = signed_area(vertices)
        return {
            "vertices": vertices,
            "entities": build_line_entities(vertices, orientation),
            "orientation": orientation,
        }
    if mode == "chaos":
        return build_trace_boundary(approximate_chaos_shape(dim[0], dim[1]))
    if mode == "polygon":
        if not shape_file:
            raise ValueError("Polygon mode requires a shape file.")
        with open(shape_file, "r") as handle:
            shape = json.load(handle)
        if isinstance(shape, list):
            vertices = dedupe_vertices(shape)
            orientation = signed_area(vertices)
            return {
                "vertices": vertices,
                "entities": build_line_entities(vertices, orientation),
                "orientation": orientation,
            }
        if isinstance(shape, dict) and "vertices" in shape:
            vertices = dedupe_vertices(shape["vertices"])
            orientation = signed_area(vertices)
            return {
                "vertices": vertices,
                "entities": build_line_entities(vertices, orientation),
                "orientation": orientation,
            }
        if isinstance(shape, dict) and "segments" in shape:
            return build_trace_boundary(shape)
        raise ValueError("Unsupported shape file structure.")
    raise ValueError("Unsupported mode: {0}".format(mode))


class Reverb(object):
    """Simulate 2D specular reflections inside a closed 2D boundary."""

    def __init__(self, p0, theta0, dim=None, mode="chaos", shape_file=None):
        self.no = 0
        self.mode = mode
        self.dim = dim
        self.shape_file = shape_file
        boundary = build_boundary(mode, dim=dim, shape_file=shape_file)
        self.vertices = boundary["vertices"]
        self.entities = boundary["entities"]
        self.orientation = boundary["orientation"]
        if len(self.vertices) < 3:
            raise ValueError("A chamber requires at least three vertices.")

        self.p = (float(p0[0]), float(p0[1]))
        if not point_in_polygon(self.p, self.vertices):
            raise ValueError("Initial position must lie inside the chamber.")
        self.direction = normalize(theta_to_vector(theta0))
        self.theta = vector_to_theta(self.direction)

    def _ray_line_intersection(self, entity):
        denominator = cross(self.direction, entity["edge"])
        if abs(denominator) < EPSILON:
            return None
        offset = subtract(entity["start"], self.p)
        distance = cross(offset, entity["edge"]) / denominator
        portion = cross(offset, self.direction) / denominator
        if distance <= ADVANCE_EPSILON:
            return None
        if portion < -ADVANCE_EPSILON or portion > 1.0 + ADVANCE_EPSILON:
            return None
        return {
            "distance": distance,
            "point": add(self.p, scale(self.direction, distance)),
            "normal": entity["normal"],
        }

    def _ray_arc_intersection(self, entity):
        offset = subtract(self.p, entity["center"])
        b = 2.0 * dot(self.direction, offset)
        c = dot(offset, offset) - entity["radius"] ** 2
        delta = b * b - 4.0 * c
        if delta < 0:
            return None
        root = math.sqrt(max(delta, 0.0))
        candidates = [(-b - root) / 2.0, (-b + root) / 2.0]
        best = None
        for distance in candidates:
            if distance <= ADVANCE_EPSILON:
                continue
            point = add(self.p, scale(self.direction, distance))
            angle = math.degrees(math.atan2(point[1] - entity["center"][1], point[0] - entity["center"][0]))
            if not angle_on_arc(angle, entity["start_angle"], entity["end_angle"]):
                continue
            radial = normalize(subtract(point, entity["center"]))
            normal = scale(radial, -1.0 if entity["ccw"] else 1.0)
            candidate = {"distance": distance, "point": point, "normal": normal}
            if best is None or distance < best["distance"]:
                best = candidate
        return best

    def _next_collision(self):
        collision = None
        for entity in self.entities:
            if entity["type"] == "line":
                candidate = self._ray_line_intersection(entity)
            else:
                candidate = self._ray_arc_intersection(entity)
            if candidate is None:
                continue
            if collision is None or candidate["distance"] < collision["distance"]:
                collision = candidate
        if collision is None:
            raise RuntimeError("Unable to find the next boundary collision.")
        return collision

    def step(self):
        collision = self._next_collision()
        self.p = collision["point"]
        self.direction = reflect(self.direction, collision["normal"])
        self.theta = vector_to_theta(self.direction)
        self.p = add(self.p, scale(collision["normal"], ADVANCE_EPSILON))
        return self.p, self.theta

    def bounce(self, times, display=True, log=True, filename="outcome"):
        self.no = 0
        handle = None
        if log:
            handle = open(filename + ".txt", "w")
            handle.write("## type:" + self.mode + "\n")
            handle.write("## vertices:" + json.dumps(self.vertices) + "\n")

        try:
            while self.no < times:
                if display:
                    self.print_info()
                if handle is not None:
                    handle.write("{0}\t{1}\t{2}\n".format(self.p[0], self.p[1], self.theta))
                self.step()
                yield self.p, self.theta
                self.no += 1
        finally:
            if handle is not None:
                handle.close()

    def print_info(self):
        print("\n")
        print("== Bouncing no: {0}".format(self.no))
        print("At position: {0}".format(self.p))
        print("Heading direction: {0}".format(self.theta))

    def walkto(self, point, theta):
        self.p = point
        self.direction = normalize(theta_to_vector(theta))
        self.theta = vector_to_theta(self.direction)
