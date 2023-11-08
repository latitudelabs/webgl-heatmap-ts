export default function checkTexture(
	gl: WebGLRenderingContext,
	targetType: number
) {
	const target = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, target);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, targetType, null);

	const hasNoError = gl.getError() === gl.NO_ERROR; // gl.NO_ERROR === 0
	// cleanup
	gl.deleteTexture(target);
	return hasNoError ? true : false;
}
