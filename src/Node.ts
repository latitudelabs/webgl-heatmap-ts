import Texture from "./Texture";
import Framebuffer from "./Framebuffer";

export default class Node {
	private texture: Texture;
	private fbo: Framebuffer;

	constructor(
		private gl: WebGLRenderingContext,
		private width: number,
		private height: number
	) {
		const floatExt = this.gl.getFloatExtension({
			require: ["renderable"],
		});

		this.texture = new Texture(this.gl, {
			type: floatExt?.type ? floatExt.type : undefined,
		})
			.bind(0)
			.setSize(this.width, this.height)
			.nearest()
			.clampToEdge();

		this.fbo = new Framebuffer(this.gl).bind().color(this.texture).unbind();
	}

	use() {
		return this.fbo.bind();
	}

	bind(unit: number) {
		return this.texture.bind(unit);
	}

	end() {
		return this.fbo.unbind();
	}

	resize(width: number, height: number) {
		this.width = width;
		this.height = height;
		return this.texture.bind(0).setSize(this.width, this.height);
	}
}
