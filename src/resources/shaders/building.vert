#version 300 es
precision highp float;

in vec3 position;
in vec2 uv;
in uint display;

out vec2 vUv;
out vec3 vPosition;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

void main() {
	vUv = uv;

	vec3 transformedPosition = position;
	vec4 cameraSpacePosition = modelViewMatrix * vec4(transformedPosition, 1.0);

	vPosition = vec3(cameraSpacePosition);

	if(display > 0u) {
		gl_Position = vec4(2, 0, 0, 1);
		return;
	}

	gl_Position = projectionMatrix * cameraSpacePosition;
}