/**
 * Surface-relative model orientation (mission §85).
 *
 * Builds the ECEF quaternion that stands a catalog model up on the globe: model
 * +X → compass heading, +Y → left, +Z → local zenith. Because every model is
 * authored in that same body frame, one function orients aircraft, ships and
 * satellites alike — and instrument faces authored on −Z end up pointing at the
 * Earth. Heading `undefined` (satellites) simply faces local north, which is
 * stable frame-to-frame.
 */
import {
  Cartesian3,
  Ellipsoid,
  Math as CMath,
  Matrix3,
  Quaternion,
} from "cesium";

const sUp = new Cartesian3();
const sEast = new Cartesian3();
const sNorth = new Cartesian3();
const sFwd = new Cartesian3();
const sTmp = new Cartesian3();
const sLeft = new Cartesian3();
const sRot = new Matrix3();

/** ENU-relative quaternion orienting a body-frame model at `position`. */
export function surfaceQuaternion(
  position: Cartesian3,
  headingDeg: number | undefined,
  result: Quaternion,
): Quaternion {
  const up = Ellipsoid.WGS84.geodeticSurfaceNormal(position, sUp);
  if (!up) return Quaternion.clone(Quaternion.IDENTITY, result);

  // Local east/north from the surface normal (degenerate only exactly at poles).
  Cartesian3.cross(Cartesian3.UNIT_Z, up, sEast);
  if (Cartesian3.magnitudeSquared(sEast) < 1e-12) Cartesian3.clone(Cartesian3.UNIT_X, sEast);
  Cartesian3.normalize(sEast, sEast);
  Cartesian3.cross(up, sEast, sNorth);

  const h = CMath.toRadians(headingDeg ?? 0);
  // forward = east·sin(h) + north·cos(h)  (compass heading, 0 = north).
  Cartesian3.multiplyByScalar(sEast, Math.sin(h), sFwd);
  Cartesian3.multiplyByScalar(sNorth, Math.cos(h), sTmp);
  Cartesian3.add(sFwd, sTmp, sFwd);
  Cartesian3.normalize(sFwd, sFwd);
  Cartesian3.cross(up, sFwd, sLeft); // left = up × forward

  // Columns are the model basis vectors: X=forward, Y=left, Z=up.
  Matrix3.fromArray(
    [sFwd.x, sFwd.y, sFwd.z, sLeft.x, sLeft.y, sLeft.z, up.x, up.y, up.z],
    0,
    sRot,
  );
  return Quaternion.fromRotationMatrix(sRot, result);
}
