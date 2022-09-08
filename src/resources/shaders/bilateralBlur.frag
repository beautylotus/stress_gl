#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
precision highp usampler2D;

#define KERNEL_RADIUS 4.

out vec4 FragColor;

in vec2 vUv;

uniform sampler2D tColor;
uniform sampler2D tDepth;

uniform MainBlock {
	mat4 projectionMatrixInverse;
	vec2 direction;
};

#include <reconstructPositionFromDepth>

float getDepth(float offset, vec2 resolution) {
	return -texture(tDepth, vUv + offset * direction / resolution).z;
}

float getDepth2(float offset, vec2 resolution) {
	vec2 uv = vUv + offset * direction / resolution;
	return -reconstructPositionFromDepth(uv, texture(tDepth, uv).r, projectionMatrixInverse).z;
}

vec4 getColor(float offset, vec2 resolution) {
	return texture(tColor, vUv + offset * direction / resolution);
}

float crossBilateralWeight(float r, float z, float z0) {
	const float BlurSigma = (KERNEL_RADIUS + 1.) * 0.5;
	const float BlurFalloff = 1. / (2. * BlurSigma*BlurSigma);

	float dz = z0 - z;
	return exp2(-r * r * BlurFalloff - dz * dz);
}

void main() {
	vec2 texSize = vec2(textureSize(tColor, 0));
	float centerDepth = getDepth2(0., texSize);
	vec4 totalColor = getColor(0., texSize);

	float scale = clamp(totalColor.r * 2. + 0.5, 0., 2.);

	if (vUv.x > 0.5) {
		scale = 1.;
	}

	float totalWeight = crossBilateralWeight(0., centerDepth, centerDepth);

	for (float i = 1.; i <= KERNEL_RADIUS; i++) {
		float j = i * scale;

		float w = crossBilateralWeight(j, getDepth2(j, texSize), centerDepth);
		totalColor += getColor(j, texSize) * w;
		totalWeight += w;

		w = crossBilateralWeight(j, getDepth2(-j, texSize), centerDepth);
		totalColor += getColor(-j, texSize) * w;
		totalWeight += w;
	}

	FragColor = totalColor / totalWeight;
}