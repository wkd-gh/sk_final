let DOCUMENT_ID = ""; // 초기값은 빈 문자열로 설정

// Google 서비스 계정 JSON 키 정보 (각자 개인의 키를 넣어주세요!!!!!!!!!!!!!!)
const serviceAccount = {};
// OpenAI API (키 각자 개인의 키를 넣어주세요!!!!!!!!!!!!!!!!!!)
const OPENAI_API_KEY ="sk-proj-";

// Google Docs URL에서 문서 ID 추출 함수
function extractDocumentId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/); // "/d/<문서ID>" 형식 찾기
  return match ? match[1] : null;
}

// "Send" 버튼 클릭 이벤트
document.getElementById("send-btn").addEventListener("click", async () => {
  const userInput = document.getElementById("user-input").value.trim();
  const docUrlInput = document.getElementById("doc-url-input").value.trim(); // 사용자 입력값 가져오기

  // 문서 URL이 비어있다면 알림을 띄우고 중단
  if (!docUrlInput) {
    alert("Google Docs URL을 입력하지 않으면 문서와 연동할 수 없습니다.\n\n채팅을 시작하려면 상단 입력란에 URL을 입력한 후 다시 시도해주세요.");
    return;
  }

  // URL에서 문서 ID 추출
  const extractedDocId = extractDocumentId(docUrlInput);

  if (!extractedDocId) {
    alert("올바른 Google Docs URL을 입력해주세요.\n\n"+
      "URL 예시:\nhttps://docs.google.com/document/d/문서ID/edit"
    );
    return;
  }

  // 문서 ID 설정
  if (DOCUMENT_ID !== extractedDocId) {
    DOCUMENT_ID = extractedDocId;
    alert(`Google Docs 문서가 연동되었습니다.\n\n문서 ID: ${DOCUMENT_ID}`);
  }

  // 사용자 메시지가 비어있는 경우 중단
  if (!userInput) {
    alert("메시지를 입력해주세요.");
    return;
  }

  const chatBox = document.getElementById("chat-box");

  const userMessage = document.createElement("div");
  userMessage.textContent = `🧑‍💻 ${userInput}`;
  chatBox.appendChild(userMessage);

  try {
    // GPT 호출
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: userInput }],
      }),
    });

    if (!response.ok) throw new Error("GPT API 호출 실패");

    const data = await response.json();
    const botMessage = data.choices[0]?.message?.content || "GPT 응답 실패";

    const botMessageElement = document.createElement("div");
    botMessageElement.textContent = `🤖 ${botMessage}`;
    chatBox.appendChild(botMessageElement);

    await appendToGoogleDoc(botMessage); // Google Docs에 추가

    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (error) {
    console.error("❌ 오류:", error);
  }

  document.getElementById("user-input").value = ""; // 메시지 입력창 초기화
});

// Google Docs API로 응답 추가
async function appendToGoogleDoc(content) {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(
      `https://docs.googleapis.com/v1/documents/${DOCUMENT_ID}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: `${content}\n`,
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Docs 업데이트 실패: ${errorText}`);
    }

    console.log("✅ Google Docs 업데이트 성공!");
  } catch (error) {
    console.error("❌ Google Docs API 오류:", error);
    alert(
      "문서를 찾을 수 없습니다. 입력한 Google Docs URL이 올바른지 확인해주세요. 또한, 문서에 서비스 계정에 대한 편집 권한을 공유했는지 확인해주세요.\n\n" +
        "- 올바른 URL 예시:\n  https://docs.google.com/document/d/문서ID/edit\n\n" +
        "- 편집자 권한 공유 방법:\n" +
        "  1. Google Docs 문서를 열고 우측 상단의 '공유' 버튼을 클릭합니다.\n" +
        "  2. 아래 이메일을 추가하여 편집자 권한을 부여하세요.\n" +
        "     - 서비스 계정 이메일: finpilot@gen-lang-client-0845052581.iam.gserviceaccount.com\n\n" +
        "URL이 정확하고 권한이 설정된 후 다시 시도해주세요."
    );
  }
}

// JWT 토큰 생성 및 Google OAuth 2.0 토큰 요청
async function getAccessToken() {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/documents",
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const encodeBase64URL = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerEncoded = encodeBase64URL(header);
  const claimsEncoded = encodeBase64URL(claims);
  const unsignedToken = `${headerEncoded}.${claimsEncoded}`;

  try {
    const keyBuffer = pemToArrayBuffer(serviceAccount.private_key);

    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      keyBuffer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" },
      },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      new TextEncoder().encode(unsignedToken)
    );

    const signatureEncoded = btoa(
      String.fromCharCode(...new Uint8Array(signature))
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const jwt = `${unsignedToken}.${signatureEncoded}`;

    const response = await fetch(serviceAccount.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth 2.0 토큰 요청 실패: ${errorText}`);
    }

    const { access_token } = await response.json();
    return access_token;
  } catch (error) {
    console.error("❌ JWT 생성 또는 토큰 요청 중 오류:", error);
  }
}

// 🔑 PEM 형식의 키를 ArrayBuffer로 변환
function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}
