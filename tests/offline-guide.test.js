import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/offline-guide.ts", import.meta.url), "utf8");
const datasetSource = await readFile(new URL("../src/health-dataset.ts", import.meta.url), "utf8");
const compiledDataset = ts.transpileModule(datasetSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const datasetUrl = `data:text/javascript;base64,${Buffer.from(compiledDataset).toString("base64")}`;
const sourceWithDataset = source.replace('"./health-dataset"', JSON.stringify(datasetUrl));
const compiled = ts.transpileModule(sourceWithDataset, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { offlineGuideReply, offlineGuideTopics } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("offline health guide covers common questions without a remote AI service", () => {
  assert.ok(offlineGuideTopics.length >= 15);
  assert.match(offlineGuideReply("How can I prepare for a doctor visit?"), /write down/i);
  assert.match(offlineGuideReply("What can I do about a cough?"), /many causes/i);
  assert.match(offlineGuideReply("What should I ask the pharmacist about medicine?"), /licensed pharmacist/i);
  assert.match(offlineGuideReply("What are some healthy daily habits?"), /movement/i);
});

test("offline health guide puts emergency escalation before other answers", () => {
  const reply = offlineGuideReply("I have a cough and cannot breathe");
  assert.match(reply, /emergency/i);
  assert.match(reply, /does not monitor chats or dispatch help/i);
  assert.match(offlineGuideReply("I have a sudden severe headache"), /emergency/i);
});

test("curated dataset answers malaria, typhoid, diarrhoea and headache with prevention and care", () => {
  for (const [question, source] of [
    ["How do I prevent malaria and what treats it?", /WHO: Malaria/i],
    ["Can typhoid be cured and prevented?", /WHO: Typhoid/i],
    ["What should I do about diarrhoea?", /WHO: Diarrhoeal disease/i],
    ["How do I prevent headaches?", /NHS: Headaches/i],
  ]) {
    const reply = offlineGuideReply(question);
    assert.match(reply, /Prevention:/i, `Missing dataset match for: ${question}`);
    assert.match(reply, /Treatment and next step:/i);
    assert.match(reply, /Seek urgent help:/i);
    assert.match(reply, source);
  }
  const malaria = offlineGuideReply("malaria cure");
  assert.match(malaria, /test/i);
  assert.match(malaria, /cannot choose a medicine or dose/i);
  const typhoid = offlineGuideReply("typhoid medicine");
  assert.match(typhoid, /resistance to antibiotics is common/i);
});

test("unknown topics receive a safe scope and care fallback", () => {
  const reply = offlineGuideReply("Can you tell me what this rare condition means?");
  assert.match(reply, /don’t have a specific answer/i);
  assert.match(reply, /licensed clinician or pharmacist/i);
  assert.match(reply, /does not diagnose, prescribe/i);
});
