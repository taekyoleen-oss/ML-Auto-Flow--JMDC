// 전체 파이프라인 코드 검증 러너.
//
// 무엇을 하나:
//  1) verify/generate.ts 를 esbuild(Node API)로 번들 → .gen.cjs
//  2) verify/pipelines/*.json 픽스처마다:
//     - 픽스처를 hydrate하여 전체 파이프라인 Python 코드(.py) 생성
//     - 필요한 데이터셋 CSV를 임시 실행 디렉토리에 복사
//     - 실제 python으로 그 .py를 2회 실행
//     - (a) 두 번 모두 exit 0 (외부 실행 가능)
//     - (b) 정규화 후 stdout이 byte-identical (동일 결과 재현)
//  3) PASS/FAIL 요약 출력. 하나라도 실패하면 exit 1.
//
// 실행: node verify/run-verification.mjs   (또는 pnpm run verify:pipelines)
//
// 이 검증은 앱의 핵심 불변식("전체코드를 외부 Python에서 바로 실행하면 동일 결과")을
// 회귀 방지한다. 새 모듈/템플릿 추가 시 픽스처를 하나 추가하고 이 스크립트를 돌려라.

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// ── python 실행기 탐색 ───────────────────────────────────────────────────────
function pickPython() {
  for (const c of ['python', 'python3', 'py']) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return c;
  }
  return 'python';
}
const PY = pickPython();

// ── 파이썬 패키지 가용성 캐시 (없으면 해당 픽스처 SKIP) ──────────────────────
const _pkgCache = new Map();
function pyHasModule(mod) {
  if (_pkgCache.has(mod)) return _pkgCache.get(mod);
  const r = spawnSync(PY, ['-c', `import ${mod}`], { encoding: 'utf8' });
  const ok = !r.error && r.status === 0;
  _pkgCache.set(mod, ok);
  return ok;
}

// ── 데이터셋 탐색 경로 ───────────────────────────────────────────────────────
const DATA_DIRS = [
  path.join(ROOT, 'Examples_in_Load'),
  path.join(__dirname, 'datasets'),
  path.join(ROOT, 'samples'),
];
function findDataset(name) {
  for (const d of DATA_DIRS) {
    const p = path.join(d, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── 재현성 비교용 정규화(무해한 비결정 요소 제거) ────────────────────────────
function normalize(s) {
  return (s || '')
    .replace(/\r\n/g, '\n')
    .replace(/0x[0-9A-Fa-f]+/g, '0xADDR') // 객체 주소
    .split('\n')
    .filter((l) => !/^\s*(Date|Time)\s*:/.test(l)) // statsmodels summary의 날짜/시간
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .trimEnd();
}

function tail(s, n = 18) {
  const lines = (s || '').split('\n');
  return lines.slice(Math.max(0, lines.length - n)).join('\n');
}

// ── 1) generate.ts 번들 ──────────────────────────────────────────────────────
const esbuild = require(path.join(ROOT, 'node_modules', 'esbuild'));
const genCjs = path.join(__dirname, '.gen.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'generate.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: genCjs,
  logLevel: 'silent',
});

// ── 2) 픽스처별 검증 ─────────────────────────────────────────────────────────
const pipelinesDir = path.join(__dirname, 'pipelines');
const fixtures = fs.existsSync(pipelinesDir)
  ? fs.readdirSync(pipelinesDir).filter((f) => f.endsWith('.json')).sort()
  : [];

if (fixtures.length === 0) {
  console.error('검증할 픽스처가 없습니다: verify/pipelines/*.json');
  process.exit(1);
}

console.log(`\n전체코드 실행/재현성 검증  (python=${PY}, 픽스처 ${fixtures.length}개)\n`);

let pass = 0;
let skip = 0;
const results = [];

for (const fx of fixtures) {
  const fixturePath = path.join(pipelinesDir, fx);
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  // 픽스처가 요구하는 파이썬 패키지가 없으면 SKIP (FAIL 아님)
  const missing = (fixture.requires || []).filter((m) => !pyHasModule(m));
  if (missing.length) {
    skip++;
    results.push({ fx, ok: true, skipped: true, info: `SKIP (미설치: ${missing.join(', ')})` });
    console.log(`  ⏭️  SKIP  ${fx}  (미설치: ${missing.join(', ')})`);
    continue;
  }

  const ld = (fixture.modules || []).find((m) => m.type === 'LoadData');
  const dsName = ld?.parameters?.source;
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mlverify-'));
  let ok = false;
  let info = '';
  try {
    if (dsName) {
      const dp = findDataset(dsName);
      if (!dp) throw new Error(`데이터셋을 찾을 수 없음: ${dsName} (Examples_in_Load/verify/datasets 확인)`);
      fs.copyFileSync(dp, path.join(runDir, dsName));
    }
    const pyPath = path.join(runDir, 'pipeline.py');
    const g = spawnSync('node', [genCjs, fixturePath, pyPath], { encoding: 'utf8' });
    if (g.status !== 0) throw new Error(`코드 생성 실패: ${tail(g.stderr)}`);

    const env = { ...process.env, MPLBACKEND: 'Agg', PYTHONIOENCODING: 'utf-8' };
    const r1 = spawnSync(PY, ['pipeline.py'], { cwd: runDir, encoding: 'utf8', env });
    if (r1.status !== 0) throw new Error(`run1 exit=${r1.status}\n${tail(r1.stderr)}`);
    const r2 = spawnSync(PY, ['pipeline.py'], { cwd: runDir, encoding: 'utf8', env });
    if (r2.status !== 0) throw new Error(`run2 exit=${r2.status}\n${tail(r2.stderr)}`);

    if (normalize(r1.stdout) !== normalize(r2.stdout)) {
      throw new Error('비재현(run1 != run2): 두 번 실행 결과가 다름');
    }
    ok = true;
    const nLines = (r1.stdout.match(/\n/g) || []).length;
    info = `실행 OK · 재현 OK · stdout ${nLines}줄`;
  } catch (e) {
    info = e.message;
  } finally {
    fs.rmSync(runDir, { recursive: true, force: true });
  }
  results.push({ fx, ok, info });
  if (ok) pass++;
  console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'}  ${fx}`);
  if (!ok) console.log(`         ${info.split('\n').join('\n         ')}`);
}

fs.rmSync(genCjs, { force: true });

const fail = results.filter((r) => !r.ok && !r.skipped).length;
const ran = results.length - skip;
console.log(`\n결과: ${pass}/${ran} PASS${fail ? `, ${fail} FAIL` : ''}${skip ? `, ${skip} SKIP` : ''}\n`);
process.exit(fail ? 1 : 0);
