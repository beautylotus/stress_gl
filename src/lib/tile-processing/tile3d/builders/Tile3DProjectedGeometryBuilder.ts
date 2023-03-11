import OSMReference from "~/lib/tile-processing/vector/features/OSMReference";
import Vec2 from "~/lib/math/Vec2";
import Tile3DProjectedGeometry from "~/lib/tile-processing/tile3d/features/Tile3DProjectedGeometry";
import Tile3DMultipolygon from "~/lib/tile-processing/tile3d/builders/Tile3DMultipolygon";
import Tile3DRing, {Tile3DRingType} from "~/lib/tile-processing/tile3d/builders/Tile3DRing";
import GeometryGroundProjector from "~/lib/tile-processing/tile3d/builders/GeometryGroundProjector";
import Config from "~/app/Config";
import AABB3D from "~/lib/math/AABB3D";
import Vec3 from "~/lib/math/Vec3";
import SurfaceBuilder from "~/lib/tile-processing/tile3d/builders/SurfaceBuilder";
import RoadBuilder from "~/lib/tile-processing/tile3d/builders/RoadBuilder";
import WallsBuilder from "~/lib/tile-processing/tile3d/builders/WallsBuilder";

export default class Tile3DProjectedGeometryBuilder {
	private readonly osmReference: OSMReference;
	private readonly arrays: {
		position: number[];
		uv: number[];
		normal: number[];
		textureId: number[];
	} = {
		position: [],
		uv: [],
		normal: [],
		textureId: []
	};
	private readonly boundingBox: AABB3D = new AABB3D();
	private readonly multipolygon: Tile3DMultipolygon = new Tile3DMultipolygon();
	private zIndex: number = 0;

	public constructor(osmReference: OSMReference) {
		this.osmReference = osmReference;
	}

	public addRing(type: Tile3DRingType, nodes: Vec2[]): void {
		const ring = new Tile3DRing(type, nodes);
		this.multipolygon.addRing(ring);
	}

	public setZIndex(value: number): void {
		this.zIndex = value;
	}

	public addRoad(
		{
			textureId,
			width
		}: {
			textureId: number;
			width: number;
		}
	): void {

	}

	public addPolygon(
		{
			textureId,
			height,
			uvScale = 1,
			isOriented = false
		}: {
			height: number;
			textureId: number;
			uvScale?: number;
			isOriented?: boolean;
		}
	): void {
		const surfaceBuilder = new SurfaceBuilder();
		const surface = surfaceBuilder.build({
			multipolygon: this.multipolygon,
			isOriented: isOriented,
			uvScale: uvScale
		});

		this.projectAndAddGeometry({
			position: surface.position,
			uv: surface.uv,
			textureId: textureId,
			height: height
		});
	}

	public addPath(
		{
			width,
			textureId,
			height = 0
		}: {
			width: number;
			textureId: number;
			height?: number;
		}
	): void {
		const road = new RoadBuilder().build({
			vertices: this.multipolygon.rings[0].nodes,
			width: width
		});

		this.projectAndAddGeometry({
			position: road.position,
			uv: road.uv,
			textureId: textureId,
			height: height
		});
	}

	public addFence(
		{
			textureId,
			height
		}: {
			textureId: number;
			height: number;
		}
	): void {
		const ring = this.multipolygon.rings[0];
		const projector = new GeometryGroundProjector();
		const projectorSegmentCount = Math.round(Config.TileSize / Config.TerrainRingSize * Config.TerrainRingSegmentCount) * 2;
		const vertices: Vec2[] = [];

		for (let i = 0; i < ring.nodes.length - 1; i++) {
			const start = ring.nodes[i];
			const end = ring.nodes[i + 1];

			const projected = projector.projectLineSegment({
				lineStart: start,
				lineEnd: end,
				tileSize: Config.TileSize,
				segmentCount: projectorSegmentCount
			});

			for (const projectedVertex of projected) {
				if (vertices.length === 0 || !vertices[vertices.length - 1].equals(projectedVertex)) {
					vertices.push(projectedVertex);
				}
			}
		}

		const wall = new WallsBuilder().build({
			vertices: vertices,
			height: height,
			minHeight: 0,
			textureIdWall: 1,
			textureIdWindow: 1,
			levels: 1,
			windowWidth: height * 2
		});

		this.arrays.position.push(...wall.position);
		this.arrays.uv.push(...wall.uv);
		this.arrays.normal.push(...wall.normal);

		const vertexCount = wall.position.length / 3;

		for (let i = 0; i < vertexCount; i++) {
			this.arrays.textureId.push(textureId);
		}

		//console.log(this.osmReference, vertices)
	}

	private projectAndAddGeometry(
		{
			position,
			uv,
			textureId,
			height = 0
		}: {
			position: number[];
			uv: number[];
			textureId: number;
			height?: number;
		}
	): void {
		const projector = new GeometryGroundProjector();
		const projectorSegmentCount = Math.round(Config.TileSize / Config.TerrainRingSize * Config.TerrainRingSegmentCount) * 2;
		const tileSize = Config.TileSize;

		const projectedPositions: number[] = [];
		const projectedUVs: number[] = [];

		for (let i = 0, j = 0; i < position.length; i += 9, j += 6) {
			const trianglePositions: [number, number][] = [
				[position[i], position[i + 2]],
				[position[i + 3], position[i + 5]],
				[position[i + 6], position[i + 8]]
			];
			const triangleUVs: [number, number][] = [
				[uv[j], uv[j + 1]],
				[uv[j + 2], uv[j + 3]],
				[uv[j + 4], uv[j + 5]]
			];
			const projected = projector.project({
				triangle: trianglePositions,
				attributes: {
					uv: triangleUVs
				},
				tileSize: tileSize,
				segmentCount: projectorSegmentCount
			});

			if (projected.position.length > 0) {
				const newPositions = Array.from(projected.position);
				const newUVs = Array.from(projected.attributes.uv);

				for (let i = 1; i < newPositions.length; i += 3) {
					newPositions[i] = height;
				}

				projectedPositions.push(...newPositions);
				projectedUVs.push(...newUVs);

				this.addVerticesToBoundingBox(newPositions);
			}
		}

		this.arrays.position.push(...projectedPositions);
		this.arrays.uv.push(...projectedUVs);

		const vertexCount = projectedPositions.length / 3;

		for (let i = 0; i < vertexCount; i++) {
			this.arrays.normal.push(0, 1, 0);
			this.arrays.textureId.push(textureId);
		}
	}

	private addVerticesToBoundingBox(vertices: number[]): void {
		const tempVec3 = new Vec3();

		for (let i = 0; i < vertices.length; i += 3) {
			tempVec3.set(vertices[i], vertices[i + 1], vertices[i + 2]);
			this.boundingBox.includePoint(tempVec3);
		}
	}

	public getGeometry(): Tile3DProjectedGeometry {
		return {
			type: 'projected',
			zIndex: this.zIndex,
			boundingBox: this.boundingBox,
			positionBuffer: new Float32Array(this.arrays.position),
			normalBuffer: new Float32Array(this.arrays.normal),
			uvBuffer: new Float32Array(this.arrays.uv),
			textureIdBuffer: new Uint8Array(this.arrays.textureId)
		};
	}
}