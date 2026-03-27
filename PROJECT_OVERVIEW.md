# Project Overview: Jira Report Pro (Desktop)

본 문서는 `Jira Report Pro` 프로젝트의 기술적 설계와 핵심 로직을 상세히 설명합니다.

## 🏗 아키텍처 구조

프로젝트는 **Electron**을 기반으로 한 데스크탑 어플리케이션(Native App)으로 전환되었습니다. 이는 브라우저의 보안 제약(CORS, Mixed Content)을 우회하여 사내 JIRA 서버(`http://jira.duzon.com:8080`)와 직접 통신하기 위한 최적의 아키텍처 선택입니다.

### 핵심 구성
- **Main Process (main.cjs)**: Electron의 메인 프로세스로, 앱의 생명주기를 관리하며 `webSecurity: false` 설정을 통해 JIRA API에 대한 직접 접근 권한을 부여합니다.
- **Renderer Process (Vite + React)**: 사용자 인터페이스를 담당하며, 메인 프로세스가 허용한 통로를 통해 JIRA API와 통신합니다.
- **디렉토리 구조**:
  - `src/components/`: 재사용 가능한 UI 컴포넌트
  - `src/pages/DailyReport/`: 메인 대시보드 페이지
  - `src/utils/`: 핵심 비즈니스 로직 (Jira API, Tree Building, Formatting)
  - `main.cjs`: Electron 진입점 및 창 설정

## 🌳 Hierarchical Tree Processing Pipeline

본 프로젝트의 핵심은 JIRA의 파편화된 업무 데이터를 유의미한 계층 구조(Tree)로 재구성하는 것입니다. AI와 개발자가 로직을 완벽히 이해할 수 있도록 4단계 파이프라인으로 상세히 설명합니다.

### Phase 1: Recursive Parent Resolution (재귀적 부모 검색)
JIRA JQL 검색은 특정 담당자와 기간에 해당하는 '말단 업무'들만 반환하는 경우가 많습니다. 이 업무들이 어떤 에픽(Epic)이나 상위 태스크에 속하는지 파악하기 위해 다음 로직을 실행합니다.
- **수집**: 초기 검색된 이슈들의 `parent` 필드 ID를 수집합니다.
- **필터링**: 현재 메모리(`Map`)에 존재하지 않는 부모 ID만 추출합니다.
- **재귀 호출**: 존재하지 않는 부모 ID들을 JIRA API로 재조회(`recursive`)합니다.
- **종료 조건**: 모든 이슈의 최상위 부모가 조회되었거나 더 이상 부모 ID가 없을 때까지 반복합니다.

### Phase 2: Dictionary-based Tree Construction (사전 기반 트리 구축)
조회된 모든 이슈(말단 + 부모 체인)를 하나의 배열에서 트리 객체(`IDailyReportTask`)로 변환합니다.
- **객체 맵핑**: 모든 이슈를 `Map<key, Issue>`에 담아 O(1) 접근을 보장합니다.
- **참조 연결**: 각 이슈를 순회하며 `parent` 키가 있는 경우, 해당 부모의 `하위업무` 배열에 자신의 참조(Reference)를 추가합니다.
- **루트 식별**: `parent`가 없거나 해당 프로젝트 내에서 최상위 계층인 항목들을 `Root Nodes`로 분류합니다.

### Phase 3: Bracket-based Service Grouping (브라켓 기반 서비스 그룹화)
리포트의 최상단 섹션을 구분하기 위해 요약(Summary) 필드의 브라켓을 활용합니다.
- **정규식 추출**: `^\[(.*?)\]` 패턴을 사용하여 업무 제목 맨 앞의 텍스트(예: `[건진]`)를 추출합니다.
- **그룹 맵핑**: 추출된 서비스명을 키(Key)로 하여 루트 노드들을 그룹화합니다.
- **기타 분류**: 브라켓이 없는 항목은 자동으로 `[기타]` 섹션으로 이동됩니다.

### Phase 4: Multi-level Chronological Sorting (다계층 연대순 정렬)
보고서의 가독성을 위해 모든 업무를 시간순으로 배치합니다.
- **기준 필드**: `customfield_12104` (WBSGantt 시작일)을 최우선으로 합니다.
- **재귀 정렬**: 
  1. 서비스 그룹들을 서비스명 가나다순으로 정렬합니다.
  2. 각 서비스 내의 **상위 업무(Root)**들을 시작일 오름차순으로 정렬합니다.
  3. 각 업무의 **하위 업무(Children)**들 역시 내부에서 시작일 오름차순으로 재귀적으로 정렬합니다.

## 🎨 디자인 시스템

### Glassmorphism & Themes
- **Variables**: `index.css`에 정의된 CSS Variables를 통해 테마를 일괄 관리합니다.
- **Glass Effects**: `backdrop-filter: blur(12px)`와 반투명한 배경색을 사용하여 레이어의 깊이감을 표현합니다.
- **Gradients**: `linear-gradient`와 `radial-gradient`를 조합하여 현대적인 심해 테마 배경을 구현했습니다.

## 🔒 보안 및 영속성 (Desktop Persistence)
- **Direct API Link**: 브라우저의 샌드박스 정책을 벗어나 JIRA 서버와 HTTP/HTTPS 제약 없이 직접 연결됩니다.
- **Local Storage Management**: 사용자의 JIRA 인증 정보 및 개인 설정(`isUpdateWarn`, `showJiraKey`, `includeJiraLink` 등)은 `localStorage`에 안전하게 저장됩니다. 이는 데스크탑 환경에서 쿠키보다 훨씬 안정적인 데이터 영속성을 제공하며, 앱 재시작 시에도 모든 상태를 완벽히 복원합니다.
