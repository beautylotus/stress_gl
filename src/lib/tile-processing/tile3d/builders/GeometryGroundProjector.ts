import Vec2 from "~/lib/math/Vec2";
import MathUtils from "~/lib/math/MathUtils";
import Utils from "~/app/Utils";

export default class GeometryGroundProjector {
	public project(
		{
			triangle,
			attributes,
			tileSize,
			segmentCount,
			height = 0
		}: {
			triangle: [number, number][];
			attributes: {[name: string]: [number, number][]};
			tileSize: number;
			segmentCount: number;
			height?: number;
		}
	): {
		position: Float32Array;
		attributes: {[name: string]: Float32Array};
	} {
		const triangleNormalized = GeometryGroundProjector.normalizeTriangle(triangle, tileSize);
		const groundTriangles = GeometryGroundProjector.getIntersectingGroundTrianglesForTriangle(triangleNormalized, segmentCount);
		const flatTriangle = triangleNormalized.flat();

		const positionArrays: Float32Array[] = [];
		const attributeArrays: Map<string, Float32Array[]> = new Map();

		for (const name of Object.keys(attributes)) {
			attributeArrays.set(name, []);
		}

		for (let i = 0; i < groundTriangles.length; i++) {
			const polygon = MathUtils.findIntersectionTriangleTriangle(groundTriangles[i], triangleNormalized);

			if (polygon.length === 0) {
				continue;
			}

			const triangulated = GeometryGroundProjector.triangulateConvex(polygon);
			const vertices = new Float32Array(triangulated.length * 3);
			const attributesBuffers: Map<string, Float32Array> = new Map();

			for (const name of Object.keys(attributes)) {
				attributesBuffers.set(name, new Float32Array(triangulated.length * 2));
			}

			for (let i = 0; i < triangulated.length; i++) {
				const index = triangulated[i];
				const x = polygon[index][0];
				const z = polygon[index][1];

				vertices[i * 3] = x * tileSize;
				vertices[i * 3 + 1] = height;
				vertices[i * 3 + 2] = z * tileSize;

				for (const [name, attribute] of Object.entries(attributes)) {
					const bar = MathUtils.getBarycentricCoordinatesOfPoint(new Vec2(x, z), flatTriangle);

					const buffer = attributesBuffers.get(name);

					buffer[i * 2] = attribute[0][0] * bar.x + attribute[1][0] * bar.y + attribute[2][0] * bar.z;
					buffer[i * 2 + 1] = attribute[0][1] * bar.x + attribute[1][1] * bar.y + attribute[2][1] * bar.z;
				}
			}

			positionArrays.push(vertices);

			for (const [name, buffer] of attributesBuffers.entries()) {
				attributeArrays.get(name).push(buffer);
			}
		}

		return GeometryGroundProjector.mergePositionsAndAttributes(positionArrays, attributeArrays);
	}

	public projectLineSegment(
		{
			lineStart,
			lineEnd,
			tileSize,
			segmentCount
		}: {
			lineStart: Vec2;
			lineEnd: Vec2;
			tileSize: number;
			segmentCount: number;
		}
	): Vec2[] {
		const lineStartNormalized = Vec2.multiplyScalar(lineStart, 1 / tileSize);
		const lineEndNormalized = Vec2.multiplyScalar(lineEnd, 1 / tileSize);

		const groundTriangles = GeometryGroundProjector.getIntersectingGroundTrianglesForLine(
			lineStartNormalized,
			lineEndNormalized,
			segmentCount
		);
		const pointsProgressSet: Set<number> = new Set([0, 1]);

		for (const triangle of groundTriangles) {
			const intersections = MathUtils.getIntersectionsLineTriangle(
				Vec2.toArray(lineStartNormalized),
				Vec2.toArray(lineEndNormalized),
				triangle
			);

			for (const intersectionPoint of intersections) {
				const progress = MathUtils.getPointProgressAlongLineSegment(
					lineStartNormalized,
					lineEndNormalized,
					new Vec2(intersectionPoint[0], intersectionPoint[1])
				);
				pointsProgressSet.add(progress);
			}
		}

		const pointsProgress = Array.from(pointsProgressSet).sort((a, b) => a - b);
		const lineVector = Vec2.sub(lineEnd, lineStart);

		return pointsProgress.map(progress => {
			return Vec2.add(lineStart, Vec2.multiplyScalar(lineVector, progress));
		});
	}

	private static normalizeTriangle(triangle: [number, number][], tileSize: number): [number, number][] {
		return triangle.map(vertex => [
			vertex[0] / tileSize,
			vertex[1] / tileSize
		]);
	}

	private static getIntersectingGroundTrianglesForTriangle(triangle: [number, number][], segmentCount: number): [number, number][][] {
		const groundTriangles: [number, number][][] = [];
		const coveredTiles = this.getTilesUnderTriangle(triangle, segmentCount, segmentCount);

		for (const tilePos of coveredTiles) {
			groundTriangles.push(
				this.getTriangle(tilePos.x, tilePos.y, 0, segmentCount),
				this.getTriangle(tilePos.x, tilePos.y, 1, segmentCount)
			);
		}

		return groundTriangles;
	}

	private static getIntersectingGroundTrianglesForLine(
		lineStart: Vec2,
		lineEnd: Vec2,
		segmentCount: number
	): [number, number][][] {
		const groundTriangles: [number, number][][] = [];
		const tiles = MathUtils.getTilesIntersectingLine(
			Vec2.multiplyScalar(lineStart, segmentCount),
			Vec2.multiplyScalar(lineEnd, segmentCount)
		);

		for (const tilePos of tiles) {
			groundTriangles.push(
				this.getTriangle(tilePos.x, tilePos.y, 0, segmentCount),
				this.getTriangle(tilePos.x, tilePos.y, 1, segmentCount)
			);
		}

		return groundTriangles;
	}

	private static mergePositionsAndAttributes(
		positionArrays: Float32Array[],
		attributeArrays: Map<string, Float32Array[]>
	): {
		position: Float32Array;
		attributes: {[name: string]: Float32Array};
	} {
		const mergedAttributes: {[attributeName: string]: Float32Array} = {};

		for (const [name, buffers] of attributeArrays.entries()) {
			mergedAttributes[name] = Utils.mergeTypedArrays(Float32Array, buffers);
		}

		return {
			position: Utils.mergeTypedArrays(Float32Array, positionArrays),
			attributes: mergedAttributes
		};
	}

	private static triangulateConvex(vertices: [number, number][]): number[] {
		const result: number[] = [];

		if (vertices.length < 3) {
			return result;
		}

		for (let i = 2; i < vertices.length; i++) {
			result.push(0, i, i - 1);
		}

		return result;
	}

	private static getTilesUnderTriangle(
		triangle: [number, number][],
		triangleScaleX: number,
		triangleScaleY: number
	): Vec2[] {
		const sx = triangleScaleX;
		const sy = triangleScaleY;
		const pointA = new Vec2(triangle[0][0] * sx, triangle[0][1] * sy);
		const pointB = new Vec2(triangle[1][0] * sx, triangle[1][1] * sy);
		const pointC = new Vec2(triangle[2][0] * sx, triangle[2][1] * sy);

		const tilesA = MathUtils.getTilesIntersectingLine(pointA, pointB);
		const tilesB = MathUtils.getTilesIntersectingLine(pointB, pointC);
		const tilesC = MathUtils.getTilesIntersectingLine(pointC, pointA);

		const tilesOnEdges: Vec2[] = tilesA.concat(tilesB, tilesC);
		const tilesUnderTriangle: Vec2[] = [];

		let minY = Infinity;
		let maxY = -Infinity;
		let minX = 0;

		for (const tile of tilesOnEdges) {
			if (minY <= tile.y) {
				minX = Math.min(tile.x, minX);
			}

			minY = Math.min(tile.y, minY);
			maxY = Math.max(tile.y, maxY);
		}

		for (let y = minY; y <= maxY; y++) {
			const minX = tilesOnEdges.reduce((a, b) => a.x < b.x ? a : b).x;
			const maxX = tilesOnEdges.reduce((a, b) => a.x > b.x ? a : b).x;

			for (let x = minX; x <= maxX; x++) {
				if (x < 0 || y < 0 || x >= triangleScaleX || y >= triangleScaleY) {
					continue;
				}

				tilesUnderTriangle.push(new Vec2(x, y));
			}
		}

		return tilesUnderTriangle;
	}

	private static getTriangle(quadX: number, quadY: number, index: 0 | 1, segmentCount: number): [number, number][] {
		const quadSize = 1 / segmentCount;
		const normQuadX = quadX / segmentCount;
		const normQuadY = quadY / segmentCount;
		const isOdd = (quadX + quadY) % 2 === 1;

		const quadVertices = [
			normQuadX,
			normQuadY,
			normQuadX + quadSize,
			normQuadY,
			normQuadX + quadSize,
			normQuadY + quadSize,
			normQuadX,
			normQuadY + quadSize
		];

		let indices: number[];

		if (!isOdd) {
			if (index === 0) {
				indices = [0, 2, 1];
			} else {
				indices = [0, 3, 2];
			}
		} else {
			if (index === 0) {
				indices = [1, 0, 3];
			} else {
				indices = [1, 3, 2];
			}
		}

		const result: [number, number][] = [];

		for (let i = 0; i < 3; i++) {
			const vertexId = indices[i];
			const x = quadVertices[vertexId * 2];
			const y = quadVertices[vertexId * 2 + 1];

			result.push([x, y]);
		}

		return result;
	}
}