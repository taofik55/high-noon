import { Color, InstancedMesh, Matrix4, type BufferGeometry, type ColorRepresentation, type Material } from "three";

/**
 * Collects placements of one repeated piece (a board, a baluster, a bracket) and turns them into a single
 * InstancedMesh: hundreds of boards, one draw call. Each instance can carry its own tint.
 */
export class InstanceSet {
  private readonly matrices: Matrix4[] = [];
  private readonly colors: Color[] = [];

  constructor(
    readonly name: string,
    private readonly geometry: BufferGeometry,
    private readonly material: Material,
  ) {}

  add(matrix: Matrix4, color: ColorRepresentation = "#ffffff"): void {
    this.matrices.push(matrix);
    this.colors.push(new Color(color));
  }

  get count(): number {
    return this.matrices.length;
  }

  build(): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry, this.material, Math.max(1, this.matrices.length));
    mesh.name = this.name;
    this.matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, this.colors[i] as Color);
    });
    mesh.count = this.matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    return mesh;
  }
}
