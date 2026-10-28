import { buildFragment, VERT } from "./transition-shaders";
import type { ShaderTransition } from "./shader-transitions";

const uniformNames = [
  "uTex0", "uTex1", "uRes", "uTime", "uProgress", "uRaw", "uAspect0", "uAspect1",
  "uLod0", "uLod1", "uBpm", "uBeatMode", "uCenter", "uP", "uP2", "uQ", "uF", "uC",
] as const;
type Program = {
  program: WebGLProgram;
  uniforms: Record<(typeof uniformNames)[number], WebGLUniformLocation | null>;
};

/** One lazily created context per sequence, shared by preview and video export. */
export function createShaderTransitionRenderer(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext("webgl2", {
    alpha: false, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return undefined;
  const programs = new Map<string, Program>();
  const failed = new Set<string>();
  const buffer = gl.createBuffer();
  const textures = [gl.createTexture(), gl.createTexture()];
  let disposed = false;
  const lost = (event: Event) => event.preventDefault();
  const restored = () => {
    // Old handles are invalid after restoration; the owner will use its fallback.
    disposed = true;
  };
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  for (const texture of textures) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function buildProgram(kind: string): Program {
    const shaders: WebGLShader[] = [];
    const program = gl!.createProgram()!;
    try {
      for (const [type, source] of [
        [gl!.VERTEX_SHADER, VERT], [gl!.FRAGMENT_SHADER, buildFragment(kind)],
      ] as const) {
        const shader = gl!.createShader(type)!;
        shaders.push(shader);
        gl!.shaderSource(shader, source);
        gl!.compileShader(shader);
        if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS))
          throw new Error(gl!.getShaderInfoLog(shader) ?? "Shader compilation failed");
        gl!.attachShader(program, shader);
      }
      gl!.bindAttribLocation(program, 0, "aPos");
      gl!.linkProgram(program);
      if (!gl!.getProgramParameter(program, gl!.LINK_STATUS))
        throw new Error(gl!.getProgramInfoLog(program) ?? "Shader linking failed");
      const uniforms = Object.fromEntries(uniformNames.map((name) =>
        [name, gl!.getUniformLocation(program, name)],
      )) as Program["uniforms"];
      return { program, uniforms };
    } catch (error) {
      gl!.deleteProgram(program);
      throw error;
    } finally {
      shaders.forEach((shader) => gl!.deleteShader(shader));
    }
  }

  return {
    draw(
      ctx: CanvasRenderingContext2D,
      from: HTMLCanvasElement,
      to: HTMLCanvasElement,
      effect: ShaderTransition,
      raw: number,
      progress: number,
      time: number,
    ): boolean {
      if (disposed || gl.isContextLost() || failed.has(effect.kind)) return false;
      try {
        let entry = programs.get(effect.kind);
        if (!entry) {
          entry = buildProgram(effect.kind);
          programs.set(effect.kind, entry);
        }
        const { program, uniforms: u } = entry;
        gl.useProgram(program);
        gl.viewport(0, 0, width, height);
        gl.uniform1i(u.uTex0, 0);
        gl.uniform1i(u.uTex1, 1);
        gl.uniform2f(u.uRes, width, height);
        gl.uniform1f(u.uTime, time);
        gl.uniform1f(u.uProgress, progress);
        gl.uniform1f(u.uRaw, raw);
        gl.uniform1f(u.uAspect0, from.width / from.height);
        gl.uniform1f(u.uAspect1, to.width / to.height);
        gl.uniform1f(u.uLod0, 0);
        gl.uniform1f(u.uLod1, 0);
        gl.uniform1f(u.uBpm, 120);
        gl.uniform1f(u.uBeatMode, effect.beat);
        gl.uniform2f(u.uCenter, 0.5, 0.5);
        gl.uniform4fv(u.uP, effect.P);
        gl.uniform4fv(u.uP2, effect.P2);
        gl.uniform4fv(u.uQ, effect.Q);
        gl.uniform4fv(u.uF, effect.F);
        gl.uniform3fv(u.uC, effect.C);
        // Surfaces include animated layers, videos and captions at this exact time.
        for (const [i, surface] of [from, to].entries()) {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, textures[i]);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, surface);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) return false;
        ctx.drawImage(canvas, 0, 0);
        return true;
      } catch (error) {
        failed.add(effect.kind);
        console.warn(`Transition “${effect.kind}” unavailable; using crossfade.`, error);
        return false;
      }
    },
    dispose() {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      programs.forEach(({ program }) => gl.deleteProgram(program));
      programs.clear();
      textures.forEach((texture) => gl.deleteTexture(texture));
      gl.deleteBuffer(buffer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.width = canvas.height = 1;
    },
  };
}
