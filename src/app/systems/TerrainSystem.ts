import System from "../System";
import SystemManager from "../SystemManager";
import SceneSystem from "./SceneSystem";
import MathUtils from "~/lib/math/MathUtils";
import Vec2 from "~/lib/math/Vec2";
import Config from "../Config";
import HeightTileSource from "../world/terrain/HeightTileSource";
import WaterTileSource from "../world/terrain/WaterTileSource";
import TileAreaLoader from "../world/terrain/TileAreaLoader";

export interface TerrainAreaLoaders {
	water0: TileAreaLoader<WaterTileSource>;
	water1: TileAreaLoader<WaterTileSource>;
	height0: TileAreaLoader<HeightTileSource>;
	height1: TileAreaLoader<HeightTileSource>;
}

export default class TerrainSystem extends System {
	public lastPivotPosition: Vec2 = null;
	public lastPivotPositionMeters: Vec2 = null;
	public lastHeightTilePivot: Vec2 = null;
	public maskOriginMeters: Vec2 = new Vec2();
	public maskOriginTiles: Vec2 = new Vec2();
	public readonly areaLoaders: Readonly<TerrainAreaLoaders>;

	public constructor(systemManager: SystemManager) {
		super(systemManager);

		this.areaLoaders = {
			water0: new TileAreaLoader({
				sourceClass: WaterTileSource,
				zoom: 13,
				maxStoredTiles: 100,
				viewportSize: 4,
				bufferSize: 1
			}),
			water1: new TileAreaLoader({
				sourceClass: WaterTileSource,
				zoom: 9,
				maxStoredTiles: 100,
				viewportSize: 4,
				bufferSize: 1
			}),
			height0: new TileAreaLoader({
				sourceClass: HeightTileSource,
				zoom: 12,
				maxStoredTiles: 100,
				viewportSize: 4,
				bufferSize: 1
			}),
			height1: new TileAreaLoader({
				sourceClass: HeightTileSource,
				zoom: 9,
				maxStoredTiles: 100,
				viewportSize: 4,
				bufferSize: 1
			}),
		};
	}

	public postInit(): void {

	}

	public update(deltaTime: number): void {
		const terrain = this.systemManager.getSystem(SceneSystem).objects.terrain;
		const camera = this.systemManager.getSystem(SceneSystem).objects.camera;
		let currentStepX: number, currentStepY: number;

		for (let i = 0; i < terrain.children.length; i++) {
			const ring = terrain.children[i];
			const stepSize = ring.size / ring.segmentCount;

			ring.position.set(
				camera.position.x - MathUtils.mod(camera.position.x, stepSize),
				0,
				camera.position.z - MathUtils.mod(camera.position.z, -stepSize)
			);
			ring.updateMatrix();

			if (i === 0) {
				currentStepX = Math.floor(camera.position.x / stepSize);
				currentStepY = Math.floor(camera.position.z / stepSize);
			}

			ring.morphOffset[0] = currentStepX % 2 === 0 ? 0 : 2;
			ring.morphOffset[1] = currentStepY % 2 === 0 ? 0 : -2;

			if (i === terrain.children.length - 1) {
				ring.isLastRing = true;
			}

			currentStepX = Math.floor(currentStepX / 2);
			currentStepY = Math.floor(currentStepY / 2);
		}

		const cameraPosition2D = new Vec2(camera.position.x, camera.position.z);
		for (const areaLoader of Object.values(this.areaLoaders)) {
			(<TileAreaLoader<any>>areaLoader).update(cameraPosition2D);
		}

		const cameraTilePosition = MathUtils.meters2tile(camera.position.x, camera.position.z);
		const startX = Math.floor(cameraTilePosition.x) - Math.floor(Config.TerrainWaterMaskResolution / 2);
		const startY = Math.floor(cameraTilePosition.y) - Math.floor(Config.TerrainWaterMaskResolution / 2);
		const startMeters = MathUtils.tile2meters(startX, startY + Config.TerrainWaterMaskResolution);

		this.maskOriginTiles.set(startX, startY);
		this.maskOriginMeters.set(startMeters.x, startMeters.y);

		for (const ring of terrain.children) {
			/*const scale = ring.size / heightMapTotalWorldSize;
			const offsetX = (ring.position.x - ring.size / 2 - pivotPositionMeters.x) / heightMapTotalWorldSize;
			const offsetY = (ring.position.z - ring.size / 2 - pivotPositionMeters.y) / heightMapTotalWorldSize;

			ring.heightTextureTransform[0] = offsetX;
			ring.heightTextureTransform[1] = offsetY;
			ring.heightTextureTransform[2] = scale;*/

			const maskWorldSize = Config.TileSize * Config.TerrainWaterMaskResolution;
			const maskScale = ring.size / maskWorldSize;
			const maskOffsetX = (ring.position.x - ring.size / 2 - this.maskOriginMeters.x) / maskWorldSize;
			const maskOffsetY = (ring.position.z - ring.size / 2 - this.maskOriginMeters.y) / maskWorldSize;

			ring.maskTextureTransform[0] = maskOffsetX;
			ring.maskTextureTransform[1] = maskOffsetY;
			ring.maskTextureTransform[2] = maskScale;

			this.areaLoaders.water0.transformToArray(
				ring.position.x - ring.size / 2,
				ring.position.z - ring.size / 2,
				ring.size,
				ring.waterTextureTransform0
			);
			this.areaLoaders.water1.transformToArray(
				ring.position.x - ring.size / 2,
				ring.position.z - ring.size / 2,
				ring.size,
				ring.waterTextureTransform1
			);
			this.areaLoaders.height0.transformToArray(
				ring.position.x - ring.size / 2,
				ring.position.z - ring.size / 2,
				ring.size,
				ring.heightTextureTransform0
			);
		}
	}
}