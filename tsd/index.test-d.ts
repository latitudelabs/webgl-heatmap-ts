import { expectType } from "tsd";
import "../declaration";
import WebGLHeatmap from "../src/WebGLHeatmap";
import Node from "../src/Node";
import createWebGLHeatmap from "../index";

const canvas = document.createElement("canvas");
const heatmap = createWebGLHeatmap({ canvas, width: 100, height: 100 });

expectType<WebGLHeatmap>(heatmap);
expectType<number>(heatmap.addPoint(0, 0, 1));
expectType<number[]>(
	heatmap.addPoints([{ x: 0, y: 0, size: 1, intensity: 0.75 }])
);
expectType<void>(heatmap.update());
expectType<Node>(heatmap.multiply(0.95));
expectType<Node>(heatmap.clamp(0, 1));
expectType<Node>(heatmap.blur());
