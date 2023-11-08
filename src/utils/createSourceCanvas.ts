export default function createSourceCanvas() {
	const canvas = document.createElement("canvas");
	canvas.width = 2;
	canvas.height = 2;

	const ctx = canvas.getContext("2d");
	if (ctx) {
		const imageData = ctx.getImageData(0, 0, 2, 2);
		imageData.data.set(
			new Uint8ClampedArray([
				0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255,
			])
		);
		ctx.putImageData(imageData, 0, 0);
	}

	return canvas;
}
