import {RendererTypes} from "~/lib/renderer/RendererTypes";

export interface AbstractAttributeParams {
	name: string;
	size: number;
	type: RendererTypes.AttributeType;
	format: RendererTypes.AttributeFormat;
	usage?: RendererTypes.BufferUsage;
	normalized: boolean;
	instanced?: boolean;
	divisor?: number;
	stride?: number;
	offset?: number;
	data?: TypedArray;
}

export default interface AbstractAttribute {
	name: string;
	size: number;
	type: RendererTypes.AttributeType;
	format: RendererTypes.AttributeFormat;
	usage: RendererTypes.BufferUsage;
	normalized: boolean;
	instanced: boolean;
	divisor: number;
	stride: number;
	offset: number;
	data: TypedArray;
	setData(data: TypedArray): void;
}