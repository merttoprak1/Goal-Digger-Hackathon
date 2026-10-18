import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const modelDirectory = join(homedir(), ".qvac", "models");
const downloadedModel =
  process.env.QVAC_MODEL_PATH ||
  (() => {
    const file = readdirSync(modelDirectory).find((name) =>
      name.endsWith("Qwen3.5-2B-Q4_K_M.gguf"),
    );
    if (!file) throw new Error("Set QVAC_MODEL_PATH to the downloaded Qwen GGUF file.");
    return join(modelDirectory, file);
  })();
const projectionModelSrc = process.env.QVAC_PROJECTION_MODEL_PATH;

export default {
  serve: {
    models: {
      "goal-digger": {
        src: downloadedModel,
        type: "llm",
        preload: true,
        config: {
          ctx_size: 8192,
          ...(projectionModelSrc ? { projectionModelSrc } : {}),
        },
      },
    },
  },
};
