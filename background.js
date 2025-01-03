// 확장 프로그램 아이콘 클릭 동작과 단축키 명령어를 분리
chrome.action.onClicked.addListener(() => {
  console.log("Extension icon clicked. Opening URL...");
  chrome.tabs.create({ url: "https://finpilot.framer.website/" });
});






