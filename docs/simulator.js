(() => {
  "use strict";

  const canvas = document.getElementById("sim-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const canvasWrap = document.getElementById("sim-canvas-wrap");
  const playButton = document.getElementById("sim-play");
  const resetButton = document.getElementById("sim-reset");
  const captureButton = document.getElementById("sim-capture");
  const clearButton = document.getElementById("sim-clear");
  const removeButton = document.getElementById("sim-remove");
  const speedSelect = document.getElementById("sim-speed");
  const timeDisplay = document.getElementById("sim-time");
  const statusDisplay = document.getElementById("sim-status");
  const countDisplay = document.getElementById("sim-count");
  const emptyState = document.getElementById("sim-empty");
  const canvasMessage = document.getElementById("sim-canvas-message");
  const selectionName = document.getElementById("sim-selection-name");
  const inspectorFields = document.getElementById("sim-inspector-fields");
  const announcement = document.getElementById("sim-announcement");
  const pieceButtons = [...document.querySelectorAll(".sim-component[data-piece-type]")];

  const TAU = Math.PI * 2;
  const PX_PER_METER = 72;
  const COLORS = {
    ink: "#252b30",
    muted: "#747e85",
    faint: "#b8bec2",
    grid: "#f0f2f3",
    yellow: "#ffca36",
    yellowDark: "#aa7600",
    blue: "#2f78d0",
    white: "#ffffff",
    platform: "#5c666e",
    body: "#343c43",
    beam: "#59636b",
    selection: "rgba(216, 155, 0, 0.38)"
  };

  const world = {
    gravity: 9.81,
    airDrag: 0.025
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let bodies = [];
  let constraints = [];
  let selected = null;
  let nextId = 1;
  let running = false;
  let speed = 1;
  let simTime = 0;
  let lastFrame = performance.now();
  let pointerDrag = null;
  let snapTarget = null;
  let initialScene = null;
  let activeFieldSpecs = new Map();
  let messageTimer = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const radians = degrees => degrees * Math.PI / 180;
  const degrees = value => value * 180 / Math.PI;
  const vector = (x = 0, y = 0) => ({ x, y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const scale = (value, amount) => ({ x: value.x * amount, y: value.y * amount });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const magnitude = value => Math.hypot(value.x, value.y);
  const normalize = value => {
    const length = magnitude(value);
    return length > 1e-9 ? scale(value, 1 / length) : vector(1, 0);
  };
  const rotate = (value, angle) => ({
    x: value.x * Math.cos(angle) - value.y * Math.sin(angle),
    y: value.x * Math.sin(angle) + value.y * Math.cos(angle)
  });
  const angularVelocityAt = (omega, offset) => ({ x: -omega * offset.y, y: omega * offset.x });
  const distance = (a, b) => magnitude(subtract(a, b));

  function announce(message) {
    announcement.textContent = "";
    requestAnimationFrame(() => { announcement.textContent = message; });
  }

  function showCanvasMessage(message, duration = 2600) {
    if (messageTimer) clearTimeout(messageTimer);
    canvasMessage.textContent = message;
    canvasMessage.hidden = false;
    if (duration > 0) {
      messageTimer = setTimeout(() => {
        canvasMessage.hidden = true;
        messageTimer = null;
      }, duration);
    }
  }

  function getCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function getBody(id) {
    return bodies.find(body => body.id === id) || null;
  }

  function getConstraint(id) {
    return constraints.find(constraint => constraint.id === id) || null;
  }

  function selectedItem() {
    if (!selected) return null;
    return selected.kind === "body" ? getBody(selected.id) : getConstraint(selected.id);
  }

  function setMassProperties(body) {
    if (!body.dynamic) {
      body.invMass = 0;
      body.inertia = Infinity;
      body.invInertia = 0;
      return;
    }

    body.mass = Math.max(0.1, body.mass);
    body.invMass = 1 / body.mass;
    body.inertia = body.shape === "circle"
      ? 0.5 * body.mass * body.radius * body.radius
      : body.mass * (body.width * body.width + body.height * body.height) / 12;
    body.invInertia = 1 / body.inertia;
  }

  function makeBody(type, x, y) {
    const common = {
      id: nextId++,
      kind: "body",
      type,
      x,
      y,
      angle: 0,
      vx: 0,
      vy: 0,
      omega: 0,
      fx: 0,
      fy: 0,
      torque: 0,
      dragged: false,
      restitution: 0.42,
      friction: 0.5,
      mass: 1,
      dynamic: true,
      sensor: false
    };

    let body;
    if (type === "ball") {
      body = { ...common, label: "Ball", shape: "circle", radius: 25, restitution: 0.72, friction: 0.28 };
    } else if (type === "beam") {
      body = { ...common, label: "Beam", shape: "box", width: 156, height: 18, mass: 2.2, restitution: 0.25, friction: 0.62 };
    } else if (type === "platform") {
      body = {
        ...common, label: "Fixed platform", shape: "box", width: 190, height: 18,
        dynamic: false, mass: Infinity, restitution: 0.25, friction: 0.78
      };
    } else if (type === "anchor") {
      body = {
        ...common, label: "Fixed anchor", shape: "circle", radius: 9,
        dynamic: false, sensor: true, mass: Infinity, restitution: 0, friction: 0
      };
    } else {
      body = { ...common, label: "Block", shape: "box", width: 72, height: 58, mass: 1.4, restitution: 0.38, friction: 0.58 };
    }

    setMassProperties(body);
    return body;
  }

  function makeEndpoint(x, y) {
    return { bodyId: null, x, y, localX: 0, localY: 0 };
  }

  function makeConstraint(type, x, y) {
    const span = type === "spring" ? 150 : 140;
    return {
      id: nextId++,
      kind: "constraint",
      type,
      label: type === "spring" ? "Spring" : "Rigid link",
      a: makeEndpoint(x - span / 2, y),
      b: makeEndpoint(x + span / 2, y),
      restLength: span,
      stiffness: 18,
      damping: 0.7
    };
  }

  function bodyRadius(body) {
    if (body.shape === "circle") return body.radius;
    return Math.hypot(body.width / 2, body.height / 2);
  }

  function keepBodyInBounds(body) {
    const radius = bodyRadius(body);
    body.x = clamp(body.x, Math.min(radius + 4, width / 2), Math.max(width - radius - 4, width / 2));
    body.y = clamp(body.y, Math.min(radius + 4, height / 2), Math.max(height - radius - 4, height / 2));
  }

  function suggestedPosition(type) {
    const count = bodies.filter(body => body.type === type).length + constraints.filter(item => item.type === type).length;
    if (type === "platform") return { x: width * 0.5, y: height * (0.72 - (count % 3) * 0.12) };
    if (type === "anchor") return { x: width * (0.35 + (count % 3) * 0.15), y: 92 + (count % 2) * 50 };
    if (type === "spring" || type === "link") return { x: width * 0.5, y: height * (0.35 + (count % 3) * 0.16) };
    return { x: width * (0.42 + (count % 3) * 0.12), y: 150 + (count % 4) * 64 };
  }

  function updateSceneMeta() {
    const pieceWord = bodies.length === 1 ? "piece" : "pieces";
    const connectionWord = constraints.length === 1 ? "connection" : "connections";
    countDisplay.textContent = `${bodies.length} ${pieceWord} · ${constraints.length} ${connectionWord}`;
    emptyState.hidden = bodies.length + constraints.length > 0;
  }

  function serializeScene() {
    return JSON.stringify({
      world: { gravity: world.gravity, airDrag: world.airDrag },
      bodies: bodies.map(body => ({ ...body, fx: 0, fy: 0, torque: 0, dragged: false })),
      constraints
    });
  }

  function captureInitial(shouldAnnounce = false) {
    initialScene = serializeScene();
    simTime = 0;
    updateTime();
    if (shouldAnnounce) announce("Current scene saved as the initial state.");
  }

  function commitInitialIfPaused() {
    if (!running) captureInitial(false);
  }

  function restoreInitial() {
    if (!initialScene) return;
    const scene = JSON.parse(initialScene);
    bodies = scene.bodies;
    constraints = scene.constraints;
    world.gravity = scene.world.gravity;
    world.airDrag = scene.world.airDrag;
    bodies.forEach(body => {
      body.fx = 0;
      body.fy = 0;
      body.torque = 0;
      body.dragged = false;
      setMassProperties(body);
      keepBodyInBounds(body);
    });
    nextId = Math.max(0, ...bodies.map(body => body.id), ...constraints.map(item => item.id)) + 1;
    if (selected && !selectedItem()) selected = null;
  }

  function addPiece(type, x, y, shouldAnnounce = true) {
    const position = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : suggestedPosition(type);
    let item;
    if (type === "spring" || type === "link") {
      item = makeConstraint(type, position.x, position.y);
      constraints.push(item);
      selected = { kind: "constraint", id: item.id };
      showCanvasMessage("Drag each yellow endpoint onto a body or fixed anchor.");
    } else {
      item = makeBody(type, position.x, position.y);
      keepBodyInBounds(item);
      bodies.push(item);
      selected = { kind: "body", id: item.id };
    }

    updateSceneMeta();
    renderInspector();
    commitInitialIfPaused();
    draw();
    if (shouldAnnounce) announce(`${item.label} added and selected.`);
    return item;
  }

  function detachEndpoint(endpoint) {
    const point = endpointWorldPoint(endpoint);
    endpoint.bodyId = null;
    endpoint.x = point.x;
    endpoint.y = point.y;
    endpoint.localX = 0;
    endpoint.localY = 0;
  }

  function removeSelected() {
    const item = selectedItem();
    if (!item) return;

    if (selected.kind === "constraint") {
      constraints = constraints.filter(constraint => constraint.id !== item.id);
    } else {
      constraints.forEach(constraint => {
        if (constraint.a.bodyId === item.id) detachEndpoint(constraint.a);
        if (constraint.b.bodyId === item.id) detachEndpoint(constraint.b);
      });
      bodies = bodies.filter(body => body.id !== item.id);
    }

    selected = null;
    updateSceneMeta();
    renderInspector();
    commitInitialIfPaused();
    draw();
    announce(`${item.label} removed.`);
  }

  function clearAll() {
    bodies = [];
    constraints = [];
    selected = null;
    nextId = 1;
    simTime = 0;
    setRunning(false);
    updateSceneMeta();
    renderInspector();
    captureInitial(false);
    updateTime();
    draw();
    announce("Canvas cleared.");
  }

  function resetAll() {
    setRunning(false);
    restoreInitial();
    simTime = 0;
    updateSceneMeta();
    renderInspector();
    updateTime();
    draw();
    announce("Scene reset to its saved initial state.");
  }

  function setRunning(value) {
    running = Boolean(value) && bodies.length + constraints.length > 0;
    playButton.setAttribute("aria-pressed", String(running));
    playButton.querySelector(".sim-button__icon").textContent = running ? "Ⅱ" : "▶";
    playButton.querySelector(".sim-button__label").textContent = running ? "Pause" : "Start";
    statusDisplay.classList.toggle("is-running", running);
    statusDisplay.lastChild.textContent = running ? " Running" : " Paused";
    lastFrame = performance.now();
    if (!running) syncInspectorValues();
  }

  function toggleRunning() {
    if (!bodies.length && !constraints.length) {
      announce("Add at least one piece before starting the simulation.");
      return;
    }
    if (!running && simTime === 0) captureInitial(false);
    setRunning(!running);
    announce(running ? "Simulation running." : "Simulation paused.");
  }

  function endpointWorldPoint(endpoint) {
    const body = getBody(endpoint.bodyId);
    if (!body) return { x: endpoint.x, y: endpoint.y };
    return add({ x: body.x, y: body.y }, rotate({ x: endpoint.localX, y: endpoint.localY }, body.angle));
  }

  function endpointVelocity(endpoint) {
    const body = getBody(endpoint.bodyId);
    if (!body) return vector();
    const offset = rotate({ x: endpoint.localX, y: endpoint.localY }, body.angle);
    return add({ x: body.vx, y: body.vy }, angularVelocityAt(body.omega, offset));
  }

  function velocityAt(body, point) {
    if (!body) return vector();
    return add({ x: body.vx, y: body.vy }, angularVelocityAt(body.omega, subtract(point, body)));
  }

  function effectiveInvMass(body) {
    return body && body.dynamic && !body.dragged ? body.invMass : 0;
  }

  function effectiveInvInertia(body) {
    return body && body.dynamic && !body.dragged ? body.invInertia : 0;
  }

  function applyForceAt(body, force, point) {
    if (!body || !body.dynamic || body.dragged) return;
    body.fx += force.x;
    body.fy += force.y;
    body.torque += cross(subtract(point, body), force);
  }

  function applyImpulseAt(body, impulse, point) {
    if (!body || !body.dynamic || body.dragged) return;
    body.vx += impulse.x * body.invMass;
    body.vy += impulse.y * body.invMass;
    body.omega += cross(subtract(point, body), impulse) * body.invInertia;
  }

  function applySpringForces(constraint) {
    const aPoint = endpointWorldPoint(constraint.a);
    const bPoint = endpointWorldPoint(constraint.b);
    const delta = subtract(bPoint, aPoint);
    const length = magnitude(delta);
    if (length < 1e-6) return;

    const direction = scale(delta, 1 / length);
    const relativeVelocity = subtract(endpointVelocity(constraint.b), endpointVelocity(constraint.a));
    const extensionMeters = (length - constraint.restLength) / PX_PER_METER;
    const speedMeters = dot(relativeVelocity, direction) / PX_PER_METER;
    const forceNewtons = constraint.stiffness * extensionMeters + constraint.damping * speedMeters;
    const forcePixels = scale(direction, forceNewtons * PX_PER_METER);

    applyForceAt(getBody(constraint.a.bodyId), forcePixels, aPoint);
    applyForceAt(getBody(constraint.b.bodyId), scale(forcePixels, -1), bPoint);
  }

  function solveLink(constraint, dt) {
    const aPoint = endpointWorldPoint(constraint.a);
    const bPoint = endpointWorldPoint(constraint.b);
    const delta = subtract(bPoint, aPoint);
    const length = magnitude(delta);
    if (length < 1e-6) return;

    const normal = scale(delta, 1 / length);
    const bodyA = getBody(constraint.a.bodyId);
    const bodyB = getBody(constraint.b.bodyId);
    const invMassA = effectiveInvMass(bodyA);
    const invMassB = effectiveInvMass(bodyB);
    const invInertiaA = effectiveInvInertia(bodyA);
    const invInertiaB = effectiveInvInertia(bodyB);
    const offsetA = bodyA ? subtract(aPoint, bodyA) : vector();
    const offsetB = bodyB ? subtract(bPoint, bodyB) : vector();
    const effectiveMass = invMassA + invMassB
      + cross(offsetA, normal) ** 2 * invInertiaA
      + cross(offsetB, normal) ** 2 * invInertiaB;
    if (effectiveMass < 1e-9) return;

    const relativeVelocity = subtract(endpointVelocity(constraint.b), endpointVelocity(constraint.a));
    const error = length - constraint.restLength;
    const bias = 0.12 * error / Math.max(dt, 1 / 1000);
    const impulseAmount = -(dot(relativeVelocity, normal) + bias) / effectiveMass;
    const impulse = scale(normal, impulseAmount);
    applyImpulseAt(bodyA, scale(impulse, -1), aPoint);
    applyImpulseAt(bodyB, impulse, bPoint);

    const totalInvMass = invMassA + invMassB;
    if (totalInvMass > 0) {
      const correction = scale(normal, error * 0.16 / totalInvMass);
      if (invMassA) {
        bodyA.x += correction.x * invMassA;
        bodyA.y += correction.y * invMassA;
      }
      if (invMassB) {
        bodyB.x -= correction.x * invMassB;
        bodyB.y -= correction.y * invMassB;
      }
    }
  }

  function boxVertices(body) {
    const halfWidth = body.width / 2;
    const halfHeight = body.height / 2;
    return [
      vector(-halfWidth, -halfHeight), vector(halfWidth, -halfHeight),
      vector(halfWidth, halfHeight), vector(-halfWidth, halfHeight)
    ].map(point => add(body, rotate(point, body.angle)));
  }

  function boxAxes(body) {
    return [rotate(vector(1, 0), body.angle), rotate(vector(0, 1), body.angle)];
  }

  function projectPoints(points, axis) {
    let min = Infinity;
    let max = -Infinity;
    points.forEach(point => {
      const projection = dot(point, axis);
      min = Math.min(min, projection);
      max = Math.max(max, projection);
    });
    return { min, max };
  }

  function supportPoint(points, direction) {
    return points.reduce((best, point) => dot(point, direction) > dot(best, direction) ? point : best, points[0]);
  }

  function collideCircleCircle(a, b) {
    const delta = subtract(b, a);
    const centerDistance = magnitude(delta);
    const radiusSum = a.radius + b.radius;
    if (centerDistance >= radiusSum) return null;
    const normal = centerDistance > 1e-6 ? scale(delta, 1 / centerDistance) : vector(1, 0);
    return {
      normal,
      penetration: radiusSum - centerDistance,
      contact: add(a, scale(normal, a.radius - (radiusSum - centerDistance) / 2))
    };
  }

  function collideCircleBox(circle, box) {
    const localCenter = rotate(subtract(circle, box), -box.angle);
    const halfWidth = box.width / 2;
    const halfHeight = box.height / 2;
    const closest = {
      x: clamp(localCenter.x, -halfWidth, halfWidth),
      y: clamp(localCenter.y, -halfHeight, halfHeight)
    };
    const delta = subtract(localCenter, closest);
    const distanceSquared = dot(delta, delta);
    let normalLocal;
    let penetration;
    let contactLocal = closest;

    if (distanceSquared > 1e-9) {
      const centerDistance = Math.sqrt(distanceSquared);
      if (centerDistance >= circle.radius) return null;
      normalLocal = scale(delta, -1 / centerDistance);
      penetration = circle.radius - centerDistance;
    } else {
      const distanceX = halfWidth - Math.abs(localCenter.x);
      const distanceY = halfHeight - Math.abs(localCenter.y);
      if (distanceX < distanceY) {
        const exit = vector(Math.sign(localCenter.x) || 1, 0);
        normalLocal = scale(exit, -1);
        penetration = circle.radius + distanceX;
        contactLocal = vector(exit.x * halfWidth, localCenter.y);
      } else {
        const exit = vector(0, Math.sign(localCenter.y) || 1);
        normalLocal = scale(exit, -1);
        penetration = circle.radius + distanceY;
        contactLocal = vector(localCenter.x, exit.y * halfHeight);
      }
    }

    return {
      normal: rotate(normalLocal, box.angle),
      penetration,
      contact: add(box, rotate(contactLocal, box.angle))
    };
  }

  function collideBoxBox(a, b) {
    const verticesA = boxVertices(a);
    const verticesB = boxVertices(b);
    const axes = [...boxAxes(a), ...boxAxes(b)];
    let smallestOverlap = Infinity;
    let smallestAxis = null;

    for (const axis of axes) {
      const projectionA = projectPoints(verticesA, axis);
      const projectionB = projectPoints(verticesB, axis);
      const overlap = Math.min(projectionA.max, projectionB.max) - Math.max(projectionA.min, projectionB.min);
      if (overlap <= 0) return null;
      if (overlap < smallestOverlap) {
        smallestOverlap = overlap;
        smallestAxis = axis;
      }
    }

    const normal = dot(subtract(b, a), smallestAxis) < 0 ? scale(smallestAxis, -1) : smallestAxis;
    const pointA = supportPoint(verticesA, normal);
    const pointB = supportPoint(verticesB, scale(normal, -1));
    return {
      normal,
      penetration: smallestOverlap,
      contact: scale(add(pointA, pointB), 0.5)
    };
  }

  function detectCollision(a, b) {
    if (a.sensor || b.sensor) return null;
    if (a.shape === "circle" && b.shape === "circle") return collideCircleCircle(a, b);
    if (a.shape === "circle" && b.shape === "box") return collideCircleBox(a, b);
    if (a.shape === "box" && b.shape === "circle") {
      const collision = collideCircleBox(b, a);
      if (!collision) return null;
      collision.normal = scale(collision.normal, -1);
      return collision;
    }
    return collideBoxBox(a, b);
  }

  function resolveCollision(a, b, collision) {
    const invMassA = effectiveInvMass(a);
    const invMassB = effectiveInvMass(b);
    const totalInvMass = invMassA + invMassB;
    if (totalInvMass <= 0) return;

    const correctionMagnitude = Math.max(collision.penetration - 0.25, 0) * 0.72 / totalInvMass;
    const correction = scale(collision.normal, correctionMagnitude);
    if (invMassA) {
      a.x -= correction.x * invMassA;
      a.y -= correction.y * invMassA;
    }
    if (invMassB) {
      b.x += correction.x * invMassB;
      b.y += correction.y * invMassB;
    }

    const offsetA = subtract(collision.contact, a);
    const offsetB = subtract(collision.contact, b);
    let relativeVelocity = subtract(velocityAt(b, collision.contact), velocityAt(a, collision.contact));
    const normalSpeed = dot(relativeVelocity, collision.normal);
    if (normalSpeed > 0) return;

    const denominator = invMassA + invMassB
      + cross(offsetA, collision.normal) ** 2 * effectiveInvInertia(a)
      + cross(offsetB, collision.normal) ** 2 * effectiveInvInertia(b);
    if (denominator <= 1e-9) return;

    const restitution = Math.abs(normalSpeed) < 45 ? 0 : Math.min(a.restitution, b.restitution);
    const impulseAmount = -(1 + restitution) * normalSpeed / denominator;
    const normalImpulse = scale(collision.normal, impulseAmount);
    applyImpulseAt(a, scale(normalImpulse, -1), collision.contact);
    applyImpulseAt(b, normalImpulse, collision.contact);

    relativeVelocity = subtract(velocityAt(b, collision.contact), velocityAt(a, collision.contact));
    const tangentRaw = subtract(relativeVelocity, scale(collision.normal, dot(relativeVelocity, collision.normal)));
    if (magnitude(tangentRaw) < 1e-8) return;
    const tangent = normalize(tangentRaw);
    const tangentDenominator = invMassA + invMassB
      + cross(offsetA, tangent) ** 2 * effectiveInvInertia(a)
      + cross(offsetB, tangent) ** 2 * effectiveInvInertia(b);
    if (tangentDenominator <= 1e-9) return;

    let frictionImpulseAmount = -dot(relativeVelocity, tangent) / tangentDenominator;
    const friction = Math.sqrt(a.friction * b.friction);
    frictionImpulseAmount = clamp(frictionImpulseAmount, -impulseAmount * friction, impulseAmount * friction);
    const frictionImpulse = scale(tangent, frictionImpulseAmount);
    applyImpulseAt(a, scale(frictionImpulse, -1), collision.contact);
    applyImpulseAt(b, frictionImpulse, collision.contact);
  }

  function resolveWall(body, normal, penetration, contact) {
    if (!body.dynamic || body.dragged || penetration <= 0) return;
    body.x += normal.x * penetration;
    body.y += normal.y * penetration;

    const offset = subtract(contact, body);
    const pointVelocity = velocityAt(body, contact);
    const normalSpeed = dot(pointVelocity, normal);
    if (normalSpeed >= 0) return;
    const denominator = body.invMass + cross(offset, normal) ** 2 * body.invInertia;
    const restitution = Math.abs(normalSpeed) < 45 ? 0 : body.restitution;
    const impulseAmount = -(1 + restitution) * normalSpeed / denominator;
    const impulse = scale(normal, impulseAmount);
    applyImpulseAt(body, impulse, contact);

    const updatedVelocity = velocityAt(body, contact);
    const tangentRaw = subtract(updatedVelocity, scale(normal, dot(updatedVelocity, normal)));
    if (magnitude(tangentRaw) < 1e-8) return;
    const tangent = normalize(tangentRaw);
    const tangentDenominator = body.invMass + cross(offset, tangent) ** 2 * body.invInertia;
    let tangentImpulse = -dot(updatedVelocity, tangent) / tangentDenominator;
    tangentImpulse = clamp(tangentImpulse, -impulseAmount * body.friction, impulseAmount * body.friction);
    applyImpulseAt(body, scale(tangent, tangentImpulse), contact);
  }

  function solveCanvasBounds(body) {
    if (!body.dynamic || body.dragged) return;
    if (body.shape === "circle") {
      if (body.x - body.radius < 1) resolveWall(body, vector(1, 0), 1 - (body.x - body.radius), vector(1, body.y));
      if (body.x + body.radius > width - 1) resolveWall(body, vector(-1, 0), body.x + body.radius - (width - 1), vector(width - 1, body.y));
      if (body.y - body.radius < 1) resolveWall(body, vector(0, 1), 1 - (body.y - body.radius), vector(body.x, 1));
      if (body.y + body.radius > height - 1) resolveWall(body, vector(0, -1), body.y + body.radius - (height - 1), vector(body.x, height - 1));
      return;
    }

    const vertices = boxVertices(body);
    const left = vertices.reduce((best, point) => point.x < best.x ? point : best, vertices[0]);
    const right = vertices.reduce((best, point) => point.x > best.x ? point : best, vertices[0]);
    const top = vertices.reduce((best, point) => point.y < best.y ? point : best, vertices[0]);
    const bottom = vertices.reduce((best, point) => point.y > best.y ? point : best, vertices[0]);
    if (left.x < 1) resolveWall(body, vector(1, 0), 1 - left.x, left);
    if (right.x > width - 1) resolveWall(body, vector(-1, 0), right.x - (width - 1), right);
    if (top.y < 1) resolveWall(body, vector(0, 1), 1 - top.y, top);
    if (bottom.y > height - 1) resolveWall(body, vector(0, -1), bottom.y - (height - 1), bottom);
  }

  function physicsStep(dt) {
    bodies.forEach(body => {
      body.fx = 0;
      body.fy = body.dynamic ? body.mass * world.gravity * PX_PER_METER : 0;
      body.torque = 0;
    });
    constraints.filter(item => item.type === "spring").forEach(applySpringForces);

    bodies.forEach(body => {
      if (!body.dynamic || body.dragged) return;
      body.vx += body.fx * body.invMass * dt;
      body.vy += body.fy * body.invMass * dt;
      body.omega += body.torque * body.invInertia * dt;
      const damping = Math.exp(-world.airDrag * dt);
      body.vx *= damping;
      body.vy *= damping;
      body.omega *= damping;
      body.vx = clamp(body.vx, -2600, 2600);
      body.vy = clamp(body.vy, -2600, 2600);
      body.omega = clamp(body.omega, -45, 45);
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.angle += body.omega * dt;
    });

    for (let iteration = 0; iteration < 3; iteration++) {
      constraints.filter(item => item.type === "link").forEach(item => solveLink(item, dt));
    }

    for (let first = 0; first < bodies.length; first++) {
      for (let second = first + 1; second < bodies.length; second++) {
        const a = bodies[first];
        const b = bodies[second];
        if ((!a.dynamic && !b.dynamic) || a.dragged || b.dragged) continue;
        const collision = detectCollision(a, b);
        if (collision) resolveCollision(a, b, collision);
      }
    }
    bodies.forEach(solveCanvasBounds);
  }

  function advance(elapsed) {
    const steps = Math.max(1, Math.ceil(elapsed / (1 / 240)));
    const dt = elapsed / steps;
    for (let step = 0; step < steps; step++) physicsStep(dt);
    simTime += elapsed;
  }

  function updateTime() {
    timeDisplay.textContent = `${simTime.toFixed(2)} s`;
  }

  function roundedRect(context, x, y, rectangleWidth, rectangleHeight, radius) {
    const corner = Math.min(radius, rectangleWidth / 2, rectangleHeight / 2);
    context.beginPath();
    context.moveTo(x + corner, y);
    context.arcTo(x + rectangleWidth, y, x + rectangleWidth, y + rectangleHeight, corner);
    context.arcTo(x + rectangleWidth, y + rectangleHeight, x, y + rectangleHeight, corner);
    context.arcTo(x, y + rectangleHeight, x, y, corner);
    context.arcTo(x, y, x + rectangleWidth, y, corner);
    context.closePath();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 39.5; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 39.5; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpring(constraint, pointA, pointB, isSelected) {
    const delta = subtract(pointB, pointA);
    const length = magnitude(delta);
    if (length < 1) return;
    const direction = scale(delta, 1 / length);
    const perpendicular = vector(-direction.y, direction.x);
    const lead = Math.min(15, length * 0.14);
    const coilStart = add(pointA, scale(direction, lead));
    const coilEnd = add(pointB, scale(direction, -lead));
    const coils = 12;
    const amplitude = Math.min(10, length * 0.08);

    ctx.save();
    ctx.strokeStyle = isSelected ? COLORS.yellowDark : "#5f6971";
    ctx.lineWidth = isSelected ? 2.6 : 2.1;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pointA.x, pointA.y);
    ctx.lineTo(coilStart.x, coilStart.y);
    for (let index = 1; index < coils; index++) {
      const amount = index / coils;
      const along = add(coilStart, scale(subtract(coilEnd, coilStart), amount));
      const offset = scale(perpendicular, index % 2 ? -amplitude : amplitude);
      ctx.lineTo(along.x + offset.x, along.y + offset.y);
    }
    ctx.lineTo(coilEnd.x, coilEnd.y);
    ctx.lineTo(pointB.x, pointB.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawLink(pointA, pointB, isSelected) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = isSelected ? COLORS.yellowDark : "#545f67";
    ctx.lineWidth = isSelected ? 6 : 5;
    ctx.beginPath();
    ctx.moveTo(pointA.x, pointA.y);
    ctx.lineTo(pointB.x, pointB.y);
    ctx.stroke();
    ctx.strokeStyle = isSelected ? "#ffe28b" : "#aeb5b9";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  function drawConstraintLine(constraint) {
    const pointA = endpointWorldPoint(constraint.a);
    const pointB = endpointWorldPoint(constraint.b);
    const isSelected = selected?.kind === "constraint" && selected.id === constraint.id;
    if (constraint.type === "spring") drawSpring(constraint, pointA, pointB, isSelected);
    else drawLink(pointA, pointB, isSelected);
  }

  function drawEndpoint(endpoint, isSelected) {
    const point = endpointWorldPoint(endpoint);
    const attached = Boolean(getBody(endpoint.bodyId));
    const radius = isSelected ? 6 : 4.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, TAU);
    ctx.fillStyle = attached ? COLORS.yellow : COLORS.white;
    ctx.fill();
    ctx.strokeStyle = COLORS.yellowDark;
    ctx.lineWidth = isSelected ? 2 : 1.5;
    ctx.stroke();
    if (attached) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.5, 0, TAU);
      ctx.fillStyle = COLORS.ink;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSelectionGlow(drawPath) {
    ctx.save();
    ctx.shadowColor = COLORS.selection;
    ctx.shadowBlur = 17;
    ctx.fillStyle = COLORS.yellow;
    drawPath();
    ctx.fill();
    ctx.restore();
  }

  function drawVelocityArrow(body) {
    const velocity = vector(body.vx, body.vy);
    const speedValue = magnitude(velocity);
    if (speedValue < 8) return;
    const length = clamp(speedValue * 0.12, 22, 100);
    const direction = normalize(velocity);
    const start = vector(body.x, body.y);
    const end = add(start, scale(direction, length));
    const wingA = add(end, rotate(scale(direction, -10), 0.55));
    const wingB = add(end, rotate(scale(direction, -10), -0.55));

    ctx.save();
    ctx.strokeStyle = COLORS.blue;
    ctx.fillStyle = COLORS.blue;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(wingA.x, wingA.y);
    ctx.lineTo(wingB.x, wingB.y);
    ctx.closePath();
    ctx.fill();
    ctx.font = "600 9px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${(speedValue / PX_PER_METER).toFixed(1)} m/s`, end.x + 6, end.y - 5);
    ctx.restore();
  }

  function drawAnchor(body, isSelected) {
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(body.angle);
    if (isSelected) {
      ctx.shadowColor = COLORS.selection;
      ctx.shadowBlur = 15;
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineCap = "round";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-28, -10);
    ctx.lineTo(28, -10);
    ctx.stroke();
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 1.4;
    for (let x = -22; x <= 23; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x + 8, -21);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 0);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, body.radius, 0, TAU);
    ctx.fillStyle = isSelected ? COLORS.yellow : COLORS.white;
    ctx.fill();
    ctx.strokeStyle = isSelected ? COLORS.yellowDark : COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawPlatform(body, isSelected) {
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(body.angle);
    if (isSelected) {
      ctx.shadowColor = COLORS.selection;
      ctx.shadowBlur = 15;
    }
    roundedRect(ctx, -body.width / 2, -body.height / 2, body.width, body.height, 2);
    ctx.fillStyle = isSelected ? COLORS.yellow : COLORS.platform;
    ctx.fill();
    ctx.strokeStyle = isSelected ? COLORS.yellowDark : COLORS.ink;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isSelected ? "#9b7109" : "#8a9298";
    ctx.lineWidth = 1.2;
    for (let x = -body.width / 2 + 8; x < body.width / 2 - 2; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, body.height / 2);
      ctx.lineTo(x - 9, body.height / 2 + 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDynamicBody(body, isSelected) {
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(body.angle);
    if (isSelected) {
      ctx.shadowColor = COLORS.selection;
      ctx.shadowBlur = 16;
    }

    if (body.shape === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, body.radius, 0, TAU);
      ctx.fillStyle = isSelected ? COLORS.yellow : COLORS.body;
      ctx.fill();
      ctx.strokeStyle = isSelected ? COLORS.yellowDark : COLORS.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(body.radius * 0.72, 0);
      ctx.strokeStyle = isSelected ? "#6d520b" : "#dfe3e5";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else {
      roundedRect(ctx, -body.width / 2, -body.height / 2, body.width, body.height, body.type === "beam" ? 3 : 4);
      ctx.fillStyle = isSelected ? COLORS.yellow : body.type === "beam" ? COLORS.beam : COLORS.body;
      ctx.fill();
      ctx.strokeStyle = isSelected ? COLORS.yellowDark : COLORS.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isSelected ? "#7c5a05" : "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 6);
      ctx.stroke();
    }
    ctx.restore();
    if (isSelected) drawVelocityArrow(body);
  }

  function drawBody(body) {
    const isSelected = selected?.kind === "body" && selected.id === body.id;
    if (body.type === "anchor") drawAnchor(body, isSelected);
    else if (body.type === "platform") drawPlatform(body, isSelected);
    else drawDynamicBody(body, isSelected);
  }

  function drawSnapTarget() {
    if (!snapTarget) return;
    ctx.save();
    ctx.strokeStyle = COLORS.yellowDark;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    if (snapTarget.shape === "circle") {
      ctx.beginPath();
      ctx.arc(snapTarget.x, snapTarget.y, snapTarget.radius + 8, 0, TAU);
      ctx.stroke();
    } else {
      ctx.translate(snapTarget.x, snapTarget.y);
      ctx.rotate(snapTarget.angle);
      roundedRect(ctx, -snapTarget.width / 2 - 7, -snapTarget.height / 2 - 7, snapTarget.width + 14, snapTarget.height + 14, 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    if (!width || !height) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(0, 0, width, height);
    drawGrid();
    constraints.forEach(drawConstraintLine);
    bodies.forEach(drawBody);
    constraints.forEach(constraint => {
      const isSelected = selected?.kind === "constraint" && selected.id === constraint.id;
      drawEndpoint(constraint.a, isSelected);
      drawEndpoint(constraint.b, isSelected);
    });
    drawSnapTarget();
    ctx.save();
    ctx.strokeStyle = "#d9dddf";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    ctx.restore();
  }

  function formatValue(value, decimals) {
    const numeric = Number(value);
    return decimals === 0 ? numeric.toFixed(0) : numeric.toFixed(decimals);
  }

  function createField(spec, target, prefix) {
    const wrapper = document.createElement("div");
    wrapper.className = "sim-field";
    const top = document.createElement("div");
    top.className = "sim-field__top";
    const label = document.createElement("label");
    const id = `sim-${prefix}-${spec.key}`;
    label.htmlFor = id;
    label.textContent = spec.label;
    const output = document.createElement("output");
    output.htmlFor = id;
    const input = document.createElement("input");
    input.type = "range";
    input.id = id;
    input.min = String(typeof spec.min === "function" ? spec.min(target) : spec.min);
    input.max = String(typeof spec.max === "function" ? spec.max(target) : spec.max);
    input.step = String(spec.step);
    input.value = String(spec.get(target));
    input.dataset.fieldKey = spec.key;

    const updateOutput = () => {
      output.textContent = `${formatValue(input.value, spec.decimals)}${spec.unit ? ` ${spec.unit}` : ""}`;
    };
    updateOutput();

    input.addEventListener("input", () => {
      spec.set(target, Number(input.value));
      updateOutput();
      if (!running) {
        simTime = 0;
        updateTime();
        commitInitialIfPaused();
      }
      draw();
    });

    top.append(label, output);
    wrapper.append(top, input);
    activeFieldSpecs.set(`${prefix}-${spec.key}`, { spec, target, input, output });
    return wrapper;
  }

  function createFieldset(label, specs, target, prefix) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "sim-fieldset";
    const legend = document.createElement("legend");
    legend.textContent = label;
    fieldset.append(legend);
    specs.forEach(spec => fieldset.append(createField(spec, target, prefix)));
    return fieldset;
  }

  function worldSpecs() {
    return [
      {
        key: "gravity", label: "Gravity", min: -12, max: 20, step: 0.1, decimals: 1, unit: "m/s²",
        get: target => target.gravity, set: (target, value) => { target.gravity = value; }
      },
      {
        key: "airDrag", label: "Air resistance", min: 0, max: 0.8, step: 0.01, decimals: 2, unit: "s⁻¹",
        get: target => target.airDrag, set: (target, value) => { target.airDrag = value; }
      }
    ];
  }

  function dynamicBodyGroups(body) {
    const geometry = [
      {
        key: "angle", label: "Angle", min: -180, max: 180, step: 1, decimals: 0, unit: "°",
        get: target => degrees(target.angle), set: (target, value) => { target.angle = radians(value); }
      }
    ];
    if (body.shape === "circle") {
      geometry.push({
        key: "radius", label: "Radius", min: 0.15, max: 0.75, step: 0.01, decimals: 2, unit: "m",
        get: target => target.radius / PX_PER_METER,
        set: (target, value) => { target.radius = value * PX_PER_METER; setMassProperties(target); keepBodyInBounds(target); }
      });
    } else {
      geometry.push(
        {
          key: "width", label: "Width", min: 0.25, max: 2.8, step: 0.02, decimals: 2, unit: "m",
          get: target => target.width / PX_PER_METER,
          set: (target, value) => { target.width = value * PX_PER_METER; setMassProperties(target); keepBodyInBounds(target); }
        },
        {
          key: "height", label: "Height", min: 0.12, max: 1.3, step: 0.02, decimals: 2, unit: "m",
          get: target => target.height / PX_PER_METER,
          set: (target, value) => { target.height = value * PX_PER_METER; setMassProperties(target); keepBodyInBounds(target); }
        }
      );
    }

    return [
      {
        label: "Initial motion",
        specs: [
          {
            key: "vx", label: "Horizontal velocity", min: -12, max: 12, step: 0.1, decimals: 1, unit: "m/s",
            get: target => target.vx / PX_PER_METER, set: (target, value) => { target.vx = value * PX_PER_METER; }
          },
          {
            key: "vy", label: "Vertical velocity", min: -12, max: 12, step: 0.1, decimals: 1, unit: "m/s",
            get: target => target.vy / PX_PER_METER, set: (target, value) => { target.vy = value * PX_PER_METER; }
          },
          {
            key: "omega", label: "Angular velocity", min: -720, max: 720, step: 5, decimals: 0, unit: "°/s",
            get: target => degrees(target.omega), set: (target, value) => { target.omega = radians(value); }
          }
        ]
      },
      {
        label: "Material",
        specs: [
          {
            key: "mass", label: "Mass", min: 0.1, max: 12, step: 0.1, decimals: 1, unit: "kg",
            get: target => target.mass, set: (target, value) => { target.mass = value; setMassProperties(target); }
          },
          {
            key: "restitution", label: "Bounciness", min: 0, max: 1, step: 0.01, decimals: 2, unit: "",
            get: target => target.restitution, set: (target, value) => { target.restitution = value; }
          },
          {
            key: "friction", label: "Friction", min: 0, max: 1, step: 0.01, decimals: 2, unit: "",
            get: target => target.friction, set: (target, value) => { target.friction = value; }
          }
        ]
      },
      { label: "Geometry", specs: geometry }
    ];
  }

  function platformGroups() {
    return [
      {
        label: "Geometry",
        specs: [
          {
            key: "platformAngle", label: "Angle", min: -80, max: 80, step: 1, decimals: 0, unit: "°",
            get: target => degrees(target.angle), set: (target, value) => { target.angle = radians(value); }
          },
          {
            key: "platformWidth", label: "Length", min: 0.5, max: 5, step: 0.05, decimals: 2, unit: "m",
            get: target => target.width / PX_PER_METER,
            set: (target, value) => { target.width = value * PX_PER_METER; keepBodyInBounds(target); }
          }
        ]
      },
      {
        label: "Surface",
        specs: [
          {
            key: "platformRestitution", label: "Bounciness", min: 0, max: 1, step: 0.01, decimals: 2, unit: "",
            get: target => target.restitution, set: (target, value) => { target.restitution = value; }
          },
          {
            key: "platformFriction", label: "Friction", min: 0, max: 1, step: 0.01, decimals: 2, unit: "",
            get: target => target.friction, set: (target, value) => { target.friction = value; }
          }
        ]
      }
    ];
  }

  function constraintGroups(constraint) {
    if (constraint.type === "spring") {
      return [{
        label: "Spring",
        specs: [
          {
            key: "springLength", label: "Free length", min: 0.1, max: 5, step: 0.02, decimals: 2, unit: "m",
            get: target => target.restLength / PX_PER_METER, set: (target, value) => { target.restLength = value * PX_PER_METER; }
          },
          {
            key: "stiffness", label: "Stiffness", min: 1, max: 100, step: 1, decimals: 0, unit: "N/m",
            get: target => target.stiffness, set: (target, value) => { target.stiffness = value; }
          },
          {
            key: "springDamping", label: "Damping", min: 0, max: 6, step: 0.05, decimals: 2, unit: "N·s/m",
            get: target => target.damping, set: (target, value) => { target.damping = value; }
          }
        ]
      }];
    }
    return [{
      label: "Rigid link",
      specs: [{
        key: "linkLength", label: "Length", min: 0.1, max: 5, step: 0.02, decimals: 2, unit: "m",
        get: target => target.restLength / PX_PER_METER, set: (target, value) => { target.restLength = value * PX_PER_METER; }
      }]
    }];
  }

  function appendNote(text) {
    const note = document.createElement("div");
    note.className = "sim-inspector__note";
    note.textContent = text;
    inspectorFields.append(note);
  }

  function renderInspector() {
    inspectorFields.replaceChildren();
    activeFieldSpecs = new Map();
    inspectorFields.append(createFieldset("World", worldSpecs(), world, "world"));

    const item = selectedItem();
    if (!item) {
      selectionName.textContent = "World settings";
      appendNote("Select a body, support, platform, spring, or link to edit it. World controls apply to every moving body.");
      removeButton.hidden = true;
      return;
    }

    selectionName.textContent = item.label;
    removeButton.hidden = false;
    let groups = [];
    if (selected.kind === "constraint") {
      groups = constraintGroups(item);
      appendNote("Drag either yellow endpoint on the canvas to attach or detach this connection.");
    } else if (item.dynamic) {
      groups = dynamicBodyGroups(item);
    } else if (item.type === "platform") {
      groups = platformGroups(item);
    } else {
      appendNote("This anchor is fixed in space. Attach spring or rigid-link endpoints to its center.");
    }
    groups.forEach((group, index) => {
      inspectorFields.append(createFieldset(group.label, group.specs, item, `${item.id}-${index}`));
    });
  }

  function syncInspectorValues() {
    activeFieldSpecs.forEach(({ spec, target, input, output }) => {
      const value = spec.get(target);
      input.value = String(value);
      output.textContent = `${formatValue(value, spec.decimals)}${spec.unit ? ` ${spec.unit}` : ""}`;
    });
  }

  function pointInBody(point, body, margin = 0) {
    if (body.shape === "circle") return distance(point, body) <= body.radius + margin;
    const local = rotate(subtract(point, body), -body.angle);
    return Math.abs(local.x) <= body.width / 2 + margin && Math.abs(local.y) <= body.height / 2 + margin;
  }

  function findBodyAt(point, margin = 0) {
    for (let index = bodies.length - 1; index >= 0; index--) {
      if (pointInBody(point, bodies[index], margin)) return bodies[index];
    }
    return null;
  }

  function distanceToSegment(point, start, end) {
    const segment = subtract(end, start);
    const lengthSquared = dot(segment, segment);
    if (lengthSquared < 1e-9) return distance(point, start);
    const amount = clamp(dot(subtract(point, start), segment) / lengthSquared, 0, 1);
    return distance(point, add(start, scale(segment, amount)));
  }

  function hitScene(point) {
    for (let index = constraints.length - 1; index >= 0; index--) {
      const constraint = constraints[index];
      if (distance(point, endpointWorldPoint(constraint.a)) <= 11) return { kind: "endpoint", item: constraint, end: "a" };
      if (distance(point, endpointWorldPoint(constraint.b)) <= 11) return { kind: "endpoint", item: constraint, end: "b" };
    }
    const body = findBodyAt(point, 5);
    if (body) return { kind: "body", item: body };
    for (let index = constraints.length - 1; index >= 0; index--) {
      const constraint = constraints[index];
      if (distanceToSegment(point, endpointWorldPoint(constraint.a), endpointWorldPoint(constraint.b)) <= 9) {
        return { kind: "constraint", item: constraint };
      }
    }
    return null;
  }

  function attachEndpoint(endpoint, body, point) {
    if (!body) {
      endpoint.bodyId = null;
      endpoint.x = point.x;
      endpoint.y = point.y;
      endpoint.localX = 0;
      endpoint.localY = 0;
      return;
    }

    endpoint.bodyId = body.id;
    if (body.type === "anchor") {
      endpoint.localX = 0;
      endpoint.localY = 0;
    } else {
      const local = rotate(subtract(point, body), -body.angle);
      endpoint.localX = local.x;
      endpoint.localY = local.y;
    }
    endpoint.x = point.x;
    endpoint.y = point.y;
  }

  function pointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const point = getCanvasPoint(event);
    const hit = hitScene(point);

    if (!hit) {
      selected = null;
      renderInspector();
      draw();
      return;
    }

    if (hit.kind === "body") selected = { kind: "body", id: hit.item.id };
    else selected = { kind: "constraint", id: hit.item.id };
    renderInspector();

    if (hit.kind === "endpoint") {
      const endpoint = hit.item[hit.end];
      const worldPoint = endpointWorldPoint(endpoint);
      attachEndpoint(endpoint, null, worldPoint);
      pointerDrag = { kind: "endpoint", item: hit.item, end: hit.end };
      showCanvasMessage("Release over a body or anchor to attach.", 0);
    } else if (hit.kind === "body") {
      hit.item.dragged = true;
      pointerDrag = {
        kind: "body",
        item: hit.item,
        offsetX: point.x - hit.item.x,
        offsetY: point.y - hit.item.y,
        previousPoint: point,
        previousTime: performance.now()
      };
    }

    if (pointerDrag) {
      canvas.classList.add("is-dragging");
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
    draw();
  }

  function pointerMove(event) {
    const point = getCanvasPoint(event);
    if (!pointerDrag) {
      const hit = hitScene(point);
      canvas.classList.toggle("is-grabbable", Boolean(hit && hit.kind !== "constraint"));
      return;
    }

    if (pointerDrag.kind === "endpoint") {
      const endpoint = pointerDrag.item[pointerDrag.end];
      endpoint.x = clamp(point.x, 5, width - 5);
      endpoint.y = clamp(point.y, 5, height - 5);
      snapTarget = findBodyAt(point, 14);
      canvasMessage.textContent = snapTarget ? `Release to attach to ${snapTarget.label}.` : "Release here for a fixed free endpoint.";
    } else {
      const body = pointerDrag.item;
      const newX = point.x - pointerDrag.offsetX;
      const newY = point.y - pointerDrag.offsetY;
      if (running && body.dynamic) {
        const now = performance.now();
        const dt = Math.max((now - pointerDrag.previousTime) / 1000, 1 / 240);
        body.vx = clamp((point.x - pointerDrag.previousPoint.x) / dt, -1800, 1800);
        body.vy = clamp((point.y - pointerDrag.previousPoint.y) / dt, -1800, 1800);
        pointerDrag.previousPoint = point;
        pointerDrag.previousTime = now;
      }
      body.x = newX;
      body.y = newY;
      keepBodyInBounds(body);
    }

    syncInspectorValues();
    draw();
    event.preventDefault();
  }

  function pointerUp(event) {
    if (!pointerDrag) return;
    let message;
    if (pointerDrag.kind === "endpoint") {
      const constraint = pointerDrag.item;
      const endpoint = constraint[pointerDrag.end];
      const point = endpointWorldPoint(endpoint);
      attachEndpoint(endpoint, snapTarget, point);
      constraint.restLength = Math.max(8, distance(endpointWorldPoint(constraint.a), endpointWorldPoint(constraint.b)));
      message = snapTarget ? `${constraint.label} attached to ${snapTarget.label}.` : `${constraint.label} endpoint fixed in space.`;
      snapTarget = null;
      canvasMessage.hidden = true;
    } else {
      pointerDrag.item.dragged = false;
      message = running && pointerDrag.item.dynamic ? `${pointerDrag.item.label} released with its drag velocity.` : `${pointerDrag.item.label} repositioned.`;
    }

    pointerDrag = null;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!running) {
      simTime = 0;
      updateTime();
      commitInitialIfPaused();
    }
    syncInspectorValues();
    draw();
    announce(message);
  }

  pieceButtons.forEach(button => {
    const type = button.dataset.pieceType;
    button.addEventListener("click", () => addPiece(type));
    button.addEventListener("dragstart", event => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", type);
      canvasWrap.classList.add("is-drop-target");
    });
    button.addEventListener("dragend", () => canvasWrap.classList.remove("is-drop-target"));
  });

  canvasWrap.addEventListener("dragenter", event => {
    event.preventDefault();
    canvasWrap.classList.add("is-drop-target");
  });
  canvasWrap.addEventListener("dragover", event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });
  canvasWrap.addEventListener("dragleave", event => {
    if (!canvasWrap.contains(event.relatedTarget)) canvasWrap.classList.remove("is-drop-target");
  });
  canvasWrap.addEventListener("drop", event => {
    event.preventDefault();
    canvasWrap.classList.remove("is-drop-target");
    const type = event.dataTransfer.getData("text/plain");
    if (!pieceButtons.some(button => button.dataset.pieceType === type)) return;
    const point = getCanvasPoint(event);
    addPiece(type, point.x, point.y);
  });

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("pointerleave", () => {
    if (!pointerDrag) canvas.classList.remove("is-grabbable");
  });

  canvas.addEventListener("keydown", event => {
    if (event.key === " ") {
      event.preventDefault();
      toggleRunning();
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedItem()) {
      event.preventDefault();
      removeSelected();
      return;
    }
    const item = selectedItem();
    if (!item || selected?.kind !== "body" || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    if (event.key === "ArrowLeft") item.x -= 5;
    if (event.key === "ArrowRight") item.x += 5;
    if (event.key === "ArrowUp") item.y -= 5;
    if (event.key === "ArrowDown") item.y += 5;
    keepBodyInBounds(item);
    if (!running) commitInitialIfPaused();
    draw();
    event.preventDefault();
  });

  playButton.addEventListener("click", toggleRunning);
  resetButton.addEventListener("click", resetAll);
  captureButton.addEventListener("click", () => captureInitial(true));
  clearButton.addEventListener("click", clearAll);
  removeButton.addEventListener("click", removeSelected);
  speedSelect.addEventListener("change", () => {
    speed = Number(speedSelect.value) || 1;
    announce(`Simulation speed set to ${speedSelect.options[speedSelect.selectedIndex].text}.`);
  });

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const newWidth = Math.max(1, rect.width);
    const newHeight = Math.max(1, rect.height);
    const scaleX = width > 1 ? newWidth / width : 1;
    const scaleY = height > 1 ? newHeight / height : 1;
    if (width > 1 && height > 1) {
      bodies.forEach(body => {
        body.x *= scaleX;
        body.y *= scaleY;
      });
      constraints.forEach(constraint => {
        [constraint.a, constraint.b].forEach(endpoint => {
          if (endpoint.bodyId === null) {
            endpoint.x *= scaleX;
            endpoint.y *= scaleY;
          }
        });
        constraint.restLength *= Math.sqrt(scaleX * scaleY);
      });
    }
    width = newWidth;
    height = newHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bodies.forEach(keepBodyInBounds);
    draw();
  }

  function frame(timestamp) {
    const rawElapsed = Math.min((timestamp - lastFrame) / 1000, 0.04);
    lastFrame = timestamp;
    if (running && !pointerDrag) {
      advance(rawElapsed * speed);
      updateTime();
      draw();
    }
    requestAnimationFrame(frame);
  }

  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvasWrap);
  resizeCanvas();
  updateSceneMeta();
  renderInspector();
  captureInitial(false);
  updateTime();
  draw();
  requestAnimationFrame(frame);
})();
