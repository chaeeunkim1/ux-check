# UX Check

사이트 URL을 입력하면 실제 페이지를 열어 UI·UX에서 수정할 점을 관찰 근거, 업무 영향, 개선안과 확인 기준으로 정리하는 AI 검수 도구입니다.

- 공개 데모: https://ux-check-zeta.vercel.app
- 60초 시연 영상: https://ux-check-zeta.vercel.app/demo
- 발표자료: https://ux-check-zeta.vercel.app/ux-check-presentation.html
- GitHub: https://github.com/chaeeunkim1/ux-check
- 실제 실행 목표 원문: [goal-original.txt](docs/goal-original.txt)
- 사용자 정정에 따른 URL 중심 범위: [goal-amendment-url.md](docs/goal-amendment-url.md)
- 개발 및 검증 기록: [execution-log.md](docs/execution-log.md)

## 현재 구현

- 공개 사이트 URL 직접 입력 → Chromium 페이지 렌더링 → 데스크톱·모바일 최대 6개 스크롤 구간 및 문서 구조 관찰
- 공개 IP 검증과 검증 IP 연결 프록시, 로컬·내부망 차단, 읽기 전용 요청
- PNG/JPG/WebP 화면 업로드 및 승인 목록·점검 입력 폼·업무 대시보드 합성 예제
- 업무 목적을 반영한 실제 Claude Sonnet 4.6 이미지 검수
- 문제 위치, 관찰 근거, 업무 영향, 우선순위, 개선안과 확인 기준
- 개선 전후 비교와 HTML/Markdown/JSON 보고서 다운로드
- 입력·이미지 형식 및 용량 검증, 오류 안내, 요청 제한

현재 해커톤 진행 중이며, 공개 배포와 실제 분석 검증 범위는 실행 기록을 확인하세요. 60초 시연 영상과 발표자료 5장을 제공합니다. 영상은 실제 사용 화면을 캡처해 편집했으며 분석 대기 시간을 생략했습니다. 스크린샷 검수 결과는 실제 클릭 동작, 사용자 행동, 접근성 준수를 보증하지 않습니다. 이미지 위치 표시는 근사치이며 담당자의 확인이 필요합니다.

## 실행

Node.js 22.x를 사용합니다. 공개 Vercel에서는 `@sparticuz/chromium`을 사용하고, Windows 로컬 URL 검사는 기본 설치 경로의 Chrome 또는 Edge가 필요합니다.

```powershell
npm ci
Copy-Item .env.example .env.local
# .env.local에 ANTHROPIC_API_KEY, ANTHROPIC_MODEL, SETUP_CHECK_TOKEN을 설정
npm run dev
npm test
npm run build
```

기존 .env.local이 있으면 덮어쓰지 마세요. SETUP_CHECK_TOKEN은 준비용 점검 경로에만 사용하는 64자리 16진수 비밀값입니다.

합성 예제 재생성: `node scripts/generate-samples.mjs`. Windows 한글 폰트를 사용해 생성한 PNG를 저장소에 포함하므로 실행 시 폰트 설치는 필요하지 않습니다.

## 데이터와 제한

URL 검사는 지정한 공개 HTML 페이지 1개의 데스크톱 1280×900, 모바일 390×844 크기로 각각 최대 3개 스크롤 구간과 문서 구조를 확인합니다. 문서 높이 12,000px 안에서 상단·중간·마지막 확인 구간을 고르므로 구간 사이가 생략될 수 있습니다. 전체 사이트 순회·로그인·클릭·폼 입력은 수행하지 않습니다. 접속이 제한되거나 리소스가 차단되면 관찰 결과가 원래 사이트와 다를 수 있습니다. 분석 버튼을 누르면 화면 이미지, 수집한 문서 내용과 업무 목적을 Claude API로 전달합니다. 사용자가 업로드하는 자료에는 회사 기밀·개인정보를 넣지 마세요. 이 앱은 업로드 이미지와 분석 결과를 데이터베이스나 파일로 영구 저장하지 않습니다. 브라우저 새로고침 시 결과는 사라지므로 필요한 보고서를 내려받으세요. 외부 AI 제공자의 데이터 취급 정책은 별도 적용됩니다.

앱은 10MB 이하 업로드를 받아 브라우저에서 긴 변 1,600px로 조정합니다. 서버는 이미지당 1.4MB, 요청 본문 약 3.9MB, 정적인 PNG/JPEG/WebP 형식 및 픽셀 수를 검증합니다. 호출 제한은 서버 인스턴스당 시간당 40회, 클라이언트당 10회, 동시 3회이며 메모리 기반입니다. 인스턴스 재시작·증설을 넘어서는 전역 과금 한도는 아닙니다.

## 운영 및 제출

- [배포 운영 및 API 설정](docs/deployment.md)
- [세션 원본 보존과 제출 사본의 비밀값 제거](docs/submission-logs.md)
- [제출 영상: 권장 1분, 최대 3분](docs/submission-video.md)

원본 세션 로그, API 키, 로컬 인증 파일은 공개 저장소에 포함하지 않습니다.
