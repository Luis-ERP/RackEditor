import {
  createColumnEntity,
  createRackModuleEntity,
  createWallEntity,
} from '../entities.js';
import { buildAutoGapMeasurements } from '../renderers.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
    return;
  }

  failed += 1;
  console.error(`FAIL: ${label}`);
}

function assertEqual(actual, expected, label) {
  assert(actual === expected, `${label} (expected ${expected}, got ${actual})`);
}

function assertClose(actual, expected, tolerance, label) {
  assert(Math.abs(actual - expected) <= tolerance, `${label} (expected ${expected}, got ${actual})`);
}

function findMeasurement(measurements, axis, entityId, neighborId) {
  return measurements.find((measurement) => (
    measurement.axis === axis
    && measurement.entityId === entityId
    && measurement.neighborId === neighborId
  ));
}

function run() {
  const rackA = createRackModuleEntity({
    id: 'rack-a',
    x: 0,
    y: 0,
    domainId: 'domain-a',
    widthM: 2,
    depthM: 1,
  });
  const rackB = createRackModuleEntity({
    id: 'rack-b',
    x: 3,
    y: 0.1,
    domainId: 'domain-b',
    widthM: 2,
    depthM: 1,
  });
  const columnAbove = createColumnEntity({
    id: 'column-above',
    x: 0.8,
    y: 2.3,
    widthM: 0.4,
    depthM: 0.4,
  });

  const measurements = buildAutoGapMeasurements([rackA, rackB, columnAbove]);
  const horizontal = findMeasurement(measurements, 'x', 'rack-a', 'rack-b');
  const vertical = findMeasurement(measurements, 'y', 'rack-a', 'column-above');

  assert(!!horizontal, 'detects the nearest horizontal neighbor with shared Y overlap');
  assertEqual(horizontal?.distanceM, 1, 'computes the horizontal clear gap');
  assert(!!vertical, 'detects the nearest vertical neighbor with shared X overlap');
  assertClose(vertical?.distanceM ?? 0, 1.1, 1e-9, 'computes the vertical clear gap');

  const misalignedColumn = createColumnEntity({
    id: 'column-misaligned',
    x: 2.85,
    y: 3,
    widthM: 0.4,
    depthM: 0.4,
  });
  const noVertical = buildAutoGapMeasurements([rackA, misalignedColumn]);
  assertEqual(noVertical.length, 0, 'ignores candidates without enough perpendicular overlap');

  const orthogonalWall = createWallEntity({
    id: 'wall-orthogonal',
    x: 6,
    y: 0.5,
    rotation: 90,
    lengthM: 2,
    thicknessM: 0.2,
  });
  const diagonalWall = createWallEntity({
    id: 'wall-diagonal',
    x: 6,
    y: 0.5,
    rotation: 45,
    lengthM: 2,
    thicknessM: 0.2,
  });
  const withOrthogonalWall = buildAutoGapMeasurements([rackB, orthogonalWall]);
  const withDiagonalWall = buildAutoGapMeasurements([rackB, diagonalWall]);

  assertEqual(withOrthogonalWall.length, 1, 'allows orthogonal walls in auto-gap measurements');
  assertEqual(withDiagonalWall.length, 0, 'skips non-orthogonal walls to avoid false axis matches');

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed; ${passed} passed.`);
    process.exit(1);
  }

  console.log(`All ${passed} measurement adjacency assertions passed.`);
}

run();