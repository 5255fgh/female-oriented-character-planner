import "./styles.css";

const app = document.querySelector("#app");
const model = import.meta.env.VITE_LLM_MODEL || "deepseek-v4-flash";

const heading = document.createElement("h1");
heading.textContent = "女性向角色策划与猫箱输入包生成器";

const environmentStatus = document.createElement("p");
environmentStatus.className = "status";
environmentStatus.textContent = "基础环境可用";

const modelLabel = document.createElement("p");
modelLabel.className = "model";
modelLabel.textContent = `当前 VITE_LLM_MODEL：${model}`;

const smokeButton = document.createElement("button");
smokeButton.type = "button";
smokeButton.textContent = "运行 mock smoke";

smokeButton.addEventListener("click", async () => {
  smokeButton.disabled = true;
  smokeButton.textContent = "mock smoke 运行中…";

  try {
    const [{ createMockLLMClient }, contracts] = await Promise.all([
      import("./mock/mock-llm-client.js"),
      import("./contracts.js"),
    ]);
    const client = createMockLLMClient();
    const [concepts, simulation, pack] = await Promise.all([
      client.completeJson({ task: "concept-generation", messages: [] }),
      client.completeJson({ task: "dialogue-evaluation", messages: [] }),
      client.completeJson({ task: "maoxiang-free-character", messages: [] }),
    ]);

    contracts.assertConceptCandidates(concepts);
    contracts.assertSimulationReport(simulation);
    contracts.assertPlatformPack(pack);

    const characterPrompt = pack.blocks.find(
      (block) => block.id === "characterPrompt",
    );
    const original = { publicInfo: { name: "原始名称" } };
    const patched = contracts.applyFieldPatch(original, {
      fieldPath: "publicInfo.name",
      value: "更新名称",
    });
    const passed =
      concepts.length === 3 &&
      simulation.scenarios.length === 8 &&
      characterPrompt &&
      contracts.countUnicodeCharacters(characterPrompt.text) <= 1000 &&
      original.publicInfo.name === "原始名称" &&
      patched.publicInfo.name === "更新名称";

    if (!passed) {
      throw new Error("mock smoke 结果不符合基础契约");
    }

    smokeButton.textContent = "mock smoke 已通过";
  } catch (error) {
    console.error(error);
    smokeButton.textContent = "mock smoke 失败";
  } finally {
    smokeButton.disabled = false;
  }
});

app.append(heading, environmentStatus, modelLabel, smokeButton);
