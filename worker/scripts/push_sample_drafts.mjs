/**
 * Envia questões de exemplo para o Firestore, no MESMO formato que
 * worker/scripts/push_drafts.py produz, para testar a tela de Revisão sem
 * precisar de um PDF real.
 *
 * Usa o Admin SDK (igual ao worker Python) — não depende das Security
 * Rules, então funciona mesmo com `question_drafts`/`imports` fechados
 * para escrita via cliente (allow create: if false).
 *
 * Uso:
 *   node worker/scripts/push_sample_drafts.mjs --credentials /caminho/service-account.json
 */

import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const credentialsFlagIndex = args.indexOf('--credentials');
const credentialsPath = credentialsFlagIndex !== -1 ? args[credentialsFlagIndex + 1] : null;
if (!credentialsPath) {
  console.error('Uso: node worker/scripts/push_sample_drafts.mjs --credentials /caminho/service-account.json');
  process.exit(1);
}

// Mesma fonte usada pelo dedup em push_drafts.py: manter "sample" separado
// de "fc_concursos" garante que dados de teste nunca colidem (nem
// dão falso positivo de duplicata) com questões reais importadas.
const SOURCE = 'sample';

const normalizeForHash = (text) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos, espelha o unicodedata+ascii do Python
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const contentHash = (statement) => createHash('sha256').update(normalizeForHash(statement), 'utf8').digest('hex');

const toAlternatives = (options, correctLetter) =>
  options.map((opt, i) => ({
    letter: opt.letter,
    text: opt.text,
    isCorrect: opt.letter === correctLetter,
    position: i,
  }));

const rawSamples = [
  {
    externalId: 'sample-1',
    number: 1,
    subjectRaw: 'Direito Constitucional',
    topicRaw: 'Direitos e Garantias Fundamentais',
    statement:
      'A Constituição Federal de 1988 estabelece que todos são iguais perante a lei. Sobre os direitos e garantias fundamentais, assinale a alternativa CORRETA:',
    options: [
      { letter: 'A', text: 'É livre a manifestação do pensamento, sendo permitido o anonimato.' },
      { letter: 'B', text: 'É assegurado o direito de resposta, proporcional ao agravo, além da indenização por dano material, moral ou à imagem.' },
      { letter: 'C', text: 'É inviolável a liberdade de consciência e de crença, não sendo assegurado o livre exercício dos cultos religiosos.' },
      { letter: 'D', text: 'A lei poderá estabelecer censura de natureza política, ideológica e artística.' },
      { letter: 'E', text: 'É assegurada a prestação de assistência religiosa nas entidades civis, exceto nas militares.' },
    ],
    correctLetter: 'B',
    explanation: 'Questão de exemplo — texto de explicação de teste.',
    sourcePage: 1,
    warnings: [],
  },
  {
    externalId: 'sample-2',
    number: 2,
    subjectRaw: 'Direito Administrativo',
    topicRaw: 'Princípios da Administração Pública',
    statement: 'Sobre os princípios da Administração Pública previstos no artigo 37 da CF/88, é INCORRETO afirmar que:',
    options: [
      { letter: 'A', text: 'A legalidade impõe à Administração Pública agir somente conforme a lei.' },
      { letter: 'B', text: 'A impessoalidade proíbe a promoção pessoal de agentes públicos em atos oficiais.' },
      { letter: 'C', text: 'A moralidade administrativa é um princípio exclusivamente doutrinário, sem previsão constitucional.' },
      { letter: 'D', text: 'A publicidade é requisito de eficácia dos atos administrativos.' },
      { letter: 'E', text: 'A eficiência foi incluída pela Emenda Constitucional nº 19/1998.' },
    ],
    correctLetter: 'C',
    explanation: 'Questão de exemplo — texto de explicação de teste.',
    sourcePage: 2,
    warnings: [],
  },
  {
    externalId: 'sample-3',
    number: 3,
    subjectRaw: 'Língua Portuguesa',
    topicRaw: 'Concordância Verbal',
    statement: 'Assinale a alternativa em que a concordância verbal está CORRETA:',
    options: [
      { letter: 'A', text: 'Fazem dois anos que não viajo.' },
      { letter: 'B', text: 'Houveram muitos acidentes na estrada.' },
      { letter: 'C', text: 'Existem, naquela cidade, muitos problemas sociais.' },
      { letter: 'D', text: 'Aluga-se casas neste bairro.' },
      { letter: 'E', text: 'Haviam pessoas na fila desde cedo.' },
    ],
    correctLetter: 'C',
    explanation: 'Questão de exemplo com aviso — usada pra testar o selo "precisa de revisão".',
    sourcePage: 3,
    warnings: ['Verificar formatação da alternativa D'],
  },
];

const sampleQuestions = rawSamples.map((q) => ({
  source: SOURCE,
  externalId: q.externalId,
  number: q.number,
  questionType: 'multipla_escolha',
  subjectRaw: q.subjectRaw,
  topicRaw: q.topicRaw,
  statement: q.statement,
  alternatives: toAlternatives(q.options, q.correctLetter),
  correctLetter: q.correctLetter,
  explanation: q.explanation,
  sourcePage: q.sourcePage,
  contentHash: contentHash(q.statement),
  status: q.warnings.length ? 'needs_attention' : 'pending_review',
  warnings: q.warnings,
}));

async function main() {
  initializeApp({ credential: cert(credentialsPath) });
  const db = getFirestore();

  const importId = randomUUID();
  await db.collection('imports').doc(importId).set({
    source: SOURCE,
    title: 'Simulado de Exemplo (3 questões)',
    ownerName: 'Admin Local',
    ownerEmail: 'admin@exemplo.com',
    generatedAt: new Date().toISOString(),
    bloco: 'Bloco de teste',
    totalQuestions: sampleQuestions.length,
    newQuestions: sampleQuestions.length,
    duplicateQuestions: 0,
    importedAt: FieldValue.serverTimestamp(),
    importedBy: 'local-dev',
  });

  const batch = db.batch();
  for (const q of sampleQuestions) {
    const docId = `${q.source}_${q.externalId}`;
    batch.set(db.collection('question_drafts').doc(docId), { ...q, importId });
  }
  await batch.commit();

  console.log(`Import criado: imports/${importId}`);
  console.log(`${sampleQuestions.length} questões enviadas para question_drafts`);
  console.log('Abra a tela de Revisão no app para ver.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  });
