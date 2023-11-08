export default function checkColorBuffer(
	gl: WebGLRenderingContext,
	targetType: number
) {
	const target = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, target);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, targetType, null);
	const framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(
		gl.FRAMEBUFFER,
		gl.COLOR_ATTACHMENT0,
		gl.TEXTURE_2D,
		target,
		0
	);
	const check = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

	// cleanup
	gl.deleteTexture(target);
	gl.deleteFramebuffer(framebuffer);
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return check === gl.FRAMEBUFFER_COMPLETE ? true : false;
}
