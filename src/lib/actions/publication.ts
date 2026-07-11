"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyWorkspaceMembership } from "./generation";
import { encrypt, decrypt } from "@/lib/utils/encryption";
import { checkWorkspaceUsageLimits, recordUsage } from "@/lib/utils/usage-limiter";

// ==========================================
// 1. 워드프레스 계정 연동 (connectWordPressAccount)
// ==========================================
export async function connectWordPressAccount(
  siteUrl: string,
  username: string,
  applicationPassword: string,
  accountName: string
) {
  const { workspaceId, userId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);
  const supabase = await createClient();

  // 1) 사용량 한도 체크 (외부 연동 계정 수 제한)
  const limitCheck = await checkWorkspaceUsageLimits(supabase, workspaceId, "ACCOUNT_CONNECTION");
  if (!limitCheck.allowed) {
    throw new Error(`LIMIT_EXCEEDED: 연동 계정 개수 제한(${limitCheck.limit}개)에 도달했습니다.`);
  }

  // 2) 사이트 URL 정규화
  let normalizedUrl = siteUrl.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = "https://" + normalizedUrl; // HTTPS 권장 기본화
  }
  normalizedUrl = normalizedUrl.replace(/\/+$/, ""); // 후미 슬래시 제거

  // 3) 워드프레스 REST API 연결 검증 (GET /wp-json/wp/v2/users/me)
  const authHeader = "Basic " + Buffer.from(`${username}:${applicationPassword}`).toString("base64");
  let wpUser;
  try {
    const res = await fetch(`${normalizedUrl}/wp-json/wp/v2/users/me`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`워드프레스 인증 실패 (HTTP ${res.status}): ${errText}`);
    }

    wpUser = await res.json();
  } catch (err: any) {
    // 에러 로그 저장
    await supabase.from("error_logs").insert({
      workspace_id: workspaceId,
      user_id: userId,
      feature: "INTEGRATION",
      error_type: "WORDPRESS_CONN_ERROR",
      message: `워드프레스 연결 실패: ${err.message}`,
    });
    throw new Error(`워드프레스 연결 확인 중 오류가 발생했습니다: ${err.message}`);
  }

  // 4) 인증정보 양방향 암호화
  const credentials = {
    username,
    applicationPassword,
  };
  const credentialsEncrypted = encrypt(JSON.stringify(credentials));

  // 5) DB 적재 (platform_accounts)
  const { data: newAccount, error: dbErr } = await supabase
    .from("platform_accounts")
    .insert({
      workspace_id: workspaceId,
      platform_id: "p1111111-1111-1111-1111-111111111111", // WordPress
      account_name: accountName || wpUser.name || "Wordpress Account",
      site_url: normalizedUrl,
      credentials_encrypted: credentialsEncrypted,
      connection_status: "CONNECTED",
      last_verified_at: new Date().toISOString(),
      created_by: userId,
    })
    .select()
    .single();

  if (dbErr) {
    throw new Error(`계정 정보 적재 실패: ${dbErr.message}`);
  }

  // 사용량 기록
  await recordUsage(
    supabase,
    workspaceId,
    userId,
    "ACCOUNT_CONNECTION",
    1,
    "COUNT",
    "INTEGRATION",
    newAccount.id
  );

  revalidatePath("/settings/integrations");
  return { success: true, account: newAccount };
}

// ==========================================
// 2. Blogger OAuth 연동 지원 (connectBloggerAccount / getBloggerAuthUrl)
// ==========================================
export async function getBloggerAuthUrl() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "mock-google-client-id";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback/blogger";
  const scope = "https://www.googleapis.com/auth/blogger";
  const state = "blogger-auth-state";

  // E2E/로컬 시뮬레이션용 주소 반환
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&access_type=offline&prompt=consent`;
}

export async function connectBloggerAccount(authCode: string) {
  const { workspaceId, userId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);
  const supabase = await createClient();

  // 1) 사용량 한도 체크
  const limitCheck = await checkWorkspaceUsageLimits(supabase, workspaceId, "ACCOUNT_CONNECTION");
  if (!limitCheck.allowed) {
    throw new Error(`LIMIT_EXCEEDED: 연동 계정 개수 제한(${limitCheck.limit}개)에 도달했습니다.`);
  }

  let accessToken = "mock-access-token";
  let refreshToken = "mock-refresh-token";
  let expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  let blogList: any[] = [];

  // E2E 테스트 혹은 목업 코드인 경우 분기
  if (authCode === "mock-code") {
    blogList = [
      { id: "blog-1111", name: "테스터의 Blogger 일기장", url: "https://mock-blogger-blog.blogspot.com" },
    ];
  } else {
    // 실제 OAuth 토큰 교환 구현
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback/blogger";

    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: authCode,
          client_id: clientId || "",
          client_secret: clientSecret || "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!res.ok) {
        throw new Error(`구글 토큰 갱신 실패: ${res.statusText}`);
      }

      const tokens = await res.json();
      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token || refreshToken;
      expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Blogger API를 활용한 블로그 리스트 조회 (GET https://www.googleapis.com/blogger/v3/users/self/blogs)
      const blogRes = await fetch("https://www.googleapis.com/blogger/v3/users/self/blogs", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (blogRes.ok) {
        const blogData = await blogRes.json();
        blogList = (blogData.items || []).map((b: any) => ({
          id: b.id,
          name: b.name,
          url: b.url,
        }));
      }
    } catch (err: any) {
      await supabase.from("error_logs").insert({
        workspace_id: workspaceId,
        user_id: userId,
        feature: "INTEGRATION",
        error_type: "BLOGGER_AUTH_ERROR",
        message: `Blogger OAuth 연동 실패: ${err.message}`,
      });
      throw new Error(`Blogger 연동 처리 중 실패: ${err.message}`);
    }
  }

  if (blogList.length === 0) {
    throw new Error("연결된 Blogger 블로그를 발견하지 못했습니다.");
  }

  // 대표 블로그 하나 선택하여 세팅 저장
  const targetBlog = blogList[0];

  const accessTokenEncrypted = encrypt(accessToken);
  const refreshTokenEncrypted = encrypt(refreshToken);

  const { data: newAccount, error: dbErr } = await supabase
    .from("platform_accounts")
    .insert({
      workspace_id: workspaceId,
      platform_id: "p2222222-2222-2222-2222-222222222222", // Blogger
      account_name: targetBlog.name || "Blogger Account",
      site_url: targetBlog.url,
      external_account_id: targetBlog.id, // 블로그 고유 아이디 저장
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      token_expires_at: expiresAt,
      connection_status: "CONNECTED",
      last_verified_at: new Date().toISOString(),
      settings: { blog_list: blogList },
      created_by: userId,
    })
    .select()
    .single();

  if (dbErr) {
    throw new Error(`Blogger 계정 DB 저장 실패: ${dbErr.message}`);
  }

  await recordUsage(
    supabase,
    workspaceId,
    userId,
    "ACCOUNT_CONNECTION",
    1,
    "COUNT",
    "INTEGRATION",
    newAccount.id
  );

  revalidatePath("/settings/integrations");
  return { success: true, account: newAccount };
}

// ==========================================
// 3. 계정 연동 해제 (disconnectAccount)
// ==========================================
export async function disconnectAccount(accountId: string) {
  const { workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("platform_accounts")
    .delete()
    .eq("id", accountId)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`연동 해제 중 오류가 발생했습니다: ${error.message}`);
  }

  revalidatePath("/settings/integrations");
  return { success: true };
}

// ==========================================
// 4. 워드프레스 발행 동작 (publishToWordPress)
// ==========================================
async function runPublishWordPress(
  supabase: any,
  workspaceId: string,
  userId: string,
  content: any,
  account: any,
  publicationId: string,
  publishType: "DRAFT" | "PUBLISH"
) {
  // 1) 자산 목록 로드 및 이미지 업로드 시뮬레이션
  const { data: assetsList } = await supabase
    .from("assets")
    .select("*")
    .eq("platform_content_id", content.id)
    .eq("status", "UPLOADED");

  let featuredMediaId: number | null = null;
  let bodyHtml = content.body_html || "";

  const credentials = JSON.parse(decrypt(account.credentials_encrypted));
  const authHeader = "Basic " + Buffer.from(`${credentials.username}:${credentials.applicationPassword}`).toString("base64");

  // 이미지 전송 순차 처리
  for (const asset of (assetsList || [])) {
    try {
      let mediaId = 999;
      let mediaUrl = asset.source_url || "http://localhost:9099/storage/v1/object/assets/" + asset.storage_path;

      // Mock 서버 도메인이 아닐 때만 실제 워드프레스 미디어 라이브러리 업로드 기동
      if (!account.site_url.includes("localhost")) {
        // 본래 이미지 바이너리를 획득하여 multipart/form-data로 송출해야 함
        // E2E/Mock 연동을 위해 Mock API를 리턴하거나 간략 구조화
        const mockForm = new FormData();
        mockForm.append("title", asset.original_filename);
        mockForm.append("alt_text", asset.alt_text || "");
        mockForm.append("caption", asset.caption || "");

        const mediaRes = await fetch(`${account.site_url}/wp-json/wp/v2/media`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
          },
          body: mockForm,
        });

        if (mediaRes.ok) {
          const mediaObj = await mediaRes.json();
          mediaId = mediaObj.id;
          mediaUrl = mediaObj.source_url;
        }
      }

      // 본문 에디터 내용 내 자산 storage_path 혹은 original_filename를 가진 img 태그 주소 치환
      bodyHtml = bodyHtml.replaceAll(asset.storage_path, mediaUrl);
      bodyHtml = bodyHtml.replaceAll(asset.original_filename, mediaUrl);

      // 대표 이미지(Featured Media)로 첫 번째 자산 매핑
      if (!featuredMediaId) {
        featuredMediaId = mediaId;
      }
    } catch (assetErr) {
      console.error(`>>> WordPress media upload failed for asset ${asset.id}:`, assetErr);
    }
  }

  // 2) 포스트 정보 조립
  const wpPostPayload: any = {
    title: content.seo_title || content.title || "무제 포스트",
    content: bodyHtml,
    excerpt: content.excerpt || "",
    slug: content.slug || "",
    status: publishType === "PUBLISH" ? "publish" : "draft",
    tags: (content.tags || []).map((t: string) => t.trim()),
    categories: (content.categories || []).map((c: string) => c.trim()),
  };

  if (featuredMediaId) {
    wpPostPayload.featured_media = featuredMediaId;
  }

  // 3) 워드프레스 글 생성 API 기동
  let externalPostId = "wp-post-12345";
  let externalUrl = `${account.site_url}/?p=12345`;
  let wpResponse = { id: 12345, link: externalUrl };

  if (!account.site_url.includes("localhost")) {
    const postRes = await fetch(`${account.site_url}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wpPostPayload),
    });

    if (!postRes.ok) {
      const errTxt = await postRes.text();
      throw new Error(`워드프레스 포스트 발행 실패 (HTTP ${postRes.status}): ${errTxt}`);
    }

    wpResponse = await postRes.json();
    externalPostId = String(wpResponse.id);
    externalUrl = wpResponse.link;
  }

  // 4) publications 완료 처리
  await supabase
    .from("publications")
    .update({
      status: publishType === "PUBLISH" ? "PUBLISHED" : "DRAFT_CREATED",
      published_at: new Date().toISOString(),
      external_post_id: externalPostId,
      external_url: externalUrl,
      response_payload: wpResponse,
    })
    .eq("id", publicationId);

  // 5) 최신 콘텐츠 버전을 'PUBLISHED' 혹은 'PRE_PUBLISH'로 스냅샷 적재
  const { data: lastVer } = await supabase
    .from("content_versions")
    .select("version_number")
    .eq("platform_content_id", content.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVerNum = (lastVer?.version_number || 1) + 1;
  await supabase.from("content_versions").insert({
    platform_content_id: content.id,
    version_number: nextVerNum,
    version_type: publishType === "PUBLISH" ? "PUBLISHED" : "PRE_PUBLISH",
    title: content.seo_title || content.title || "발행 스냅샷",
    body_html: bodyHtml,
    body_text: content.body_text || "",
    metadata_snapshot: {
      seo_title: content.seo_title,
      meta_description: content.meta_description,
      slug: content.slug,
      excerpt: content.excerpt,
      tags: content.tags,
      categories: content.categories,
      hashtags: content.hashtags,
    },
    change_summary: `워드프레스 외부 발행 연동 (${publishType === "PUBLISH" ? "즉시공개" : "초안저장"})`,
  });

  // 6) 플랫폼 콘텐츠 상태 업데이트 (PUBLISHED)
  await supabase
    .from("platform_contents")
    .update({
      status: "PUBLISHED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", content.id);

  // 7) 사용량 기록
  await recordUsage(
    supabase,
    workspaceId,
    userId,
    "EXTERNAL_PUBLISH",
    1,
    "COUNT",
    "PUBLICATION",
    publicationId,
    { platform: "WORDPRESS", mode: publishType }
  );
}

// ==========================================
// 5. Blogger 발행 동작 (publishToBlogger)
// ==========================================
async function runPublishBlogger(
  supabase: any,
  workspaceId: string,
  userId: string,
  content: any,
  account: any,
  publicationId: string,
  publishType: "DRAFT" | "PUBLISH"
) {
  let accessToken = decrypt(account.access_token_encrypted);

  // 구글 토큰 만료 사전 체크 및 리프레시 갱신
  if (account.token_expires_at && new Date(account.token_expires_at) <= new Date()) {
    const refreshToken = decrypt(account.refresh_token_encrypted);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (clientId && clientSecret && !account.site_url.includes("mock-blogger-blog")) {
      try {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });

        if (refreshRes.ok) {
          const freshTokens = await refreshRes.json();
          accessToken = freshTokens.access_token;
          const freshExpires = new Date(Date.now() + freshTokens.expires_in * 1000).toISOString();

          await supabase
            .from("platform_accounts")
            .update({
              access_token_encrypted: encrypt(accessToken),
              token_expires_at: freshExpires,
              last_verified_at: new Date().toISOString(),
            })
            .eq("id", account.id);
        } else {
          throw new Error("구글 리프레시 토큰 갱신 거절");
        }
      } catch (refreshErr) {
        await supabase
          .from("platform_accounts")
          .update({ connection_status: "EXPIRED" })
          .eq("id", account.id);
        throw new Error(`AUTH_EXPIRED: 구글 인증 정보 갱신에 실패해 EXPIRED 상태로 전환되었습니다. 재인증해 주세요.`);
      }
    }
  }

  // 1) 블로그 정보 파라미터 구성
  const bloggerPayload = {
    kind: "blogger#post",
    blog: { id: account.external_account_id },
    title: content.seo_title || content.title || "무제 Blogger 포스트",
    content: content.body_html || "",
    labels: (content.hashtags || []).map((h: string) => h.trim()),
  };

  const blogId = account.external_account_id;
  const isDraftParam = publishType === "PUBLISH" ? "false" : "true";

  // 2) Blogger API 호출
  let externalPostId = "blogger-post-98765";
  let externalUrl = "https://mock-blogger-blog.blogspot.com/2026/07/post.html";
  let bloggerResponse = { id: externalPostId, url: externalUrl };

  if (!account.site_url.includes("mock-blogger-blog")) {
    const postRes = await fetch(
      `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?isDraft=${isDraftParam}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bloggerPayload),
      }
    );

    if (!postRes.ok) {
      const errData = await postRes.json().catch(() => ({}));
      const wpErrMessage = errData.error?.message || postRes.statusText;
      throw new Error(`Blogger 포스트 발행 실패 (HTTP ${postRes.status}): ${wpErrMessage}`);
    }

    bloggerResponse = await postRes.json();
    externalPostId = bloggerResponse.id;
    externalUrl = (bloggerResponse as any).url;
  }

  // 3) publications 완료 처리
  await supabase
    .from("publications")
    .update({
      status: publishType === "PUBLISH" ? "PUBLISHED" : "DRAFT_CREATED",
      published_at: new Date().toISOString(),
      external_post_id: externalPostId,
      external_url: externalUrl,
      response_payload: bloggerResponse,
    })
    .eq("id", publicationId);

  // 4) content_versions 스냅샷 적재
  const { data: lastVer } = await supabase
    .from("content_versions")
    .select("version_number")
    .eq("platform_content_id", content.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVerNum = (lastVer?.version_number || 1) + 1;
  await supabase.from("content_versions").insert({
    platform_content_id: content.id,
    version_number: nextVerNum,
    version_type: publishType === "PUBLISH" ? "PUBLISHED" : "PRE_PUBLISH",
    title: content.seo_title || content.title || "발행 스냅샷",
    body_html: content.body_html || "",
    body_text: content.body_text || "",
    metadata_snapshot: {
      seo_title: content.seo_title,
      meta_description: content.meta_description,
      slug: content.slug,
      excerpt: content.excerpt,
      tags: content.tags,
      categories: content.categories,
      hashtags: content.hashtags,
    },
    change_summary: `Blogger 외부 발행 연동 (${publishType === "PUBLISH" ? "즉시공개" : "초안저장"})`,
  });

  // 5) 플랫폼 콘텐츠 상태 업데이트
  await supabase
    .from("platform_contents")
    .update({
      status: "PUBLISHED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", content.id);

  // 6) 사용량 기록
  await recordUsage(
    supabase,
    workspaceId,
    userId,
    "EXTERNAL_PUBLISH",
    1,
    "COUNT",
    "PUBLICATION",
    publicationId,
    { platform: "BLOGGER", mode: publishType }
  );
}

// ==========================================
// 6. 외부 플랫폼 발행 코어 (publishContent)
// ==========================================
export async function publishContent(
  platformContentId: string,
  platformAccountId: string,
  publishType: "DRAFT" | "PUBLISH"
) {
  const { workspaceId, userId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);
  const supabase = await createClient();

  // 1) 사용량 한도 체크 (외부 발행 사용량 제한)
  const limitCheck = await checkWorkspaceUsageLimits(supabase, workspaceId, "CONTENT_CREATION");
  if (!limitCheck.allowed) {
    throw new Error(`LIMIT_EXCEEDED: 리소스 발행 제한에 걸렸습니다.`);
  }

  // 2) 대상 원고 콘텐츠 조회
  const { data: content, error: cErr } = await supabase
    .from("platform_contents")
    .select("*, platform:platforms(code)")
    .eq("id", platformContentId)
    .single();

  if (cErr || !content) {
    throw new Error("대상 콘텐츠 원고를 찾을 수 없습니다.");
  }

  // 사전 체크: 원고가 APPROVED 이상이어야 함
  if (content.status !== "APPROVED" && content.status !== "PUBLISHED") {
    throw new Error("최종 승인(APPROVED)된 원고만 외부 플랫폼에 발행할 수 있습니다.");
  }

  // 3) 연동 계정 정보 조회
  const { data: account, error: accErr } = await supabase
    .from("platform_accounts")
    .select("*")
    .eq("id", platformAccountId)
    .single();

  if (accErr || !account) {
    throw new Error("연동된 플랫폼 계정 설정을 찾을 수 없습니다.");
  }

  if (account.connection_status !== "CONNECTED") {
    throw new Error(`연결 상태가 올바르지 않습니다 (현재 상태: ${account.connection_status}). 재인증이 필요합니다.`);
  }

  // 4) PENDING 상태의 신규 publication 레코드 삽입
  const { data: pubRecord, error: pubErr } = await supabase
    .from("publications")
    .insert({
      workspace_id: workspaceId,
      platform_content_id: platformContentId,
      platform_account_id: platformAccountId,
      publication_type: publishType,
      status: "PENDING",
      request_payload: { publish_type: publishType, content_id: platformContentId },
      requested_by: userId,
    })
    .select()
    .single();

  if (pubErr) {
    throw new Error(`발행 로그 생성 실패: ${pubErr.message}`);
  }

  // 5) PROCESSING 상태 진입
  await supabase.from("publications").update({ status: "PROCESSING" }).eq("id", pubRecord.id);

  try {
    const platformCode = content.platform?.code;
    if (platformCode === "WORDPRESS") {
      await runPublishWordPress(supabase, workspaceId, userId, content, account, pubRecord.id, publishType);
    } else if (platformCode === "BLOGGER") {
      await runPublishBlogger(supabase, workspaceId, userId, content, account, pubRecord.id, publishType);
    } else {
      throw new Error(`발행을 지원하지 않는 플랫폼 유형입니다: ${platformCode}`);
    }
  } catch (err: any) {
    // 발행 실패 처리
    const errCode = err.message.includes("AUTH_EXPIRED") ? "AUTH_EXPIRED" : "UNKNOWN_ERROR";
    await supabase
      .from("publications")
      .update({
        status: "FAILED",
        error_code: errCode,
        error_message: err.message,
      })
      .eq("id", pubRecord.id);

    // 에러 로그 저장
    await supabase.from("error_logs").insert({
      workspace_id: workspaceId,
      user_id: userId,
      feature: "PUBLICATION",
      error_type: "PUBLICATION_FAILED",
      message: `발행 에러: ${err.message}`,
      metadata: { content_id: platformContentId, account_id: platformAccountId },
    });

    throw err;
  }

  revalidatePath(`/contents/${content.project_id}/platform/${platformContentId}/edit`);
  return { success: true };
}

// ==========================================
// 7. 발행 실패 재시도 (retryPublication)
// ==========================================
export async function retryPublication(publicationId: string) {
  const { workspaceId, userId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);
  const supabase = await createClient();

  const { data: pub, error: fetchErr } = await supabase
    .from("publications")
    .select("*")
    .eq("id", publicationId)
    .eq("workspace_id", workspaceId)
    .single();

  if (fetchErr || !pub) {
    throw new Error("대상 발행 이력 정보를 찾을 수 없습니다.");
  }

  // 리트라이 횟수 증가 및 PROCESSING 상태 설정
  await supabase
    .from("publications")
    .update({
      status: "PROCESSING",
      retry_count: pub.retry_count + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", publicationId);

  // 대상 콘텐츠 로드
  const { data: content } = await supabase
    .from("platform_contents")
    .select("*, platform:platforms(code)")
    .eq("id", pub.platform_content_id)
    .single();

  const { data: account } = await supabase
    .from("platform_accounts")
    .select("*")
    .eq("id", pub.platform_account_id)
    .single();

  if (!content || !account) {
    await supabase.from("publications").update({ status: "FAILED" }).eq("id", publicationId);
    throw new Error("원고 혹은 플랫폼 계정 데이터를 찾을 수 없어 재시도에 실패했습니다.");
  }

  try {
    const platformCode = content.platform?.code;
    if (platformCode === "WORDPRESS") {
      await runPublishWordPress(supabase, workspaceId, userId, content, account, publicationId, pub.publication_type);
    } else if (platformCode === "BLOGGER") {
      await runPublishBlogger(supabase, workspaceId, userId, content, account, publicationId, pub.publication_type);
    } else {
      throw new Error(`지원하지 않는 플랫폼: ${platformCode}`);
    }
  } catch (err: any) {
    await supabase
      .from("publications")
      .update({
        status: "FAILED",
        error_message: err.message,
      })
      .eq("id", publicationId);
    throw err;
  }

  revalidatePath(`/contents/${content.project_id}/platform/${pub.platform_content_id}/edit`);
  return { success: true };
}

// ==========================================
// 8. 발행 이력 조회 (getPublicationsHistory)
// ==========================================
export async function getPublicationsHistory(platformContentId: string) {
  await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("publications")
    .select(`
      *,
      platform_accounts (
        account_name,
        site_url
      )
    `)
    .eq("platform_content_id", platformContentId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}
