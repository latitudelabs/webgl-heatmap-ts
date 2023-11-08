import test from "ava";
import { HTMLCanvasElement } from "@playcanvas/canvas-mock";
import createWebGLHeatmap from "../lib/index.js";

const width = 100;
const height = 100;

test.after(() => {
	document.querySelectorAll("canvas").forEach((canvas) => {
		canvas.remove();
	});
});

test("check WebGL support", (t) => {
	try {
		const canvas = new HTMLCanvasElement(width, height);
		createWebGLHeatmap({ canvas, width, height });
		t.pass("WebGL is supported");
	} catch (error) {
		t.is(error, "WebGL not supported", "cannot create WebGL context");
	}
});

test("params are correctly passed", (t) => {
	const canvas = new HTMLCanvasElement(width, height);
	const heatmap = createWebGLHeatmap({ canvas, width, height });

	t.is(heatmap.height, height);
	t.is(heatmap.width, width);
});

test("can add single point", (t) => {
	const canvas = new HTMLCanvasElement(width, height);
	const heatmap = createWebGLHeatmap({ canvas, width, height });

	const intensity = 0.95;

	const p1 = heatmap.addPoint(0, 0, 1, intensity);
	t.is(p1, 1, "point count is 1");

	const p2 = heatmap.addPoint(0, 1, 0.75, intensity);
	t.is(p2, 2, "point count is 2");
});

test("can add multiple points using addPoints", (t) => {
	const canvas = new HTMLCanvasElement(width, height);
	const heatmap = createWebGLHeatmap({ canvas, width, height });

	const intensity = 0.95;
	const point1 = { x: 0, y: 0, size: 1, intensity };
	const point2 = { x: 0, y: 1, size: 0.75, intensity };

	const ps1 = heatmap.addPoints([point1]);
	t.is(ps1.length, 1, "added 1 point object");
	t.is(ps1[0], 1);

	const ps2 = heatmap.addPoints([point1, point2]);
	t.is(ps2.length, 2, "added 2 new points objects");
	t.deepEqual(ps2, [2, 3], "addPoints returns correct point ids");
});
