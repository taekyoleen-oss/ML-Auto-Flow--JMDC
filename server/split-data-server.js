/**
 * Node.js Express 서버 - SplitData API & PPT 생성 API
 * Pyodide가 타임아웃되거나 실패할 때 사용하는 백엔드 서버
 */

import express from 'express';
import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import samplesRouter from './routes/samples.js';
import db from './db/samples-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.SERVER_PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 루트 요청 처리 — 브라우저로 접속 시 앱(3001) 안내, API 클라이언트는 Accept: application/json 시 JSON
app.get('/', (req, res) => {
  const wantsJson = /application\/json/i.test(req.get('accept') || '');
  if (wantsJson) {
    res.status(200).json({ ok: true, service: 'ML Auto Flow API', port: PORT });
    return;
  }
  res.set('Content-Type', 'text/html; charset=utf-8').status(200).send(`
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>ML Auto Flow API</title></head>
<body style="font-family: sans-serif; padding: 2rem; max-width: 480px;">
  <h1>ML Auto Flow API</h1>
  <p>이 주소(포트 ${PORT})는 <strong>API 서버</strong>입니다. 앱 화면은 아래에서 열어주세요.</p>
  <p><a href="http://localhost:3003" style="font-size: 1.1rem;">→ ML Auto Flow 앱 열기 (http://localhost:3003)</a></p>
</body></html>`);
});

// Chrome DevTools가 요청하는 경로 처리 (404 방지)
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

// 샘플 관리 API 라우트 (Supabase 사용 시 미사용 가능, better-sqlite3 없으면 503)
app.use('/api/samples', samplesRouter);

app.post('/api/split-data', async (req, res) => {
    try {
        const { data, train_size, random_state, shuffle, stratify, stratify_column } = req.body;

        // Python 스크립트 실행
        const pythonScript = `
import sys
import json
import traceback
from sklearn.model_selection import train_test_split
import pandas as pd

try:
    # sklearn의 train_test_split을 사용하여 데이터를 분할합니다.
    input_data = json.loads(sys.stdin.read())
    dataframe = pd.DataFrame(input_data['data'])
    
    # DataFrame 인덱스를 명시적으로 0부터 시작하도록 리셋
    dataframe.index = range(len(dataframe))
    
    # Parameters from UI
    p_train_size = float(input_data['train_size'])
    p_random_state = int(input_data['random_state'])
    p_shuffle = bool(input_data['shuffle'])
    p_stratify = bool(input_data.get('stratify', False))
    p_stratify_column = input_data.get('stratify_column', None)
    
    # Stratify 배열 준비
    stratify_array = None
    if p_stratify and p_stratify_column and p_stratify_column != 'None' and p_stratify_column is not None:
        if p_stratify_column not in dataframe.columns:
            raise ValueError(f"Stratify column '{p_stratify_column}' not found in DataFrame")
        stratify_array = dataframe[p_stratify_column]
    
    # 데이터 분할
    train_data, test_data = train_test_split(
        dataframe,
        train_size=p_train_size,
        random_state=p_random_state,
        shuffle=p_shuffle,
        stratify=stratify_array
    )
    
    result = {
        'train_indices': train_data.index.tolist(),
        'test_indices': test_data.index.tolist(),
        'train_count': len(train_data),
        'test_count': len(test_data)
    }
    
    print(json.dumps(result))
except Exception as e:
    error_info = {
        'error': True,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'error_traceback': ''.join(traceback.format_exception(type(e), e, e.__traceback__))
    }
    print(json.dumps(error_info), file=sys.stderr)
    sys.exit(1)
`;

        const pythonProcess = spawn('python', ['-c', pythonScript], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        const inputData = JSON.stringify({
            data,
            train_size: parseFloat(train_size),
            random_state: parseInt(random_state),
            shuffle: shuffle === true || shuffle === 'True',
            stratify: stratify === true || stratify === 'True',
            stratify_column: stratify_column || null
        });

        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
        });

        // Promise로 래핑하여 비동기 처리
        await new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('Python error:', error);
                    try {
                        // stderr에서 에러 정보 파싱 시도
                        const errorInfo = JSON.parse(error);
                        if (errorInfo.error) {
                            return reject(new Error(`Python execution failed: ${errorInfo.error_message || error}`));
                        }
                    } catch {
                        // JSON 파싱 실패 시 원본 에러 사용
                    }
                    return reject(new Error(`Python execution failed with code ${code}: ${error || output}`));
                }

                try {
                    const result = JSON.parse(output);
                    res.status(200).json(result);
                    resolve();
                } catch (e) {
                    console.error('JSON parse error:', e);
                    reject(new Error(`Failed to parse Python output: ${output}`));
                }
            });

            pythonProcess.on('error', (err) => {
                console.error('Python process error:', err);
                reject(new Error(`Failed to start Python process: ${err.message}`));
            });

            pythonProcess.stdin.write(inputData);
            pythonProcess.stdin.end();
        });

    } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// PPT 생성 API
const execAsync = promisify(exec);
app.post('/api/generate-ppts', async (req, res) => {
  // 에러 발생 시 항상 응답을 보내도록 보장
  let responseSent = false;
  
  const sendErrorResponse = (error, statusCode = 500) => {
    if (!responseSent && !res.headersSent) {
      responseSent = true;
      try {
        res.status(statusCode).json({
          success: false,
          error: error.message || 'Unknown error',
          details: error.stack || 'No stack trace available',
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } catch (jsonError) {
        console.error('JSON 응답 전송 실패:', jsonError);
        if (!res.headersSent) {
          res.status(statusCode).send(`PPT 생성 오류: ${error.message || 'Unknown error'}`);
        }
      }
    }
  };
  
  try {
    const { projectData } = req.body;

    if (!projectData || !projectData.modules) {
      return res.status(400).json({ error: 'Missing projectData or modules' });
    }

    // 임시 파일로 저장
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(tempDir, `project_${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(projectData, null, 2), 'utf-8');

    // Python 스크립트 경로
    const scriptPath = path.join(__dirname, '..', 'scripts', 'generate_module_ppts.py');
    
    // 스크립트 파일 존재 확인
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Python script not found: ${scriptPath}`);
    }
    
    // Python 실행 명령어 (Windows와 Unix 모두 지원)
    let pythonCmd = 'python3';
    if (process.platform === 'win32') {
      pythonCmd = 'python';
    }
    
    // output_dir을 지정하지 않으면 Python 스크립트가 다운로드 폴더를 사용
    // 명시적으로 전달하지 않아도 Python 스크립트가 자동으로 다운로드 폴더를 찾음
    const command = `${pythonCmd} "${scriptPath}" "${tempFile}"`;

    console.log(`Executing: ${command}`);
    console.log(`Working directory: ${path.join(__dirname, '..')}`);
    console.log(`Script path exists: ${fs.existsSync(scriptPath)}`);
    console.log(`Temp file created: ${tempFile}`);
    console.log(`Python command: ${pythonCmd}`);
    console.log(`Platform: ${process.platform}`);
    
    // Python 명령어가 실제로 존재하는지 확인 (선택적)
    try {
      const { stdout: pythonVersion } = await execAsync(`${pythonCmd} --version`, {
        cwd: path.join(__dirname, '..'),
        timeout: 5000
      });
      console.log(`Python version check: ${pythonVersion}`);
    } catch (versionError) {
      console.warn(`Python version check failed: ${versionError.message}`);
    }
    
    let stdout = '';
    try {
      const result = await execAsync(command, {
        cwd: path.join(__dirname, '..'),
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      stdout = result.stdout;
      // stderr가 있으면 항상 로깅 (경고 제외)
      if (result.stderr) {
        const stderrText = result.stderr.toString();
        if (!stderrText.includes('경고') && !stderrText.includes('Warning') && !stderrText.includes('DeprecationWarning')) {
          console.error('Python script stderr:', stderrText);
        }
      }
      
      console.log('Python script stdout:', stdout);
      console.log('Python script result code:', result.code);
      
      // Python 스크립트가 에러 코드로 종료되었는지 확인
      // code가 undefined인 경우는 promisify(exec)에서 정상적으로 처리되지 않은 경우일 수 있음
      // 이 경우 stdout에 성공 메시지가 있는지 확인
      if (result.code === undefined) {
        // stdout에 에러 메시지가 있는지 확인
        const stdoutStr = stdout ? stdout.toString() : '';
        const stderrStr = result.stderr ? result.stderr.toString() : '';
        
        // stdout에 "생성 완료" 또는 "저장 위치" 같은 성공 메시지가 있으면 성공으로 간주
        if (stdoutStr.includes('생성 완료') || stdoutStr.includes('저장 위치') || stdoutStr.includes('완료')) {
          console.log('Python script completed successfully (code undefined but success message found)');
          // 성공으로 간주하고 계속 진행
        } else if (stderrStr && !stderrStr.includes('경고') && !stderrStr.includes('Warning') && !stderrStr.includes('DeprecationWarning')) {
          // stderr에 실제 에러가 있으면 실패
          throw new Error(`Python script execution failed: exit code is undefined. stderr: ${stderrStr}`);
        } else {
          // code가 undefined이고 성공/실패를 판단할 수 없으면 경고만 출력하고 계속 진행
          console.warn('Python script exit code is undefined, but no error found. Assuming success.');
        }
      } else if (result.code !== 0 && result.code !== null) {
        throw new Error(`Python script exited with code ${result.code}. stderr: ${result.stderr || 'No stderr'}`);
      }
    } catch (execError) {
      // execError가 exec 에러인 경우 처리
      const errorMessage = execError.message || 'Unknown error';
      const errorCode = execError.code;
      
      // 명령어를 찾을 수 없는 경우 (ENOENT)
      if (errorCode === 'ENOENT') {
        console.error(`Python command not found: ${pythonCmd}`);
        // Python 명령어가 실패하면 py 시도 (Windows)
        if (process.platform === 'win32' && pythonCmd === 'python') {
          console.log('Python command not found, trying py launcher...');
          try {
            const result = await execAsync(`py "${scriptPath}" "${tempFile}"`, {
              cwd: path.join(__dirname, '..'),
              maxBuffer: 10 * 1024 * 1024,
              env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            });
            stdout = result.stdout;
            
            // stderr가 있으면 항상 로깅 (경고 제외)
            if (result.stderr) {
              const stderrText = result.stderr.toString();
              if (!stderrText.includes('경고') && !stderrText.includes('Warning') && !stderrText.includes('DeprecationWarning')) {
                console.error('Python script stderr (py launcher):', stderrText);
              }
            }
            
            console.log('Python script stdout (py launcher):', stdout);
            console.log('Python script result code (py launcher):', result.code);
            
            // Python 스크립트가 에러 코드로 종료되었는지 확인
            if (result.code === undefined) {
              // stdout에 성공 메시지가 있는지 확인
              const stdoutStr = stdout ? stdout.toString() : '';
              const stderrStr = result.stderr ? result.stderr.toString() : '';
              
              if (stdoutStr.includes('생성 완료') || stdoutStr.includes('저장 위치') || stdoutStr.includes('완료')) {
                console.log('Python script completed successfully (py launcher, code undefined but success message found)');
                // 성공으로 간주하고 계속 진행
              } else if (stderrStr && !stderrStr.includes('경고') && !stderrStr.includes('Warning') && !stderrStr.includes('DeprecationWarning')) {
                throw new Error(`Python script execution failed (py launcher): exit code is undefined. stderr: ${stderrStr}`);
              } else {
                console.warn('Python script exit code is undefined (py launcher), but no error found. Assuming success.');
              }
            } else if (result.code !== 0 && result.code !== null) {
              throw new Error(`Python script exited with code ${result.code}. stderr: ${result.stderr || 'No stderr'}`);
            }
          } catch (pyError) {
            const pyErrorMessage = pyError.message || 'Unknown error';
            const pyErrorCode = pyError.code;
            console.error('Python execution error details:', {
              execError: errorMessage,
              execErrorCode: errorCode,
              execErrorStack: execError.stack,
              pyError: pyErrorMessage,
              pyErrorCode: pyErrorCode,
              pyErrorStack: pyError.stack,
              stderr: pyError.stderr || execError.stderr
            });
            
            // py 명령어도 찾을 수 없는 경우
            if (pyErrorCode === 'ENOENT') {
              throw new Error(`Python is not installed or not in PATH. Tried 'python' and 'py' commands. Please install Python and ensure it is in your system PATH.`);
            }
            
            throw new Error(`Python execution failed: ${errorMessage}. Py launcher also failed: ${pyErrorMessage}. Details: ${pyError.stderr || execError.stderr || 'No stderr'}`);
          }
        } else {
          throw new Error(`Python command '${pythonCmd}' not found. Please install Python and ensure it is in your system PATH. Error: ${errorMessage}`);
        }
      } else {
        // 다른 에러인 경우
        console.error('Python execution error details:', {
          error: errorMessage,
          errorCode: errorCode,
          stack: execError.stack,
          stderr: execError.stderr
        });
        
        // Python 명령어가 실패하면 py 시도 (Windows, ENOENT가 아닌 경우)
        if (process.platform === 'win32' && pythonCmd === 'python') {
          console.log('Python command failed, trying py launcher...');
          try {
            const result = await execAsync(`py "${scriptPath}" "${tempFile}"`, {
              cwd: path.join(__dirname, '..'),
              maxBuffer: 10 * 1024 * 1024,
              env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            });
            stdout = result.stdout;
            
            // stderr가 있으면 항상 로깅 (경고 제외)
            if (result.stderr) {
              const stderrText = result.stderr.toString();
              if (!stderrText.includes('경고') && !stderrText.includes('Warning') && !stderrText.includes('DeprecationWarning')) {
                console.error('Python script stderr (py launcher):', stderrText);
              }
            }
            
            console.log('Python script stdout (py launcher):', stdout);
            console.log('Python script result code (py launcher):', result.code);
            
            // Python 스크립트가 에러 코드로 종료되었는지 확인
            if (result.code === undefined) {
              // stdout에 성공 메시지가 있는지 확인
              const stdoutStr = stdout ? stdout.toString() : '';
              const stderrStr = result.stderr ? result.stderr.toString() : '';
              
              if (stdoutStr.includes('생성 완료') || stdoutStr.includes('저장 위치') || stdoutStr.includes('완료')) {
                console.log('Python script completed successfully (py launcher, code undefined but success message found)');
                // 성공으로 간주하고 계속 진행
              } else if (stderrStr && !stderrStr.includes('경고') && !stderrStr.includes('Warning') && !stderrStr.includes('DeprecationWarning')) {
                throw new Error(`Python script execution failed (py launcher): exit code is undefined. stderr: ${stderrStr}`);
              } else {
                console.warn('Python script exit code is undefined (py launcher), but no error found. Assuming success.');
              }
            } else if (result.code !== 0 && result.code !== null) {
              throw new Error(`Python script exited with code ${result.code}. stderr: ${result.stderr || 'No stderr'}`);
            }
          } catch (pyError) {
            const pyErrorMessage = pyError.message || 'Unknown error';
            console.error('Python execution error details:', {
              execError: errorMessage,
              execErrorStack: execError.stack,
              pyError: pyErrorMessage,
              pyErrorStack: pyError.stack,
              stderr: pyError.stderr || execError.stderr
            });
            throw new Error(`Python execution failed: ${errorMessage}. Py launcher also failed: ${pyErrorMessage}. Details: ${pyError.stderr || execError.stderr || 'No stderr'}`);
          }
        } else {
          throw execError;
        }
      }
    }

    // Python 스크립트 출력에서 파일 경로 추출
    let generatedFiles = [];
    let outputPath = null;
    
    if (stdout) {
      // "생성 완료:" 또는 "저장 위치:" 패턴으로 경로 추출
      const pathMatch = stdout.match(/(?:생성 완료|저장 위치):\s*(.+\.pptx|.+)/);
      if (pathMatch) {
        outputPath = pathMatch[1].trim();
        const filename = path.basename(outputPath);
        generatedFiles = [{
          filename: filename,
          filepath: outputPath,
          downloadPath: outputPath
        }];
        console.log(`PPT 파일이 저장되었습니다: ${outputPath}`);
      }
    }

    // 임시 파일 정리
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp file:', cleanupError);
    }

    // stdout에서 저장 위치 정보도 추출
    let storageLocation = null;
    if (stdout) {
      const locationMatch = stdout.match(/저장 위치:\s*(.+)/);
      if (locationMatch) {
        storageLocation = locationMatch[1].trim();
      }
    }

    if (!responseSent && !res.headersSent) {
      responseSent = true;
      res.json({
        success: true,
        files: generatedFiles,
        message: stdout || 'PPT 생성 완료',
        downloadPath: outputPath,
        storageLocation: storageLocation || outputPath ? path.dirname(outputPath) : null
      });
    }

  } catch (error) {
    console.error('PPT 생성 오류:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // 에러 응답 전송 보장
    if (!responseSent && !res.headersSent) {
      try {
        responseSent = true;
        res.status(500).json({
          success: false,
          error: error.message || 'Unknown error',
          details: error.stack || 'No stack trace available',
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } catch (jsonError) {
        console.error('JSON 응답 전송 실패:', jsonError);
        if (!res.headersSent) {
          res.status(500).send(`PPT 생성 오류: ${error.message || 'Unknown error'}`);
        }
      }
    }
  }
});

// ============================================================================
// URL/원격 CSV 프록시 (CORS 우회) — Phase 4: URL 데이터 로더
// 브라우저에서 직접 외부 URL을 fetch하면 CORS로 막히는 경우가 많아,
// 서버에서 대신 가져와 CSV 텍스트를 그대로 반환한다.
// 재현성 불변식 영향 없음: 가져온 CSV 텍스트는 업로드 파일과 동일하게
// 기존 파서로 파싱되어 동일한 DataPreview 구조로 저장된다.
// ============================================================================
app.get('/api/proxy-csv', async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }
  // SSRF 완화: http/https만 허용
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http/https URLs are allowed' });
  }
  try {
    const upstream = await fetch(url, {
      headers: { Accept: 'text/csv, text/plain, application/octet-stream, */*' },
      redirect: 'follow',
    });
    if (!upstream.ok) {
      return res
        .status(502)
        .json({ error: `Upstream responded ${upstream.status} ${upstream.statusText}` });
    }
    const text = await upstream.text();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(text);
  } catch (error) {
    console.error('proxy-csv error:', error);
    res.status(502).json({ error: 'Failed to fetch URL', details: error.message });
  }
});

// ============================================================================
// 서버 시작
// ============================================================================

app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`- SplitData API: http://localhost:${PORT}/api/split-data (ready)`);
    console.log(`- PPT 생성 API: http://localhost:${PORT}/api/generate-ppts (ready)`);
    console.log(`- URL CSV 프록시: http://localhost:${PORT}/api/proxy-csv?url=... (ready)`);
    console.log(
      db
        ? `- Samples API: http://localhost:${PORT}/api/samples (ready)`
        : `- Samples API: http://localhost:${PORT}/api/samples (DB unavailable, 503. Use Supabase or: pnpm rebuild better-sqlite3)`
    );
});
