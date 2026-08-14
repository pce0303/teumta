# 틈타 지원 페이지

App Store Connect가 **필수로 요구하는 두 URL**을 이 정적 페이지 하나로 채운다.

| App Store Connect 입력칸 | 주소 |
|---|---|
| 지원 URL (Support URL) | `.../index.html` (루트) |
| 개인정보처리방침 URL (Privacy Policy URL) | `.../privacy.html` |

빌드 과정이 없는 순수 HTML/CSS다. 파일을 고치고 `main`에 머지하면 그대로 반영된다.

---

## 배포 전에 반드시 할 것

**문의 이메일을 바꾼다.** `index.html`과 `privacy.html`에 `TODO@example.com`이 각각 한 번씩 들어 있다.
App Store Connect에 입력하는 지원 이메일과 같은 주소를 쓴다.

```sh
grep -rn "TODO@example.com" web/
```

> 개인 계정보다 팀이 함께 볼 수 있는 주소를 권한다. 이 페이지는 공개되고, 앱 심사·이용자 문의가 이리로 온다.

---

## 배포 방법 (둘 중 하나)

### 1) GitHub Pages — 저장소 설정만 바꾸면 끝

워크플로(`.github/workflows/pages.yml`)가 이미 있다. 저장소에서 한 번만 설정하면 된다.

1. 저장소 **Settings → Pages**
2. **Source**를 `GitHub Actions`로 변경
3. `web/` 아래 파일이 `main`에 머지되면 자동 배포

주소: `https://saesgil-yulamdan.github.io/teumta/` · `.../teumta/privacy.html`

수동으로 돌리려면 Actions 탭 → "Deploy support site" → Run workflow.

### 2) Vercel — 저장소 연결 후 루트 디렉터리만 지정

1. Vercel에서 **Add New → Project** → 저장소 선택
2. **Root Directory**를 `web` 으로 지정
3. Framework Preset은 `Other`, 빌드 명령·출력 디렉터리는 **비워 둔다**(정적 파일 그대로 서빙)
4. Deploy

주소: `https://<프로젝트명>.vercel.app/` · `.../privacy.html`

> 둘 다 해도 상관없지만 App Store Connect에는 **한 곳의 주소만** 넣는다. 나중에 주소가 바뀌면
> App Store Connect에서 URL을 수정하면 된다(앱 심사 재제출 없이 변경 가능한 항목이다).

---

## 로컬에서 확인

```sh
cd web && python3 -m http.server 4000
# http://localhost:4000
```

## 구성

```
web/
├── index.html    지원 페이지(문의처·FAQ)
├── privacy.html  개인정보처리방침
├── style.css     앱 디자인 토큰과 같은 색을 쓴다
└── logo.png      루트 teumta-logo.png 사본
```

내용을 고칠 때 **앱의 실제 동작과 어긋나지 않게** 한다 — 특히 개인정보처리방침은
`docs/privacy-policy.md`와 같은 내용을 유지한다(둘 중 하나만 고치면 서로 어긋난다).
