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
JIRA JQL 검색은 특정 담당자와 기간에 해당하는 '말단 업무'들만 반환하는 경우가 많습니다. 이 업무들이 어떤 에픽(Epic)이나 상위 태스크에 속하는지 파악하여 전체 컨텍스트를 복원하기 위해 다음 로직을 실행합니다.
- **수집**: 초기 검색된 이슈들에서 다음 두 가지 경로로 부모 키(Key)를 추출합니다.
  1. `parent` 필드 (Sub-task의 상위 업무)
  2. `issuelinks` 중 "포함됨" 또는 "is contained by" 관계의 대상 이슈
- **필터링**: 현재 메모리(`Map`)에 존재하지 않는 부모 ID만 추출합니다.
- **재귀 호출**: 추출된 부모 ID들을 JIRA API로 벌크 재조회(`recursive`)합니다.
- **종료 조건**: 모든 이슈의 최상위 부모까지 도달했거나 더 이상 새로운 부모 키가 발견되지 않을 때까지 반복합니다 (최대 Depth 10).

### Phase 2: Dictionary-based Tree Construction (사전 기반 트리 구축)
조회된 모든 이슈(말단 + 부모 체인)를 하나의 배열에서 트리 객체(`IDailyReportTask`)로 변환합니다.
- **객체 맵핑**: 모든 이슈를 `Map<key, Issue>`에 담아 O(1) 접근을 보장합니다.
- **관계 분석 (issuelinks & parent)**: 
  - Sub-task의 경우 `parent` 필드를 참조하여 부모-자식 관계를 맺습니다.
  - 일반 태스크의 경우 `issuelinks` 중 "포함됨/is contained by" (자식이 부모를 참조) 또는 "포함/contains" (부모가 자식을 참조) 관계를 분석하여 `childToParentMap`을 구성합니다.
- **참조 연결**: 각 이슈를 순회하며 부모-자식 관계가 확인된 경우, 부모의 `children` 배열에 자식 객체를 추가합니다.
- **루트 식별**: `parent`가 없거나 관계 맵 상에서 부모가 없는 항목들을 `Root Nodes`로 분류합니다.

### Phase 3: Bracket-based Service Grouping (브라켓 기반 서비스 그룹화)
리포트의 최상단 섹션을 구분하기 위해 요약(Summary) 필드의 브라켓을 활용합니다.
- **정규식 추출**: `^\[(.*?)\]` 패턴을 사용하여 업무 제목 맨 앞의 텍스트(예: `[건진]`)를 추출합니다.
- **그룹 맵핑**: 추출된 서비스명을 키(Key)로 하여 루트 노드들을 그룹화합니다.
- **기타 분류**: 브라켓이 없는 항목은 자동으로 `[기타]` 섹션으로 이동됩니다.

### Phase 4: Multi-level Chronological Sorting (다계층 연대순 정렬)
보고서의 가독성을 위해 모든 업무를 시간순으로 배치합니다.
- **기준 필드**: `customfield_12104` (WBSGantt 시작일)을 최우선으로 하며, 없을 경우 미래의 먼 날짜로 간주하여 맨 뒤로 보냅니다.
- **재귀 정렬**: 
  1. 서비스 그룹들을 서비스명 가나다순으로 정렬합니다.
  2. 각 서비스 내의 **상위 업무(Root)**들을 시작일 오름차순으로 정렬합니다.
  3. 각 업무의 **하위 업무(Children)**들 역시 내부에서 시작일 오름차순으로 재귀적으로 정렬합니다.

### Phase 5: Hybrid Progress Calculation Logic (하이브리드 진행률 계산)
WBS Gantt 필드가 비어있거나 0인 경우에도 정확한 진행률을 표시하기 위한 3단계 폴백 로직입니다.
1. **WBS Gantt (%)**: `customfield_12901` 필드 값을 최우선으로 사용합니다.
2. **JIRA Aggregate Progress**: 해당 값이 0일 경우, JIRA 자체의 집계 진행률(`aggregateprogress.percent`)을 참조합니다. (하위 업무가 포함된 전체 진행도 반영)
3. **Time Tracking Basis**: 위 값들이 모두 없을 경우, `spentTime` / `originalEstimate` 비율을 계산하여 100% 한도로 반올림 표시합니다.

### Phase 6: Text Report Formatting & Highlighting (텍스트 리포트 생성 및 강조)
최종적으로 가공된 트리 구조를 업무 메신저 등에 최적화된 텍스트 형식으로 변환합니다.
- **계층별 인덴트**: 1단계 업무는 `1) `, 2단계 이하 하위 업무는 ` ㄴ ` 접두사를 사용하여 계층 구조를 시각화합니다.
- **정보 괄호 구성**: 각 업무 끝에 `(담당자, 진행률%, 시작일 ~ 종료일)` 형태의 정보를 자동으로 결합합니다.
- **스마트 경고 (🔴)**: 완료일이 지났음에도 진행률이 100% 미만인 업무에 대해 자동으로 빨간색 강조 이모지를 삽입합니다.
- **변경 사유 추적**: 시작일 또는 종료일이 변경된 경우(`customfield_12104` 등 참조), 변경 전/후 날짜와 함께 그 사유를 리포트에 포함합니다.

## 🎨 디자인 시스템

## 🎨 디자인 시스템

### Glassmorphism & Themes
- **Variables**: `index.css`에 정의된 CSS Variables를 통해 테마를 일괄 관리합니다.
- **Glass Effects**: `backdrop-filter: blur(12px)`와 반투명한 배경색을 사용하여 레이어의 깊이감을 표현합니다.
- **Gradients**: `linear-gradient`와 `radial-gradient`를 조합하여 현대적인 심해 테마 배경을 구현했습니다.

## 🔒 보안 및 영속성 (Desktop Persistence)
- **Direct API Link**: 브라우저의 샌드박스 정책을 벗어나 JIRA 서버와 HTTP/HTTPS 제약 없이 직접 연결됩니다.
- **Local Storage Management**: 사용자의 JIRA 인증 정보 및 개인 설정(`isUpdateWarn`, `showJiraKey`, `includeJiraLink` 등)은 `localStorage`에 안전하게 저장됩니다. 이는 데스크탑 환경에서 쿠키보다 훨씬 안정적인 데이터 영속성을 제공하며, 앱 재시작 시에도 모든 상태를 완벽히 복원합니다.
