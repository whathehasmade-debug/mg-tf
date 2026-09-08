# MG TF 사건관리 웹앱

마곡TF 사건을 통합 관리하기 위한 웹앱입니다.

## 구성
- Frontend: HTML / CSS / JavaScript
- Database & Auth: Supabase
- Hosting target: Cloudflare Pages
- File storage target: Google Drive
- Source: GitHub

## 보안
- 주민등록번호는 저장하지 않습니다.
- 브라우저에는 Supabase publishable key만 포함합니다.
- 실제 사건 데이터 접근은 Supabase RLS와 허용 사용자 정책으로 제한합니다.
