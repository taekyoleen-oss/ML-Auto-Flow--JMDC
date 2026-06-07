// 검증용 전체코드 생성 엔트리.
// 저장 파이프라인 픽스처(.json)를 앱과 동일하게 hydrate하여
// generateFullPipelineCode로 외부 실행용 Python 코드를 생성한다.
//
// 사용: node <bundled>.cjs <fixture.json> <out.py>
import { generateFullPipelineCode } from '../utils/generatePipelineCode';
import { DEFAULT_MODULES } from '../constants';
import * as fs from 'fs';

const fixturePath = process.argv[2];
const outPath = process.argv[3];
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const defByType = new Map<string, any>();
for (const d of DEFAULT_MODULES as any[]) defByType.set(d.type, d);

// 앱의 로드 동작과 동일: 저장 모듈에 DEFAULT_MODULES의 outputs/inputs/기본 파라미터를 병합
const modules = fixture.modules.map((m: any, i: number) => {
  const def = defByType.get(m.type) || {};
  return {
    id: 'm' + i,
    name: m.name || m.type,
    position: m.position || { x: 0, y: 0 },
    type: m.type,
    parameters: { ...(def.parameters || {}), ...(m.parameters || {}) },
    inputs: (def.inputs || []).map((p: any) => ({ ...p })),
    outputs: (def.outputs || []).map((p: any) => ({ ...p })),
    outputData: m.outputData,
  };
});

// 저장 포맷의 인덱스 기반 연결을 앱 내부의 id 기반 연결로 변환
const connections = fixture.connections.map((c: any, i: number) => ({
  id: 'c' + i,
  from: { moduleId: 'm' + c.fromModuleIndex, portName: c.fromPort },
  to: { moduleId: 'm' + c.toModuleIndex, portName: c.toPort },
}));

const code = generateFullPipelineCode(modules as any, connections as any, false);
fs.writeFileSync(outPath, code);
process.stdout.write(`generated ${code.split('\n').length} lines\n`);
