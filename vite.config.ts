import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // 환경 변수 로드 (.env, .env.local, .env.[mode], .env.[mode].local 모두 로드)
    const env = loadEnv(mode, process.cwd(), '');
    const isProduction = mode === 'production';
    
    // API 키 확인 (디버깅용)
    const apiKey = env.GEMINI_API_KEY || env.API_KEY;
    if (!apiKey && mode === 'development') {
      console.warn('⚠️  GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일에 GEMINI_API_KEY를 설정해주세요.');
    }
    
    return {
      publicDir: 'public',
      envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
      server: {
        port: 3003,
        // 로컬 실행 안정성을 위해 개발 모드에서는 127.0.0.1로 고정
        ...(isProduction ? {} : { host: '127.0.0.1' }),
        proxy: {
          '/api/split-data': {
            target: 'http://localhost:3002',
            changeOrigin: true,
            secure: false,
          },
          '/api/generate-ppts': {
            target: 'http://localhost:3002',
            changeOrigin: true,
            secure: false,
          },
          // Phase 4: URL/원격 CSV 로더 — 서버측 CORS 프록시
          '/api/proxy-csv': {
            target: 'http://localhost:3002',
            changeOrigin: true,
            secure: false,
          }
        }
      },
      plugins: [react()],
      define: {
        // 보안: 프로덕션 빌드 번들에는 키를 박지 않는다(빈 문자열).
        // 개발 모드에서만 .env/.env.local의 키를 dev 폴백으로 주입한다.
        // 사용자 키는 런타임에 localStorage에서 로드된다(lib/aiClient.ts).
        'process.env.API_KEY': JSON.stringify(isProduction ? '' : (env.GEMINI_API_KEY || env.API_KEY || '')),
        'process.env.GEMINI_API_KEY': JSON.stringify(isProduction ? '' : (env.GEMINI_API_KEY || env.API_KEY || '')),
        // 고급기능 비밀번호 검증값(비밀번호의 SHA-256 hex 권장, 평문도 허용되나 번들 노출).
        // Vercel/로컬 환경변수에서 빌드 시 주입. 변수명: ADVANCED_PASSWORD_HASH
        // 또는 VITE_ADVANCED_PASSWORD_HASH / NEXT_PUBLIC_ADVANCED_PASSWORD_HASH 모두 허용.
        '__ADVANCED_PASSWORD_HASH__': JSON.stringify(
          process.env.ADVANCED_PASSWORD_HASH
          || process.env.VITE_ADVANCED_PASSWORD_HASH
          || process.env.NEXT_PUBLIC_ADVANCED_PASSWORD_HASH
          || env.ADVANCED_PASSWORD_HASH
          || env.VITE_ADVANCED_PASSWORD_HASH
          || env.NEXT_PUBLIC_ADVANCED_PASSWORD_HASH
          || ''
        )
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: ['xlsx']
      },
      build: {
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
          output: {
            manualChunks: {
              // React core — almost never changes
              'vendor-react': ['react', 'react-dom'],
              // Supabase — large, rarely changes
              'vendor-supabase': ['@supabase/supabase-js'],
              // Google AI SDK
              'vendor-ai': ['@google/genai'],
              // xlsx — already auto-split but make it explicit
              'vendor-xlsx': ['xlsx'],
            },
          },
        },
      }
    };
});
