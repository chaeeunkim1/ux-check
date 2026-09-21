# 배포 운영 안내

공개 운영 주소: https://ux-check-zeta.vercel.app. GitHub push 후 Vercel 자동 배포를 확인했습니다. 검수 기능은 현재 개발·검증 중이며 구체적인 범위는 execution-log.md를 확인합니다.

## 배포 구성

- GitHub: https://github.com/chaeeunkim1/ux-check
- Vercel 프로젝트: ralphthon / ux-check
- 기본 브랜치: main
- Node.js: 22.x
- main에 커밋을 push하면 Vercel Git 연동이 자동 배포합니다.
- GitHub Actions는 npm ci와 npm run build를 실행합니다. 공개 저장소의 Actions에는 API 키를 등록하지 않습니다.

## 실행 명령

```powershell
npm ci
npm run dev
npm run build
```

## Claude API 설정 관리

1. 로컬 .env.local의 ANTHROPIC_API_KEY를 수정합니다. 키 값을 채팅, 커밋, 명령 인수에 넣지 않습니다.
2. 필요한 경우 ANTHROPIC_MODEL도 변경합니다.
3. npm run check:api로 실제 합성 이미지 분석을 확인합니다.
4. npm run sync:env로 production과 preview의 환경변수를 갱신합니다.
5. 다시 배포합니다. 환경변수만 바꾸면 이미 실행 중인 배포에는 반영되지 않습니다.
6. npm run preflight -- https://운영주소 명령으로 공개 접속과 실제 Claude 이미지 입력을 확인합니다.

sync:env는 이 PC의 비공개 .vercel/cli-path.txt에 기록한 Vercel CLI를 사용합니다. 다른 PC에서는 Vercel CLI 로그인·프로젝트 연결 후 CLI 진입점 경로를 첫 인수 또는 VERCEL_CLI_PATH로 제공해야 합니다.

동기화 대상은 ANTHROPIC_API_KEY, ANTHROPIC_MODEL, SETUP_CHECK_TOKEN입니다. 키와 점검 토큰은 Vercel의 sensitive 환경변수로 저장하고, 값은 출력하지 않습니다. 기존 OpenAI 키는 동기화하지 않습니다.

## 점검 경로

- GET /api/health: 로그인 없이 서비스 상태와 배포 커밋 확인. API 호출 비용 없음.
- POST /api/setup/check: SETUP_CHECK_TOKEN으로 인증된 준비용 점검만 허용. 합성 빨간 이미지 한 장을 Claude에 전달하며 실제 API 사용량이 발생합니다.
- 인증 없는 점검 호출은 401로 거부합니다. API 실패를 성공으로 표시하지 않습니다.
- 환경변수 설정 여부와 실제 호출 성공은 구분합니다.

## 제출 전

- Vercel의 공개 운영 도메인을 사용하고 시크릿 창에서 동작을 확인합니다.
- 데모 영상은 권장 1분, 최대 3분입니다.
- GitHub와 영상도 로그인 없이 열어 확인합니다.
- Claude 모델/API 사용은 앱의 런타임이며, 대회에 제출할 개발 기록은 실제 Codex 세션 JSONL입니다.
