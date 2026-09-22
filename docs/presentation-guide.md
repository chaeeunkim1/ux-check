# HTML 발표자료 사용 안내

- 공개 발표: https://ux-check-zeta.vercel.app/ux-check-presentation.html
- 제출할 단일 파일: public/ux-check-presentation.html
- 총 5장, 발표 메모 기준 약 5분. 한글 글꼴을 내장해 HTML 파일만으로 오프라인 열람 가능.
- 브라우저에서 파일을 열고 F로 전체 화면, 좌우 방향키 또는 PageUp/PageDown으로 이동한다. Home/End는 처음/마지막 장으로 이동한다.
- N 또는 ‘발표 메모’로 현재 장의 발표 메모를 열고 Escape로 닫는다. 메모는 인쇄되지 않는다.
- 하단 시간 버튼을 누르면 타이머가 시작·일시정지된다. R로 초기화하며 자동으로 장을 넘기지는 않는다.
- ‘인쇄 / PDF’는 브라우저 인쇄 창을 연다. 16:9 슬라이드 5장에 맞춘 인쇄 CSS를 포함한다. 이번 확인에서는 PDF 파일을 별도로 생성하지 않았다.
- ‘HTML 저장’으로 독립 파일을 내려받을 수 있다. 발표자료의 데모 링크는 인터넷 연결이 필요하다.

## 편집과 재생성

원본은 docs/presentation-source.html이다. 폰트 변환에 fonttools 4.65.0과 brotli 1.2.0을 사용했다. 설치된 Python 환경에서 `python scripts/build-presentation-html.py`를 실행하면 내장 글꼴을 포함한 public/ux-check-presentation.html을 만든다. 글꼴 라이선스는 HTML 주석에 포함된다.

## 내용의 근거

GS건설 사례는 2026-09-22 실제 공개 UI 실행에서 채택·제외한 항목을 발표용 텍스트로 재구성했다. 67.5초는 해당 실행의 AI 분석 시간이며 수집 시간은 포함하지 않는다. 성능 평균·전체 AI 정확도·업무 시간 절감률로 일반화하지 않는다. 원본 goal, 목표 정정, 실행 공백은 기존 기록에 보존한다.
