import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Transpile only the TypeScript modules under test. This deliberately avoids
// starting Vite or any network listener, so these checks remain fully local.
const require = createRequire(import.meta.url);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = require('node:fs').readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { auditQuestion, buildVerifiedQuestions, explanationContradictsKey, findInSource } = require('../services/questionQuality.ts');

  const sources = [{
    kind: 'lei',
    title: 'Código Penal',
    url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm',
    text: 'Art. 155 - Subtrair, para si ou para outrem, coisa alheia móvel. Pena - reclusão, de um a quatro anos, e multa.',
    laws: [{
      label: 'Código Penal',
      numero: '155',
      text: 'Art. 155 - Subtrair, para si ou para outrem, coisa alheia móvel. Pena - reclusão, de um a quatro anos, e multa.',
    }],
  }];

  const validQuestion = {
    question: 'Qual conduta corresponde ao núcleo do crime de furto previsto no art. 155 do Código Penal?',
    options: [
      'Subtrair, para si ou para outrem, coisa alheia móvel',
      'Destruir coisa própria sem qualquer consequência jurídica',
      'Receber coisa alheia móvel por empréstimo autorizado',
      'Apropriar-se de imóvel abandonado sem violência',
    ],
    correctAnswer: 0,
    explanation: 'O art. 155 descreve a subtração, para si ou para outrem, de coisa alheia móvel.',
  };

  const validAudit = auditQuestion(validQuestion, sources, 4);
  assert.deepEqual(validAudit.problems, [], 'accepts a complete question with a source-supported citation');
  assert.deepEqual(validAudit.violations, [], 'keeps an explanation supported by the retrieved law');

  const duplicateOptions = auditQuestion({
    ...validQuestion,
    options: [validQuestion.options[0], validQuestion.options[0], validQuestion.options[2], validQuestion.options[3]],
  }, sources, 4);
  assert(duplicateOptions.problems.some((problem) => problem.includes('alternativas repetidas')),
    'rejects repeated options');

  const unsupportedCitation = auditQuestion({
    ...validQuestion,
    question: 'Qual conduta corresponde ao núcleo do crime de furto previsto no art. 999 do Código Penal?',
  }, sources, 4);
  assert(unsupportedCitation.violations.some((violation) => violation.where === 'stem' && violation.reason.includes('fora do texto')),
    'rejects a citation outside the retrieved statute');

  const swappedDoctrine = auditQuestion({
    ...validQuestion,
    explanation: 'O erro de tipo exclui a culpabilidade do agente.',
  }, sources, 4);
  assert(swappedDoctrine.violations.some((violation) => violation.reason.includes('conceito trocado')),
    'flags the known error-of-type versus culpability swap');

  assert.match(explanationContradictsKey({
    ...validQuestion,
    explanation: 'A alternativa B é a única correta.',
  }) ?? '', /gabarito é A/,
  'catches explanations that name a different answer key');

  assert.equal(findInSource('A subtração de coisa alheia móvel, para si ou para outrem.', 'SUBTRACAO de coisa alheia movel para si ou para outrem'),
    'subtração de coisa alheia móvel, para si ou para outrem',
  'matches literal evidence despite case, accents, and punctuation');

const officialCriminalCode = require('../public/vademecum/codigo-penal.json');
const originalFetch = globalThis.fetch;
let judgeCalls = 0;
globalThis.fetch = async (input) => {
  if (String(input).endsWith('/vademecum/codigo-penal.json')) {
    return new Response(JSON.stringify(officialCriminalCode), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error('The local quality test must not make network requests.');
};

try {
  const result = await buildVerifiedQuestions({
    topic: 'Direito Penal - furto',
    count: 1,
    optionCount: 4,
    Type: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', INTEGER: 'INTEGER', BOOLEAN: 'BOOLEAN', STRING: 'STRING' },
    generate: async () => [{
      question: 'Qual conduta corresponde ao núcleo do furto simples previsto no art. 155 do Código Penal?',
      options: [
        'Subtrair, para si ou para outrem, coisa alheia móvel',
        'Destruir coisa própria sem qualquer consequência jurídica',
        'Receber coisa alheia móvel por empréstimo autorizado',
        'Apropriar-se de imóvel abandonado sem violência',
      ],
      correctAnswer: 0,
      explanation: 'O tipo penal descreve a subtração de coisa alheia móvel. O texto oficial confirma essa definição no art. 155.',
    }],
    judge: async (_prompt, _schema, name) => {
      if (name === 'explanation_review') {
        return { results: [{ index: 0, keyWrong: false, claims: [
          { text: 'O tipo penal descreve a subtração de coisa alheia móvel.', verdict: 'correta', why: 'Compatível com o caput do artigo.', sentenceIndices: [0] },
          { text: 'O texto oficial confirma essa definição no art. 155.', verdict: 'correta', why: 'A definição foi localizada na fonte oficial.', sentenceIndices: [1] },
        ] }] };
      }
      judgeCalls += 1;
      return { results: [{
        index: 0,
        chosen: judgeCalls === 1 ? 0 : 3,
        ambiguous: false,
        evidence: 'Subtrair, para si ou para outrem, coisa alheia móvel',
        rationale: 'O caput descreve essa conduta.',
      }] };
    },
  });

  assert.equal(result.questions.length, 1, 'releases a question only after both answer checks and the explanation review');
  assert.equal(result.report.verified, 1, 'counts the fully verified explanation');
  assert.equal(judgeCalls, 2, 'performs both original-order and reversed-order answer checks');
  assert(result.report.timingsMs.total >= result.report.timingsMs.answerVerification,
    'includes stage timings within the total elapsed time');
  console.log('Question quality checks: 10 passed (including end-to-end verification).');
} finally {
  globalThis.fetch = originalFetch;
}
